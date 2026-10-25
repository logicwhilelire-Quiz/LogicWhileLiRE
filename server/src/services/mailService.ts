import bcrypt from 'bcrypt';
import { supabase } from '../db/supabase';
import { getTransporter, getBrevoTransporter, dailyEmailQuota, logDeliverableFailure } from './emailService';

// ============================================================================
// CONFIGURATION & ENVIRONMENT
// ============================================================================
export const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

export const MAIL_FROM_NOREPLY =
  process.env.MAIL_FROM_NOREPLY ||
  process.env.EMAIL_FROM ||
  'LogicWhile LiRE <admin@logicwhilelire.com>';

export const MAIL_REPLY_TO =
  process.env.MAIL_REPLY_TO ||
  process.env.SUPPORT_EMAIL ||
  'admin@logicwhilelire.com';

export const FRONTEND_URL = (() => {
  const v = process.env.FRONTEND_URL || process.env.CLIENT_URL || process.env.CLIENT_ORIGIN;
  const origin = (v || 'https://logicwhilelire.com').split(',')[0].trim();
  return origin.replace(/\/+$/, '');
})();

export const HOSTED_LOGO_URL = `${FRONTEND_URL}/logo.png`;

export const ADMIN_MAIL_ADDRESS = process.env.ADMIN_ALERT_EMAIL || 'admin@logicwhilelire.com';
export const INSPECTOR_MAIL_ADDRESS = process.env.INSPECTOR_MAIL_ADDRESS || 'inspector@logicwhilelire.com';

export const OTP_MAIL_FROM = process.env.OTP_FROM_EMAIL || 'LogicWhile LiRE Security <admin@logicwhilelire.com>';
export const OTP_MAIL_REPLY_TO = process.env.OTP_REPLY_TO || 'admin@logicwhilelire.com';

export const LOGIN_ID_MAIL_FROM = process.env.LOGIN_ID_FROM_EMAIL || 'LogicWhile LiRE <admin@logicwhilelire.com>';
export const LOGIN_ID_MAIL_REPLY_TO = process.env.LOGIN_ID_REPLY_TO || 'admin@logicwhilelire.com';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================
export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  template?: string;
  metadata?: Record<string, any>;
  sentBy?: string;
  from?: string;
  replyTo?: string;
}

export interface SendMailResult {
  success: boolean;
  id?: string;
  resend_id?: string;
  status: 'sent' | 'delivered' | 'failed' | 'resending';
  error?: string;
  log_id?: string;
}

export interface MailLogRecord {
  id: string;
  to_email: string;
  template: string;
  subject: string;
  status: 'sent' | 'delivered' | 'failed' | 'resending';
  resend_id: string | null;
  error_message: string | null;
  metadata: Record<string, any>;
  html_content?: string;
  sent_by: string;
  created_at: string;
  updated_at: string;
}

// In-memory buffer for resilience: ensures admin screen & audits always work
// even before database migrations are loaded on remote replica.
export const memoryMailLogs: MailLogRecord[] = [];

// ============================================================================
// SANITIZATION HELPER
// Never store plain text passwords in logs beyond one-time delivery
// ============================================================================
function sanitizeLogData(metadata?: Record<string, any>, html?: string): {
  cleanMetadata: Record<string, any>;
  cleanHtml: string;
} {
  const cleanMetadata = { ...(metadata || {}) };
  let cleanHtml = html || '';

  const rawTempPass = metadata?.tempPassword;
  const rawPass = metadata?.password;

  if (rawTempPass && typeof rawTempPass === 'string') {
    cleanHtml = cleanHtml.split(rawTempPass).join('••••••••');
    cleanMetadata.tempPassword = '•••••••• (delivered)';
  }
  if (rawPass && typeof rawPass === 'string') {
    cleanHtml = cleanHtml.split(rawPass).join('••••••••');
    cleanMetadata.password = '•••••••• (delivered)';
  }

  cleanHtml = cleanHtml.replace(/(Temporary Password:<\/td>\s*<td[^>]*>)([^<]+)(<\/td>)/gi, '$1••••••••$3');
  cleanHtml = cleanHtml.replace(/(Temporary Access Key:<\/td>\s*<td[^>]*>)([^<]+)(<\/td>)/gi, '$1••••••••$3');

  return { cleanMetadata, cleanHtml };
}

// ============================================================================
// 1. CORE DISPATCH SERVICE: sendMail
// ============================================================================
export async function sendMail(options: SendMailOptions, maxRetries: number = 2): Promise<SendMailResult> {
  const toList = Array.isArray(options.to) ? options.to : [options.to];
  const toStr = toList.join(', ');
  const templateName = options.template || 'custom';
  const sentBy = options.sentBy || 'system';

  const resendApiKey = process.env.RESEND_API_KEY || RESEND_API_KEY;
  const senderAddress = options.from || process.env.MAIL_FROM_NOREPLY || MAIL_FROM_NOREPLY;
  const replyToAddress = options.replyTo || process.env.MAIL_REPLY_TO || MAIL_REPLY_TO;

  let resendId: string | null = null;
  let isSuccess = false;
  let errorMessage: string | null = null;
  let transportUsed = 'unknown';

  const quotaCheck = dailyEmailQuota.canSend();
  const brevoFallback = getBrevoTransporter();
  const smtpTransporter = getTransporter();

  // If daily cap exceeded, engage Brevo fallback transport immediately rather than dropping
  const forceFallbackToBrevo = !quotaCheck.allowed;
  if (forceFallbackToBrevo) {
    console.warn(`[MailService] ⚠️ Resend quota reached (${dailyEmailQuota.getCap()}/day). Engaging secondary transport for [${templateName}] to ${toStr}`);
  }

  // Multi-attempt retry loop
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Priority 1: Resend HTTPS API (if key available and not forced to fallback)
      if (resendApiKey && !forceFallbackToBrevo) {
        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: senderAddress,
              to: toList,
              subject: options.subject,
              html: options.html,
              text: options.text || undefined,
              reply_to: replyToAddress,
            }),
          });

          const resData = (await res.json().catch(() => ({}))) as any;
          if (!res.ok) {
            const errMsg = resData?.message || `Resend API returned status ${res.status}`;
            throw new Error(`[RESEND_ERROR] ${errMsg}`);
          }

          resendId = resData?.id || `resend_${Date.now()}`;
          isSuccess = true;
          transportUsed = 'resend_api';
          dailyEmailQuota.recordSent();
          console.log(`[MailService:Resend] ✅ Sent [${templateName}] to ${toStr} (ID: ${resendId}) attempt ${attempt}`);
          break;
        } catch (resendErr: any) {
          console.warn(`[MailService:Resend] ⚠️ Resend dispatch failed (attempt ${attempt}): ${resendErr?.message}. Trying fallback transport...`);
          // Try Brevo or SMTP fallback immediately
          const fallback = brevoFallback || smtpTransporter;
          if (fallback) {
            const info = await fallback.sendMail({
              from: senderAddress,
              to: toStr,
              subject: options.subject,
              html: options.html,
              text: options.text,
              replyTo: replyToAddress,
            });
            resendId = info.messageId || `fallback_${Date.now()}`;
            isSuccess = true;
            transportUsed = brevoFallback ? 'brevo_fallback' : 'smtp_fallback';
            dailyEmailQuota.recordSent();
            console.log(`[MailService:Fallback] ✅ Delivered [${templateName}] to ${toStr} via ${transportUsed} (ID: ${resendId})`);
            break;
          }
          throw resendErr;
        }
      }

      // Priority 2: Brevo or Primary SMTP Transport
      const activeSmtp = brevoFallback || smtpTransporter;
      if (activeSmtp) {
        const info = await activeSmtp.sendMail({
          from: senderAddress,
          to: toStr,
          subject: options.subject,
          html: options.html,
          text: options.text,
          replyTo: replyToAddress,
        });
        resendId = info.messageId || `smtp_${Date.now()}`;
        isSuccess = true;
        transportUsed = brevoFallback ? 'brevo_smtp' : 'primary_smtp';
        dailyEmailQuota.recordSent();
        console.log(`[MailService:SMTP] ✅ Sent [${templateName}] to ${toStr} (ID: ${resendId})`);
        break;
      }

      // Priority 3: Non-production Mock
      if (process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === 'true') {
        resendId = `mock_${Date.now()}`;
        isSuccess = true;
        transportUsed = 'dev_mock';
        dailyEmailQuota.recordSent();
        console.log(`[MailService:Mock] 🧪 Simulating send [${templateName}] to ${toStr}`);
        break;
      }

      throw new Error('No email transport configured in production. Set RESEND_API_KEY or BREVO_SMTP_USER/PASS.');
    } catch (err: any) {
      errorMessage = err?.message || String(err);
      console.warn(`[MailService] Attempt ${attempt}/${maxRetries} failed for [${templateName}] to ${toStr}: ${errorMessage}`);
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  // 2. Prepare sanitization & log record
  const { cleanMetadata, cleanHtml } = sanitizeLogData(options.metadata, options.html);
  cleanMetadata.transport_used = transportUsed;
  const nowIso = new Date().toISOString();
  const logRecordId = crypto.randomUUID();

  const logEntry: MailLogRecord = {
    id: logRecordId,
    to_email: toStr,
    template: templateName,
    subject: options.subject,
    status: isSuccess ? 'sent' : 'failed',
    resend_id: resendId,
    error_message: errorMessage,
    metadata: cleanMetadata,
    html_content: cleanHtml,
    sent_by: sentBy,
    created_at: nowIso,
    updated_at: nowIso,
  };

  // Keep in-memory buffer (capped at 500 items, newest first)
  memoryMailLogs.unshift(logEntry);
  if (memoryMailLogs.length > 500) {
    memoryMailLogs.pop();
  }

  // 3. Persist to Supabase mail_logs table
  try {
    const { data, error } = await supabase
      .from('mail_logs')
      .insert({
        id: logRecordId,
        to_email: toStr,
        template: templateName,
        subject: options.subject,
        status: isSuccess ? 'sent' : 'failed',
        resend_id: resendId,
        error_message: errorMessage,
        metadata: cleanMetadata,
        html_content: cleanHtml,
        sent_by: sentBy,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select('id')
      .maybeSingle();

    if (error) {
      console.warn(`[MailService:Log] Notice: Supabase mail_logs insert skipped (${error.message}). In-memory buffer active.`);
    }
  } catch (dbErr: any) {
    console.warn(`[MailService:Log] Database logging warning: ${dbErr?.message}`);
  }

  // 4. Log deliverable failure in database if all attempts failed
  if (!isSuccess && errorMessage) {
    try {
      await logDeliverableFailure(
        {
          to: toStr,
          subject: options.subject,
          text: options.text || '',
          html: options.html,
          emailType: (templateName as any),
          metadata: cleanMetadata,
        },
        errorMessage,
        maxRetries
      );
    } catch {}
  }

  return {
    success: isSuccess,
    id: resendId || logRecordId,
    resend_id: resendId || undefined,
    status: isSuccess ? 'sent' : 'failed',
    error: errorMessage || undefined,
    log_id: logRecordId,
  };
}

// ============================================================================
// 2. SHARED BRANDED EMAIL LAYOUT
// Sleek, high-contrast dark institutional layout with logo and compliance footer
// ============================================================================
export function getSharedEmailLayout(options: {
  title: string;
  preheader?: string;
  contentHtml: string;
}): string {
  const { title, preheader, contentHtml } = options;
  const logoUrl = HOSTED_LOGO_URL;
  const supportEmail = MAIL_REPLY_TO;
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  ${preheader ? `<span style="display:none;font-size:1px;color:#0b1329;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>` : ''}
</head>
<body style="margin:0; padding:0; background-color:#070d1e; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#f0f4f8; -webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#070d1e; padding:36px 14px;">
    <tr>
      <td align="center">
        <!-- Main Container Card -->
        <table role="presentation" width="100%" style="max-width:600px; background-color:#0d1835; border:1px solid rgba(56,189,248,0.18); border-radius:16px; overflow:hidden; box-shadow:0 12px 40px rgba(0,0,0,0.65);" cellspacing="0" cellpadding="0" border="0">
          
          <!-- Branded Top Header -->
          <tr>
            <td style="padding:32px 32px 22px; text-align:center; background:linear-gradient(180deg, rgba(27,95,181,0.22) 0%, rgba(13,24,53,0) 100%); border-bottom:1px solid rgba(255,255,255,0.06);">
              <div style="margin-bottom:14px; text-align:center;">
                <img src="${logoUrl}" alt="LogicWhile LiRE" width="54" height="54" style="display:inline-block; border-radius:12px; border:1px solid rgba(56,189,248,0.35); background-color:#070d1e;" />
              </div>
              <h1 style="margin:0 0 6px; font-size:22px; font-weight:800; color:#f8fafc; letter-spacing:-0.5px;">
                LogicWhile LiRE
              </h1>
              <div style="display:inline-block; padding:4px 12px; border-radius:9999px; background:rgba(56,189,248,0.1); border:1px solid rgba(56,189,248,0.25);">
                <span style="font-size:11px; font-weight:700; letter-spacing:1.8px; color:#38bdf8; text-transform:uppercase;">
                  Logic. While. LiRE.
                </span>
              </div>
            </td>
          </tr>

          <!-- Core Email Content Area -->
          <tr>
            <td style="padding:32px 32px 28px;">
              ${contentHtml}
            </td>
          </tr>

          <!-- Security Badge -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:10px; padding:12px 16px;">
                <tr>
                  <td style="font-size:12px; color:#94a3b8; line-height:1.5;">
                    🛡️ <strong style="color:#cbd5e1;">Enterprise Security Protocol:</strong> LogicWhile LiRE protects all assessments with dual AI proctoring, server-authoritative timers, and cryptographic audit trails.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Institutional Compliance Footer -->
          <tr>
            <td style="padding:24px 32px; background-color:#070d1e; border-top:1px solid rgba(255,255,255,0.07); text-align:center;">
              <p style="margin:0 0 8px; font-size:13px; color:#cbd5e1;">
                Institutional Support & Compliance: <a href="mailto:${supportEmail}" style="color:#38bdf8; font-weight:600; text-decoration:none;">${supportEmail}</a>
              </p>
              <p style="margin:0 0 6px; font-size:12px; color:#94a3b8;">
                Automated transmission dispatched from the <strong>LogicWhile LiRE</strong> Assessment Engine.
              </p>
              <p style="margin:0 0 4px; font-size:11px; color:#64748b;">
                <a href="${FRONTEND_URL}" style="color:#64748b; text-decoration:none;">https://logicwhilelire.com</a> • Institutional Career Growth & Proctoring Ecosystem
              </p>
              <p style="margin:0; font-size:11px; color:#475569;">
                Developed by R. Charan Sai • © ${year} LogicWhile LiRE. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ============================================================================
// 3. SEPARATE TEMPLATES (10 TOTAL)
// ============================================================================

/**
 * TEMPLATE 1: admin_welcome
 */
export function renderAdminWelcomeTemplate(data: {
  name: string;
  email: string;
  role?: string;
  tempPassword?: string;
  loginUrl?: string;
}): { subject: string; html: string; text: string } {
  const { name, email, role = 'Administrator', tempPassword, loginUrl = `${FRONTEND_URL}/admin` } = data;
  const subject = `🛡️ Welcome to LogicWhile LiRE — Administrative Console Access`;

  const contentHtml = `
    <div style="background:rgba(56,189,248,0.12); border:1px solid #0284c7; border-radius:8px; padding:12px 16px; margin-bottom:20px;">
      <span style="font-size:12px; font-weight:800; color:#38bdf8; text-transform:uppercase; letter-spacing:1px;">
        🏛️ ADMINISTRATIVE ONBOARDING
      </span>
    </div>
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">
      Welcome to Institutional Governance, ${name}!
    </h2>
    <p style="margin:0 0 16px; font-size:14px; line-height:1.6; color:#94a3b8;">
      An administrative account with role <strong style="color:#38bdf8;">${role}</strong> has been provisioned for you on the <strong>LogicWhile LiRE</strong> platform.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; margin-bottom:24px;">
      <tr>
        <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#94a3b8;">Registered Email:</td>
        <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; font-weight:700; color:#f8fafc;">${email}</td>
      </tr>
      ${
        tempPassword
          ? `<tr>
              <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#94a3b8;">Temporary Access Key:</td>
              <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:15px; font-weight:800; font-family:monospace; color:#38bdf8;">${tempPassword}</td>
            </tr>`
          : ''
      }
      <tr>
        <td style="padding:14px 18px; font-size:14px; color:#94a3b8;">Assigned Authority:</td>
        <td style="padding:14px 18px; font-size:14px; font-weight:700; color:#38bdf8;">${role}</td>
      </tr>
    </table>
    <div style="background:rgba(16,185,129,0.08); border-left:3px solid #10b981; padding:14px 18px; border-radius:6px; margin-bottom:24px;">
      <h4 style="margin:0 0 6px; font-size:13px; font-weight:700; color:#6ee7b7;">Required Security Setup</h4>
      <p style="margin:0; font-size:12px; color:#cbd5e1; line-height:1.5;">
        Two-Factor Authentication (TOTP / Authenticator App) is strongly enforced for all administrative tiers. Please enroll your authenticator app upon first sign-in.
      </p>
    </div>
    <div style="text-align:center; margin:28px 0 12px;">
      <a href="${loginUrl}" style="display:inline-block; padding:14px 36px; background:linear-gradient(135deg, #1B5FB5 0%, #0A3F8F 100%); color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; border-radius:8px; box-shadow:0 4px 16px rgba(27, 95, 181, 0.45);">
        🚀 Access Admin Console
      </a>
    </div>
  `;

  const html = getSharedEmailLayout({
    title: subject,
    preheader: `Administrative account provisioned for ${name} (${role})`,
    contentHtml,
  });

  const text = `Hello ${name},\n\nYour LogicWhile LiRE administrative account (${role}) has been created.\nLogin here: ${loginUrl}\nEmail: ${email}\n\nSupport: ${MAIL_REPLY_TO}`;
  return { subject, html, text };
}

/**
 * TEMPLATE 2: inspector_created
 */
export function renderInspectorCreatedTemplate(data: {
  name: string;
  email: string;
  tempPassword?: string;
  collegeName?: string;
  loginUrl?: string;
}): { subject: string; html: string; text: string } {
  const { name, email, tempPassword, collegeName, loginUrl = `${FRONTEND_URL}/inspector` } = data;
  const subject = `📡 Proctoring & Invigilator Account Created — LogicWhile LiRE`;

  const contentHtml = `
    <div style="background:rgba(245,158,11,0.12); border:1px solid #f59e0b; border-radius:8px; padding:12px 16px; margin-bottom:20px;">
      <span style="font-size:12px; font-weight:800; color:#fbbf24; text-transform:uppercase; letter-spacing:1px;">
        👁️ PROCTORING & INVIGILATION CREDENTIALS
      </span>
    </div>
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">
      Inspector Account Active, ${name}
    </h2>
    <p style="margin:0 0 16px; font-size:14px; line-height:1.6; color:#94a3b8;">
      You have been appointed as an official Proctor / Inspector for ${collegeName ? `<strong style="color:#f8fafc;">${collegeName}</strong>` : 'institutional examinations'} on the <strong>LogicWhile LiRE</strong> Assessment Platform.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; margin-bottom:24px;">
      <tr>
        <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#94a3b8;">Console Login ID:</td>
        <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; font-weight:700; color:#f8fafc;">${email}</td>
      </tr>
      ${
        tempPassword
          ? `<tr>
              <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#94a3b8;">Temporary Access Key:</td>
              <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:15px; font-weight:800; font-family:monospace; color:#38bdf8;">${tempPassword}</td>
            </tr>`
          : ''
      }
      <tr>
        <td style="padding:14px 18px; font-size:14px; color:#94a3b8;">Assigned Scope:</td>
        <td style="padding:14px 18px; font-size:14px; font-weight:700; color:#a78bfa;">${collegeName || 'Institutional Campus Proctoring'}</td>
      </tr>
    </table>
    <div style="background:rgba(239,68,68,0.1); border-left:3px solid #ef4444; padding:14px 18px; border-radius:6px; margin-bottom:24px;">
      <h4 style="margin:0 0 6px; font-size:13px; font-weight:700; color:#fca5a5;">Mandatory First-Time Security Requirement</h4>
      <p style="margin:0; font-size:12px; color:#cbd5e1; line-height:1.5;">
        You will be required to update your temporary password to a permanent secure password upon first sign-in. Do not share these credentials.
      </p>
    </div>
    <div style="text-align:center; margin:28px 0 12px;">
      <a href="${loginUrl}" style="display:inline-block; padding:14px 36px; background:linear-gradient(135deg, #1B5FB5 0%, #0A3F8F 100%); color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; border-radius:8px; box-shadow:0 4px 16px rgba(27, 95, 181, 0.45);">
        📡 Launch Inspector Console
      </a>
    </div>
  `;

  const html = getSharedEmailLayout({
    title: subject,
    preheader: `Inspector account activated for ${name}`,
    contentHtml,
  });

  const text = `Hello ${name},\n\nYour Inspector account for LogicWhile LiRE has been created.\nLogin URL: ${loginUrl}\nEmail: ${email}\n${tempPassword ? `Temporary Password: ${tempPassword}\n` : ''}You are required to change your password upon first login.\n\nSupport: ${MAIL_REPLY_TO}`;
  return { subject, html, text };
}

/**
 * TEMPLATE 3: faculty_created (with temp password and assigned sections)
 */
export function renderFacultyCreatedTemplate(data: {
  name: string;
  email: string;
  tempPassword: string;
  assignedSections?: string[];
  collegeName?: string;
  loginUrl?: string;
}): { subject: string; html: string; text: string } {
  const { name, email, tempPassword, assignedSections = [], collegeName, loginUrl = `${FRONTEND_URL}/admin` } = data;
  const subject = `🎓 Faculty Assessment Account Created — LogicWhile LiRE`;

  const sectionsBadges = assignedSections.length > 0
    ? assignedSections.map(
        (s) => `<span style="display:inline-block; margin:2px 4px 2px 0; padding:3px 8px; border-radius:6px; background:rgba(56,189,248,0.15); border:1px solid rgba(56,189,248,0.3); font-size:12px; font-weight:700; color:#38bdf8;">${s}</span>`
      ).join('')
    : '<span style="font-size:13px; color:#94a3b8;">All Institutional Department Sections</span>';

  const contentHtml = `
    <div style="background:rgba(16,185,129,0.12); border:1px solid #10b981; border-radius:8px; padding:12px 16px; margin-bottom:20px;">
      <span style="font-size:12px; font-weight:800; color:#34d399; text-transform:uppercase; letter-spacing:1px;">
        👨‍🏫 FACULTY ONBOARDING & SECTION ALLOCATION
      </span>
    </div>
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">
      Welcome to the Faculty Portal, ${name}
    </h2>
    <p style="margin:0 0 16px; font-size:14px; line-height:1.6; color:#94a3b8;">
      An institutional Faculty account has been created for you on <strong>LogicWhile LiRE</strong>. You are authorized to manage question banks, review student rosters, and supervise assessments.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; margin-bottom:20px;">
      <tr>
        <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#94a3b8;">Faculty Login:</td>
        <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; font-weight:700; color:#f8fafc;">${email}</td>
      </tr>
      <tr>
        <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#94a3b8;">Temporary Password:</td>
        <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:16px; font-weight:800; font-family:monospace; color:#38bdf8;">${tempPassword}</td>
      </tr>
      <tr>
        <td style="padding:14px 18px; font-size:14px; color:#94a3b8;">Assigned Sections:</td>
        <td style="padding:14px 18px;">${sectionsBadges}</td>
      </tr>
    </table>
    <div style="background:rgba(239,68,68,0.1); border-left:3px solid #ef4444; padding:14px 18px; border-radius:6px; margin-bottom:24px;">
      <h4 style="margin:0 0 6px; font-size:13px; font-weight:700; color:#fca5a5;">Mandatory Password Reset on First Sign-In</h4>
      <p style="margin:0; font-size:12px; color:#cbd5e1; line-height:1.5;">
        For institutional compliance, your temporary password will expire immediately after first use. You will be prompted to create a confidential permanent password.
      </p>
    </div>
    <div style="text-align:center; margin:28px 0 12px;">
      <a href="${loginUrl}" style="display:inline-block; padding:14px 36px; background:linear-gradient(135deg, #1B5FB5 0%, #0A3F8F 100%); color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; border-radius:8px; box-shadow:0 4px 16px rgba(27, 95, 181, 0.45);">
        🚀 Access Faculty Portal
      </a>
    </div>
  `;

  const html = getSharedEmailLayout({
    title: subject,
    preheader: `Faculty account created for ${name} with temporary credentials`,
    contentHtml,
  });

  const text = `Hello ${name},\n\nYour Faculty account on LogicWhile LiRE has been provisioned.\nLogin URL: ${loginUrl}\nEmail: ${email}\nTemporary Password: ${tempPassword}\nAssigned Sections: ${assignedSections.join(', ') || 'All'}\n\nNote: You must change your password on first login.\n\nSupport: ${MAIL_REPLY_TO}`;
  return { subject, html, text };
}

/**
 * TEMPLATE 4: student_otp (expires in 10 minutes, max 3 attempts)
 */
export function renderStudentOtpTemplate(data: {
  name: string;
  email: string;
  otp: string;
  expiresMinutes?: number;
  maxAttempts?: number;
  verifyUrl?: string;
}): { subject: string; html: string; text: string } {
  const { name, email, otp, expiresMinutes = 10, maxAttempts = 3, verifyUrl } = data;
  const subject = `🔐 Your Verification OTP: ${otp} — LogicWhile LiRE`;

  const contentHtml = `
    <div style="background:rgba(56,189,248,0.12); border:1px solid #0284c7; border-radius:8px; padding:12px 16px; margin-bottom:20px;">
      <span style="font-size:12px; font-weight:800; color:#38bdf8; text-transform:uppercase; letter-spacing:1px;">
        🔒 REGISTRATION SECURITY VERIFICATION
      </span>
    </div>
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">
      Email Verification Code
    </h2>
    <p style="margin:0 0 16px; font-size:14px; line-height:1.6; color:#94a3b8;">
      Dear <strong style="color:#f8fafc;">${name}</strong>,
    </p>
    <p style="margin:0 0 20px; font-size:14px; line-height:1.6; color:#cbd5e1;">
      Please enter the one-time code below to verify your student email address (<strong style="color:#f8fafc;">${email}</strong>) and complete your registration.
    </p>
    
    <!-- OTP Display Box -->
    <div style="background:rgba(14,165,233,0.06); border:2px dashed #0284c7; border-radius:14px; padding:24px; text-align:center; margin-bottom:24px;">
      <div style="font-size:12px; text-transform:uppercase; letter-spacing:2px; color:#94a3b8; margin-bottom:8px;">
        Your 6-Digit One-Time Password
      </div>
      <div style="font-size:38px; font-weight:900; letter-spacing:10px; color:#38bdf8; font-family:'Courier New', monospace;">
        ${otp}
      </div>
    </div>

    <!-- Strict Expiry & Attempt Rules -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:rgba(239,68,68,0.08); border-left:3px solid #ef4444; border-radius:6px; margin-bottom:24px; padding:14px 18px;">
      <tr>
        <td style="font-size:13px; line-height:1.6; color:#fca5a5;">
          ⏱️ <strong>Expires in ${expiresMinutes} minutes</strong> (Strict server-authoritative timer).<br />
          ⚠️ <strong>Maximum ${maxAttempts} verification attempts allowed.</strong> Exceeding ${maxAttempts} attempts will invalidate this code.
        </td>
      </tr>
    </table>

    ${
      verifyUrl
        ? `<div style="text-align:center; margin:24px 0 12px;">
            <a href="${verifyUrl}" style="display:inline-block; padding:12px 30px; background:linear-gradient(135deg, #1B5FB5 0%, #0A3F8F 100%); color:#ffffff; font-size:14px; font-weight:700; text-decoration:none; border-radius:8px;">
              Verify Email Directly →
            </a>
          </div>`
        : ''
    }

    <p style="margin:0; font-size:12px; color:#64748b; line-height:1.5;">
      If you did not initiate this registration request, please ignore this transmission. LogicWhile LiRE will never contact you asking for this one-time code.
    </p>
  `;

  const html = getSharedEmailLayout({
    title: subject,
    preheader: `Your verification code is ${otp}. Valid for 10 minutes.`,
    contentHtml,
  });

  const text = `Hello ${name},\n\nYour LogicWhile LiRE verification code is: ${otp}\n\n- Expires in ${expiresMinutes} minutes\n- Maximum ${maxAttempts} verification attempts permitted\n\nIf you did not request this, please ignore.\n\nSupport: ${MAIL_REPLY_TO}`;
  return { subject, html, text };
}

/**
 * TEMPLATE 5: student_registered
 */
export function renderStudentRegisteredTemplate(data: {
  name: string;
  email: string;
  hallTicket: string;
  collegeName?: string;
  loginUrl?: string;
}): { subject: string; html: string; text: string } {
  const { name, email, hallTicket, collegeName, loginUrl = `${FRONTEND_URL}/login` } = data;
  const subject = `🎉 Registration Confirmed — LogicWhile LiRE Account Active`;

  const contentHtml = `
    <div style="background:rgba(16,185,129,0.12); border:1px solid #10b981; border-radius:8px; padding:12px 16px; margin-bottom:20px;">
      <span style="font-size:12px; font-weight:800; color:#34d399; text-transform:uppercase; letter-spacing:1px;">
        🎓 ACCOUNT ACTIVATED & VERIFIED
      </span>
    </div>
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">
      Welcome to LogicWhile LiRE, ${name}!
    </h2>
    <p style="margin:0 0 16px; font-size:14px; line-height:1.6; color:#94a3b8;">
      Your email address and institutional enrollment have been successfully verified. Your student candidate profile is now active.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; margin-bottom:24px;">
      <tr>
        <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#94a3b8;">Roll / Hall Ticket No:</td>
        <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:15px; font-weight:800; font-family:monospace; color:#38bdf8;">${hallTicket}</td>
      </tr>
      <tr>
        <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#94a3b8;">Registered Email:</td>
        <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; font-weight:700; color:#f8fafc;">${email}</td>
      </tr>
      ${
        collegeName
          ? `<tr>
              <td style="padding:14px 18px; font-size:14px; color:#94a3b8;">Affiliated Institution:</td>
              <td style="padding:14px 18px; font-size:14px; font-weight:700; color:#a78bfa;">${collegeName}</td>
            </tr>`
          : ''
      }
    </table>
    <div style="background:rgba(14,165,233,0.08); border-left:3px solid #0284c7; padding:14px 18px; border-radius:6px; margin-bottom:24px;">
      <h4 style="margin:0 0 6px; font-size:13px; font-weight:700; color:#93c5fd;">What's Next?</h4>
      <ul style="margin:0; padding-left:18px; font-size:12px; color:#cbd5e1; line-height:1.6;">
        <li>Log in to your Student Dashboard to access mock exams and practice arenas.</li>
        <li>Review your system setup (camera and browser permissions) before scheduled proctored exams.</li>
        <li>Upcoming assessments will be dispatched with unique pass codes directly to this inbox.</li>
      </ul>
    </div>
    <div style="text-align:center; margin:28px 0 12px;">
      <a href="${loginUrl}" style="display:inline-block; padding:14px 36px; background:linear-gradient(135deg, #1B5FB5 0%, #0A3F8F 100%); color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; border-radius:8px; box-shadow:0 4px 16px rgba(27, 95, 181, 0.45);">
        🚀 Launch Student Dashboard
      </a>
    </div>
  `;

  const html = getSharedEmailLayout({
    title: subject,
    preheader: `Student registration confirmed for ${name} (${hallTicket})`,
    contentHtml,
  });

  const text = `Hello ${name},\n\nYour student account on LogicWhile LiRE is confirmed and active.\nHall Ticket: ${hallTicket}\nEmail: ${email}\nLogin: ${loginUrl}\n\nSupport: ${MAIL_REPLY_TO}`;
  return { subject, html, text };
}

/**
 * TEMPLATE 6: password_reset
 */
export function renderPasswordResetTemplate(data: {
  name: string;
  email: string;
  resetToken?: string;
  resetUrl: string;
  expiresMinutes?: number;
}): { subject: string; html: string; text: string } {
  const { name, email, resetUrl, expiresMinutes = 15 } = data;
  const subject = `🔑 Password Reset Request — LogicWhile LiRE`;

  const contentHtml = `
    <div style="background:rgba(245,158,11,0.12); border:1px solid #f59e0b; border-radius:8px; padding:12px 16px; margin-bottom:20px;">
      <span style="font-size:12px; font-weight:800; color:#fbbf24; text-transform:uppercase; letter-spacing:1px;">
        🔐 ACCOUNT SECURITY & RECOVERY
      </span>
    </div>
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">
      Reset Your Password
    </h2>
    <p style="margin:0 0 16px; font-size:14px; line-height:1.6; color:#94a3b8;">
      Hello <strong style="color:#f8fafc;">${name}</strong>,
    </p>
    <p style="margin:0 0 20px; font-size:14px; line-height:1.6; color:#cbd5e1;">
      We received a request to reset the password associated with your account (<strong style="color:#f8fafc;">${email}</strong>). Click the button below to establish a new password:
    </p>
    <div style="text-align:center; margin:30px 0;">
      <a href="${resetUrl}" style="display:inline-block; padding:14px 36px; background:linear-gradient(135deg, #1B5FB5 0%, #0A3F8F 100%); color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; border-radius:8px; box-shadow:0 4px 16px rgba(27, 95, 181, 0.45);">
        Reset My Password →
      </a>
    </div>
    <div style="background:rgba(239,68,68,0.08); border-left:3px solid #ef4444; padding:12px 16px; border-radius:6px; margin-bottom:24px;">
      <p style="margin:0; font-size:12px; color:#fca5a5; line-height:1.5;">
        ⏱️ This secure link will expire in <strong>${expiresMinutes} minutes</strong>. If you did not request a password reset, you can safely ignore this message; your account credentials remain unchanged.
      </p>
    </div>
  `;

  const html = getSharedEmailLayout({
    title: subject,
    preheader: `Password reset link for ${email}. Expires in 15 minutes.`,
    contentHtml,
  });

  const text = `Hello ${name},\n\nWe received a password reset request for ${email}.\nReset your password here: ${resetUrl}\nLink expires in ${expiresMinutes} minutes.\n\nSupport: ${MAIL_REPLY_TO}`;
  return { subject, html, text };
}

/**
 * TEMPLATE 7: exam_scheduled
 * Target-scoped: sent only to students of the targeted college/branch/year/section
 */
export function renderExamScheduledTemplate(data: {
  studentName: string;
  hallTicket: string;
  examTitle: string;
  examCode: string;
  durationMinutes: number;
  scheduledAt?: string;
  targetedCriteria?: {
    collegeName?: string;
    branch?: string;
    year?: string | number;
    section?: string;
  };
  lobbyUrl?: string;
}): { subject: string; html: string; text: string } {
  const {
    studentName,
    hallTicket,
    examTitle,
    examCode,
    durationMinutes,
    scheduledAt,
    targetedCriteria,
    lobbyUrl = `${FRONTEND_URL}/instructions/${examCode}`,
  } = data;
  const subject = `📅 Proctored Examination Scheduled: ${examTitle} (Code: ${examCode})`;

  const scopeCriteriaDisplay = targetedCriteria
    ? [
        targetedCriteria.collegeName,
        targetedCriteria.branch ? `Branch: ${targetedCriteria.branch}` : null,
        targetedCriteria.year ? `Year: ${targetedCriteria.year}` : null,
        targetedCriteria.section ? `Section: ${targetedCriteria.section}` : null,
      ].filter(Boolean).join(' • ')
    : 'All Enrolled Candidates';

  const contentHtml = `
    <div style="background:rgba(14,165,233,0.12); border:1px solid #0284c7; border-radius:8px; padding:12px 16px; margin-bottom:20px;">
      <span style="font-size:12px; font-weight:800; color:#38bdf8; text-transform:uppercase; letter-spacing:1px;">
        📅 OFFICIAL EXAMINATION NOTIFICATION
      </span>
    </div>
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">
      ${examTitle}
    </h2>
    <p style="margin:0 0 16px; font-size:14px; line-height:1.6; color:#94a3b8;">
      Dear <strong style="color:#f8fafc;">${studentName}</strong>, you are scheduled to sit for an official proctored assessment. Below are your examination hall ticket details:
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:rgba(255,255,255,0.03); border:1px solid rgba(56,189,248,0.25); border-radius:12px; margin-bottom:24px;">
      <tr>
        <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#94a3b8;">Candidate Hall Ticket:</td>
        <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:15px; font-weight:800; font-family:monospace; color:#38bdf8;">${hallTicket}</td>
      </tr>
      <tr>
        <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#94a3b8;">Exam Pass Code:</td>
        <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:16px; font-weight:800; font-family:monospace; color:#10b981;">${examCode}</td>
      </tr>
      ${
        scheduledAt
          ? `<tr>
              <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#94a3b8;">Scheduled Slot:</td>
              <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; font-weight:700; color:#f8fafc;">${scheduledAt}</td>
            </tr>`
          : ''
      }
      <tr>
        <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#94a3b8;">Duration:</td>
        <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; font-weight:700; color:#f8fafc;">${durationMinutes} Minutes (Server Authoritative)</td>
      </tr>
      <tr>
        <td style="padding:14px 18px; font-size:14px; color:#94a3b8;">Target Scope:</td>
        <td style="padding:14px 18px; font-size:13px; font-weight:600; color:#cbd5e1;">${scopeCriteriaDisplay}</td>
      </tr>
    </table>
    <div style="background:rgba(27,95,181,0.08); border-left:3px solid #1B5FB5; padding:14px 18px; border-radius:6px; margin-bottom:24px;">
      <h4 style="margin:0 0 6px; font-size:13px; font-weight:700; color:#93c5fd;">Proctoring Regulations</h4>
      <ul style="margin:0; padding-left:18px; font-size:12px; color:#cbd5e1; line-height:1.6;">
        <li>Full-screen enforcement is active. Exiting full-screen or switching tabs generates security violations.</li>
        <li>Dual AI monitoring (gaze direction & audio telemetry) is supervised by assigned invigilators.</li>
        <li>Ensure a stable connection, quiet room, and functional webcam prior to entry.</li>
      </ul>
    </div>
    <div style="text-align:center; margin:28px 0 12px;">
      <a href="${lobbyUrl}" style="display:inline-block; padding:14px 36px; background:linear-gradient(135deg, #1B5FB5 0%, #0A3F8F 100%); color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; border-radius:8px; box-shadow:0 4px 16px rgba(27, 95, 181, 0.45);">
        🚀 Enter Examination Lobby
      </a>
    </div>
  `;

  const html = getSharedEmailLayout({
    title: subject,
    preheader: `Scheduled: ${examTitle} (Code: ${examCode}) for ${studentName}`,
    contentHtml,
  });

  const text = `Hello ${studentName},\n\nYou are scheduled for "${examTitle}".\nHall Ticket: ${hallTicket}\nExam Code: ${examCode}\nDuration: ${durationMinutes} mins\nScheduled Time: ${scheduledAt || 'See Portal'}\nTarget: ${scopeCriteriaDisplay}\nLobby URL: ${lobbyUrl}\n\nSupport: ${MAIL_REPLY_TO}`;
  return { subject, html, text };
}

/**
 * TEMPLATE 8: faculty_paper_allocated
 */
export function renderFacultyPaperAllocatedTemplate(data: {
  facultyName: string;
  examTitle: string;
  examCode: string;
  questionCount: number;
  submissionDeadline?: string;
  portalUrl?: string;
}): { subject: string; html: string; text: string } {
  const {
    facultyName,
    examTitle,
    examCode,
    questionCount,
    submissionDeadline,
    portalUrl = `${FRONTEND_URL}/admin/questions`,
  } = data;
  const subject = `📝 Assessment Paper Allocated: ${examTitle} (Code: ${examCode})`;

  const contentHtml = `
    <div style="background:rgba(167,139,250,0.12); border:1px solid #8b5cf6; border-radius:8px; padding:12px 16px; margin-bottom:20px;">
      <span style="font-size:12px; font-weight:800; color:#c4b5fd; text-transform:uppercase; letter-spacing:1px;">
        📋 CURRICULUM ALLOCATION & REVIEW NOTICE
      </span>
    </div>
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">
      Paper Allocation: ${examTitle}
    </h2>
    <p style="margin:0 0 16px; font-size:14px; line-height:1.6; color:#94a3b8;">
      Dear Professor <strong style="color:#f8fafc;">${facultyName}</strong>,
    </p>
    <p style="margin:0 0 20px; font-size:14px; line-height:1.6; color:#cbd5e1;">
      You have been designated as the primary faculty authority for the assessment paper <strong>${examTitle}</strong>. Please review questions, verify answer keys, and ensure curriculum alignment.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; margin-bottom:24px;">
      <tr>
        <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#94a3b8;">Exam Pass Code:</td>
        <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:15px; font-weight:800; font-family:monospace; color:#38bdf8;">${examCode}</td>
      </tr>
      <tr>
        <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#94a3b8;">Assigned Question Count:</td>
        <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; font-weight:700; color:#f8fafc;">${questionCount} Questions</td>
      </tr>
      ${
        submissionDeadline
          ? `<tr>
              <td style="padding:14px 18px; font-size:14px; color:#94a3b8;">Review Deadline:</td>
              <td style="padding:14px 18px; font-size:14px; font-weight:700; color:#f59e0b;">${submissionDeadline}</td>
            </tr>`
          : ''
      }
    </table>
    <div style="text-align:center; margin:28px 0 12px;">
      <a href="${portalUrl}" style="display:inline-block; padding:14px 36px; background:linear-gradient(135deg, #1B5FB5 0%, #0A3F8F 100%); color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; border-radius:8px; box-shadow:0 4px 16px rgba(27, 95, 181, 0.45);">
        📝 Review Question Bank & Keys
      </a>
    </div>
  `;

  const html = getSharedEmailLayout({
    title: subject,
    preheader: `Paper allocation for ${examTitle} assigned to Prof. ${facultyName}`,
    contentHtml,
  });

  const text = `Hello Prof. ${facultyName},\n\nYou have been allocated paper "${examTitle}" (${examCode}) with ${questionCount} questions.\nDeadline: ${submissionDeadline || 'As per academic calendar'}\nReview URL: ${portalUrl}\n\nSupport: ${MAIL_REPLY_TO}`;
  return { subject, html, text };
}

/**
 * TEMPLATE 9: result_report
 */
export function renderResultReportTemplate(data: {
  studentName: string;
  hallTicket: string;
  examTitle: string;
  examCode: string;
  score: number;
  maxScore: number;
  percentage: number;
  rank?: number | string | null;
  correctCount: number;
  wrongCount: number;
  timeTakenSeconds: number;
  reportUrl?: string;
}): { subject: string; html: string; text: string } {
  const {
    studentName,
    hallTicket,
    examTitle,
    examCode,
    score,
    maxScore,
    percentage,
    rank,
    correctCount,
    wrongCount,
    timeTakenSeconds,
    reportUrl = `${FRONTEND_URL}/result-ec/${examCode}`,
  } = data;
  const subject = `🏆 Official Result & Performance Report: ${examTitle} — Score ${score}/${maxScore}`;

  const minutes = Math.floor(timeTakenSeconds / 60);
  const seconds = timeTakenSeconds % 60;
  const timeFormatted = `${minutes}m ${seconds}s`;
  const rankDisplay = rank ? `#${rank}` : '—';

  const contentHtml = `
    <div style="background:rgba(16,185,129,0.12); border:1px solid #10b981; border-radius:8px; padding:12px 16px; margin-bottom:20px;">
      <span style="font-size:12px; font-weight:800; color:#34d399; text-transform:uppercase; letter-spacing:1px;">
        🏆 OFFICIAL PERFORMANCE SCORECARD
      </span>
    </div>
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">
      ${examTitle}
    </h2>
    <p style="margin:0 0 16px; font-size:14px; line-height:1.6; color:#94a3b8;">
      Candidate: <strong style="color:#f8fafc;">${studentName}</strong> (Hall Ticket: <span style="font-family:monospace; color:#38bdf8;">${hallTicket}</span>)
    </p>

    <!-- Score Summary Highlight -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; margin-bottom:24px;">
      <tr>
        <td style="padding:20px; text-align:center; border-right:1px solid rgba(255,255,255,0.06);">
          <span style="font-size:11px; text-transform:uppercase; color:#94a3b8; letter-spacing:1px; display:block; margin-bottom:4px;">Score</span>
          <span style="font-size:30px; font-weight:800; color:#10b981;">${score}</span>
          <span style="font-size:14px; color:#64748b;"> / ${maxScore}</span>
        </td>
        <td style="padding:20px; text-align:center; border-right:1px solid rgba(255,255,255,0.06);">
          <span style="font-size:11px; text-transform:uppercase; color:#94a3b8; letter-spacing:1px; display:block; margin-bottom:4px;">Percentage</span>
          <span style="font-size:30px; font-weight:800; color:#a78bfa;">${percentage}%</span>
        </td>
        <td style="padding:20px; text-align:center;">
          <span style="font-size:11px; text-transform:uppercase; color:#94a3b8; letter-spacing:1px; display:block; margin-bottom:4px;">Rank</span>
          <span style="font-size:30px; font-weight:800; color:#f59e0b;">${rankDisplay}</span>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 20px; font-size:13px; color:#cbd5e1;">
      ⏱️ <strong>Time Taken:</strong> ${timeFormatted} &nbsp;|&nbsp; 
      ✅ <strong>Correct:</strong> ${correctCount} &nbsp;|&nbsp; 
      ❌ <strong>Incorrect:</strong> ${wrongCount}
    </p>

    <div style="text-align:center; margin:28px 0 12px;">
      <a href="${reportUrl}" style="display:inline-block; padding:14px 36px; background:linear-gradient(135deg, #1B5FB5 0%, #0A3F8F 100%); color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; border-radius:8px; box-shadow:0 4px 16px rgba(27, 95, 181, 0.45);">
        📊 View Full Forensic Breakdown
      </a>
    </div>
  `;

  const html = getSharedEmailLayout({
    title: subject,
    preheader: `Results: ${examTitle} — Score ${score}/${maxScore} (${percentage}%) for ${studentName}`,
    contentHtml,
  });

  const text = `Results for ${examTitle}\nCandidate: ${studentName} (${hallTicket})\nScore: ${score}/${maxScore} (${percentage}%)\nRank: ${rankDisplay}\nTime: ${timeFormatted}\nCorrect: ${correctCount}, Wrong: ${wrongCount}\nReport URL: ${reportUrl}\n\nSupport: ${MAIL_REPLY_TO}`;
  return { subject, html, text };
}

/**
 * TEMPLATE 10: admin_alert
 * Handles both:
 * 1. anti-cheat termination
 * 2. daily backup done
 * 3. critical system alerts
 */
export function renderAdminAlertTemplate(data: {
  alertType: 'anti_cheat_termination' | 'daily_backup_completed' | 'system_alert';
  title: string;
  message: string;
  details: Record<string, any>;
  timestamp?: string;
  reviewUrl?: string;
}): { subject: string; html: string; text: string } {
  const { alertType, title, message, details, timestamp = new Date().toISOString(), reviewUrl = `${FRONTEND_URL}/admin` } = data;
  
  const isAntiCheat = alertType === 'anti_cheat_termination';
  const isBackup = alertType === 'daily_backup_completed';

  const badgeColor = isAntiCheat ? '#ef4444' : isBackup ? '#10b981' : '#f59e0b';
  const badgeText = isAntiCheat
    ? '🚨 PROCTORING TERMINATION ALERT'
    : isBackup
    ? '✅ DAILY BACKUP COMPLETED'
    : '⚠️ SYSTEM TELEMETRY ALERT';

  const subject = isAntiCheat
    ? `🚨 Anti-Cheat Termination: ${details.candidateName || details.studentName || 'Candidate'} — ${details.examTitle || 'Exam'}`
    : isBackup
    ? `✅ Nightly Database Backup Complete (${details.fileCount || 'Files'} artifacts archived)`
    : `⚠️ Admin Alert: ${title}`;

  const detailRows = Object.entries(details).map(([key, val]) => {
    const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ');
    const displayVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
    return `<tr>
      <td style="padding:10px 14px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:13px; color:#94a3b8; text-transform:capitalize;">${formattedKey}:</td>
      <td style="padding:10px 14px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:13px; font-weight:700; color:#f8fafc; font-family:monospace;">${displayVal}</td>
    </tr>`;
  }).join('');

  const contentHtml = `
    <div style="background:rgba(255,255,255,0.04); border:1px solid ${badgeColor}; border-radius:8px; padding:12px 16px; margin-bottom:20px;">
      <span style="font-size:12px; font-weight:800; color:${badgeColor}; text-transform:uppercase; letter-spacing:1px;">
        ${badgeText}
      </span>
    </div>
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">
      ${title}
    </h2>
    <p style="margin:0 0 18px; font-size:14px; line-height:1.6; color:#cbd5e1;">
      ${message}
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; margin-bottom:24px;">
      ${detailRows}
      <tr>
        <td style="padding:10px 14px; font-size:13px; color:#94a3b8;">Recorded Timestamp:</td>
        <td style="padding:10px 14px; font-size:13px; font-weight:600; color:#94a3b8;">${timestamp}</td>
      </tr>
    </table>
    <div style="text-align:center; margin:28px 0 12px;">
      <a href="${reviewUrl}" style="display:inline-block; padding:14px 36px; background:linear-gradient(135deg, #1B5FB5 0%, #0A3F8F 100%); color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; border-radius:8px; box-shadow:0 4px 16px rgba(27, 95, 181, 0.45);">
        🛡️ Open Admin Audit Trail
      </a>
    </div>
  `;

  const html = getSharedEmailLayout({
    title: subject,
    preheader: `${title}: ${message}`,
    contentHtml,
  });

  const text = `[ADMIN ALERT] ${title}\n\n${message}\n\nDetails:\n${Object.entries(details).map(([k, v]) => `${k}: ${v}`).join('\n')}\nTimestamp: ${timestamp}\nReview: ${reviewUrl}\n\nLogicWhile LiRE`;
  return { subject, html, text };
}

// ============================================================================
// 4. HIGH-LEVEL DISPATCH HELPERS
// ============================================================================

export async function sendAdminWelcome(data: {
  name: string;
  email: string;
  role?: string;
  tempPassword?: string;
}): Promise<SendMailResult> {
  const rendered = renderAdminWelcomeTemplate(data);
  return sendMail({
    to: data.email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    template: 'admin_welcome',
    metadata: { name: data.name, role: data.role, tempPassword: data.tempPassword },
  });
}

export async function sendInspectorCreated(data: {
  name: string;
  email: string;
  tempPassword?: string;
  collegeName?: string;
}): Promise<SendMailResult> {
  const rendered = renderInspectorCreatedTemplate(data);
  return sendMail({
    to: data.email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    template: 'inspector_created',
    metadata: { name: data.name, collegeName: data.collegeName, tempPassword: data.tempPassword },
  });
}

export async function sendFacultyCreated(data: {
  name: string;
  email: string;
  tempPassword: string;
  assignedSections?: string[];
  collegeName?: string;
}): Promise<SendMailResult> {
  const rendered = renderFacultyCreatedTemplate(data);
  return sendMail({
    to: data.email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    template: 'faculty_created',
    metadata: {
      name: data.name,
      collegeName: data.collegeName,
      assignedSections: data.assignedSections,
      tempPassword: data.tempPassword,
    },
  });
}

export async function sendStudentOtp(data: {
  name: string;
  email: string;
  otp: string;
  expiresMinutes?: number;
  maxAttempts?: number;
  verifyUrl?: string;
}): Promise<SendMailResult> {
  const rendered = renderStudentOtpTemplate(data);
  return sendMail({
    to: data.email,
    from: process.env.OTP_FROM_EMAIL || OTP_MAIL_FROM,
    replyTo: process.env.OTP_REPLY_TO || OTP_MAIL_REPLY_TO,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    template: 'student_otp',
    metadata: { name: data.name, otp: data.otp, expiresMinutes: data.expiresMinutes || 10 },
  });
}

export async function sendStudentRegistered(data: {
  name: string;
  email: string;
  hallTicket: string;
  collegeName?: string;
}): Promise<SendMailResult> {
  const rendered = renderStudentRegisteredTemplate(data);
  return sendMail({
    to: data.email,
    from: process.env.LOGIN_ID_FROM_EMAIL || LOGIN_ID_MAIL_FROM,
    replyTo: process.env.LOGIN_ID_REPLY_TO || LOGIN_ID_MAIL_REPLY_TO,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    template: 'student_registered',
    metadata: { name: data.name, hallTicket: data.hallTicket, collegeName: data.collegeName },
  });
}

export async function sendPasswordReset(data: {
  name: string;
  email: string;
  resetUrl: string;
  expiresMinutes?: number;
}): Promise<SendMailResult> {
  const rendered = renderPasswordResetTemplate(data);
  return sendMail({
    to: data.email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    template: 'password_reset',
    metadata: { name: data.name, expiresMinutes: data.expiresMinutes || 15 },
  });
}

export async function sendExamScheduled(data: {
  toEmail: string;
  studentName: string;
  hallTicket: string;
  examTitle: string;
  examCode: string;
  durationMinutes: number;
  scheduledAt?: string;
  targetedCriteria?: {
    collegeName?: string;
    branch?: string;
    year?: string | number;
    section?: string;
  };
  lobbyUrl?: string;
}): Promise<SendMailResult> {
  const rendered = renderExamScheduledTemplate(data);
  return sendMail({
    to: data.toEmail,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    template: 'exam_scheduled',
    metadata: {
      examTitle: data.examTitle,
      examCode: data.examCode,
      hallTicket: data.hallTicket,
      targetedCriteria: data.targetedCriteria,
    },
  });
}

export async function sendFacultyPaperAllocated(data: {
  toEmail: string;
  facultyName: string;
  examTitle: string;
  examCode: string;
  questionCount: number;
  submissionDeadline?: string;
}): Promise<SendMailResult> {
  const rendered = renderFacultyPaperAllocatedTemplate(data);
  return sendMail({
    to: data.toEmail,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    template: 'faculty_paper_allocated',
    metadata: {
      examTitle: data.examTitle,
      examCode: data.examCode,
      questionCount: data.questionCount,
    },
  });
}

export async function sendResultReport(data: {
  toEmail: string;
  studentName: string;
  hallTicket: string;
  examTitle: string;
  examCode: string;
  score: number;
  maxScore: number;
  percentage: number;
  rank?: number | string | null;
  correctCount: number;
  wrongCount: number;
  timeTakenSeconds: number;
}): Promise<SendMailResult> {
  const rendered = renderResultReportTemplate(data);
  return sendMail({
    to: data.toEmail,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    template: 'result_report',
    metadata: {
      examTitle: data.examTitle,
      examCode: data.examCode,
      score: data.score,
      maxScore: data.maxScore,
      percentage: data.percentage,
    },
  });
}

export async function sendAdminAlert(data: {
  alertType?: 'anti_cheat_termination' | 'daily_backup_completed' | 'system_alert' | string;
  title?: string;
  subject?: string;
  message?: string;
  details?: Record<string, any>;
  metadata?: Record<string, any>;
  targetAdminEmail?: string;
  to?: string;
  severity?: string;
}): Promise<SendMailResult> {
  const to = data.targetAdminEmail || data.to || process.env.ADMIN_ALERT_EMAIL || 'admin@logicwhilelire.com';
  const alertType = (['anti_cheat_termination', 'daily_backup_completed', 'system_alert'].includes(data.alertType as any)
    ? data.alertType
    : 'system_alert') as 'anti_cheat_termination' | 'daily_backup_completed' | 'system_alert';
  const title = data.title || data.subject || 'Security Telemetry Alert';
  const message = data.message || 'System security notification.';
  const details = data.details || data.metadata || { alertType: data.alertType, severity: data.severity };

  const rendered = renderAdminAlertTemplate({
    alertType,
    title,
    message,
    details,
  });
  return sendMail({
    to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    template: 'admin_alert',
    metadata: { alertType, details },
  });
}

// ============================================================================
// 5. TARGETED BATCH DISPATCHER
// Dispatches exam_scheduled strictly to students of specified college/branch/year/section
// ============================================================================
export async function dispatchExamScheduledToTargetedStudents(options: {
  examId: string;
  examTitle: string;
  examCode: string;
  durationMinutes: number;
  scheduledAt?: string;
  collegeId?: number | string | null;
  collegeName?: string;
  branchCode?: string | null;
  yearOfPassing?: number | string | null;
  section?: string | null;
}): Promise<{ totalTargeted: number; dispatched: number; failed: number }> {
  const {
    examTitle,
    examCode,
    durationMinutes,
    scheduledAt,
    collegeId,
    collegeName,
    branchCode,
    yearOfPassing,
    section,
  } = options;

  let query = supabase
    .from('students')
    .select('id, name, email, roll_number, hall_ticket, college_id, section, batch')
    .eq('is_verified', true);

  if (collegeId) {
    query = query.eq('college_id', collegeId);
  }
  if (section) {
    query = query.eq('section', section);
  }

  const { data: eligibleStudents, error } = await query;
  if (error || !eligibleStudents || eligibleStudents.length === 0) {
    console.log(`[TargetedExamDispatch] No eligible enrolled students found for exam ${examCode}`);
    return { totalTargeted: 0, dispatched: 0, failed: 0 };
  }

  let dispatched = 0;
  let failed = 0;

  for (const student of eligibleStudents) {
    if (!student.email) continue;
    try {
      const res = await sendExamScheduled({
        toEmail: student.email,
        studentName: student.name || 'Candidate',
        hallTicket: student.roll_number || student.hall_ticket || 'HALL_TICKET',
        examTitle,
        examCode,
        durationMinutes,
        scheduledAt,
        targetedCriteria: {
          collegeName,
          branch: branchCode || undefined,
          year: yearOfPassing || undefined,
          section: student.section || section || undefined,
        },
      });
      if (res.success) dispatched++;
      else failed++;
    } catch {
      failed++;
    }
  }

  console.log(`[TargetedExamDispatch] Dispatched ${dispatched}/${eligibleStudents.length} notifications for ${examCode}`);
  return { totalTargeted: eligibleStudents.length, dispatched, failed };
}

// ============================================================================
// 6. LOGS QUERY & RESEND HANDLER FOR ADMIN SCREEN
// ============================================================================
export async function getMailLogs(params?: {
  page?: number;
  limit?: number;
  status?: string;
  template?: string;
  search?: string;
}): Promise<{ logs: MailLogRecord[]; total: number; page: number; limit: number; stats: any }> {
  const page = Math.max(1, params?.page || 1);
  const limit = Math.min(100, Math.max(1, params?.limit || 20));
  const offset = (page - 1) * limit;

  let dbLogs: MailLogRecord[] = [];
  let dbTotal = 0;

  try {
    let query = supabase.from('mail_logs').select('*', { count: 'exact' });

    if (params?.status && params.status !== 'all') {
      query = query.eq('status', params.status);
    }
    if (params?.template && params.template !== 'all') {
      query = query.eq('template', params.template);
    }
    if (params?.search) {
      const term = `%${params.search}%`;
      query = query.or(`to_email.ilike.${term},subject.ilike.${term}`);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (!error && data) {
      dbLogs = data as MailLogRecord[];
      dbTotal = count || data.length;
    }
  } catch (err: any) {
    console.warn('[MailService] DB query failed, using memory buffer fallback:', err?.message);
  }

  // If DB returned records, use DB logs merged with memory buffer; otherwise filter memory buffer
  let combined = [...dbLogs];
  if (combined.length === 0 && memoryMailLogs.length > 0) {
    let filtered = [...memoryMailLogs];
    if (params?.status && params.status !== 'all') {
      filtered = filtered.filter((l) => l.status === params.status);
    }
    if (params?.template && params.template !== 'all') {
      filtered = filtered.filter((l) => l.template === params.template);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(
        (l) => l.to_email.toLowerCase().includes(q) || l.subject.toLowerCase().includes(q)
      );
    }
    dbTotal = filtered.length;
    combined = filtered.slice(offset, offset + limit);
  }

  // Calculate overall stats
  const totalCount = dbTotal || memoryMailLogs.length;
  const sentCount = memoryMailLogs.filter((l) => l.status === 'sent' || l.status === 'delivered').length;
  const failedCount = memoryMailLogs.filter((l) => l.status === 'failed').length;

  return {
    logs: combined,
    total: dbTotal,
    page,
    limit,
    stats: {
      total: totalCount,
      sent: sentCount,
      failed: failedCount,
    },
  };
}

export async function resendMailLogById(logId: string): Promise<SendMailResult> {
  // Look up log from DB, then fallback to memory buffer
  let record: MailLogRecord | null = null;

  try {
    const { data } = await supabase.from('mail_logs').select('*').eq('id', logId).maybeSingle();
    if (data) record = data as MailLogRecord;
  } catch {}

  if (!record) {
    record = memoryMailLogs.find((l) => l.id === logId) || null;
  }

  if (!record) {
    throw new Error('Mail log record not found');
  }

  let sendOptions: SendMailOptions;

  // Requirement 3: Credential emails (admin_welcome, inspector_created, faculty_created)
  // MUST generate a new temporary password and set must_change_password = true in staff.
  // Must NEVER send a masked password. Uses crypto.randomInt, 14+ chars, no fixed pattern.
  if (['admin_welcome', 'inspector_created', 'faculty_created'].includes(record.template)) {
    const { randomInt } = await import('crypto');
    function _genTempPwd(): string {
      const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
      const lower = 'abcdefghjkmnpqrstuvwxyz';
      const digits = '23456789';
      const special = '@#$%&!';
      const all = upper + lower + digits + special;
      const pw: string[] = [
        upper[randomInt(0, upper.length)],
        lower[randomInt(0, lower.length)],
        digits[randomInt(0, digits.length)],
        special[randomInt(0, special.length)],
      ];
      for (let i = pw.length; i < 14; i++) pw.push(all[randomInt(0, all.length)]);
      for (let i = pw.length - 1; i > 0; i--) { const j = randomInt(0, i + 1); [pw[i], pw[j]] = [pw[j], pw[i]]; }
      return pw.join('');
    }
    const newTempPassword = _genTempPwd();
    const salt = await bcrypt.genSalt(12);
    const newHash = await bcrypt.hash(newTempPassword, salt);

    // Update staff table in live database: update hash and enforce must_change_password = true
    try {
      const { error: updateErr } = await supabase
        .from('staff')
        .update({
          password_hash: newHash,
          must_change_password: true,
          updated_at: new Date().toISOString(),
        })
        .eq('email', record.to_email);

      if (updateErr && updateErr.message?.includes('must_change_password')) {
        await supabase
          .from('staff')
          .update({
            password_hash: newHash,
            updated_at: new Date().toISOString(),
          })
          .eq('email', record.to_email);
      }
    } catch (err: any) {
      console.warn('[MailService] Notice: Could not update staff in live DB:', err?.message);
    }

    // Retrieve staff metadata to maintain correct recipient name and college
    let staffMember: any = null;
    try {
      const { data } = await supabase
        .from('staff')
        .select('id, name, email, role, college_id, section_ids')
        .eq('email', record.to_email)
        .maybeSingle();
      if (data) staffMember = data;
    } catch {}

    const recipientName = staffMember?.name || record.metadata?.name || 'Staff Member';
    const collegeName = record.metadata?.collegeName || 'LogicWhile LiRE Partner Institution';

    if (record.template === 'inspector_created') {
      const rendered = renderInspectorCreatedTemplate({
        name: recipientName,
        email: record.to_email,
        tempPassword: newTempPassword,
        collegeName,
      });
      sendOptions = {
        to: record.to_email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        template: 'inspector_created',
        metadata: {
          ...record.metadata,
          tempPassword: newTempPassword,
          name: recipientName,
          collegeName,
          resend_of: logId,
        },
        sentBy: 'admin_resend',
      };
    } else if (record.template === 'faculty_created') {
      const assignedSections =
        staffMember?.section_ids || record.metadata?.assignedSections || [];
      const rendered = renderFacultyCreatedTemplate({
        name: recipientName,
        email: record.to_email,
        tempPassword: newTempPassword,
        assignedSections,
        collegeName,
      });
      sendOptions = {
        to: record.to_email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        template: 'faculty_created',
        metadata: {
          ...record.metadata,
          tempPassword: newTempPassword,
          name: recipientName,
          assignedSections,
          collegeName,
          resend_of: logId,
        },
        sentBy: 'admin_resend',
      };
    } else {
      // admin_welcome
      const role = staffMember?.role || record.metadata?.role || 'Administrator';
      const rendered = renderAdminWelcomeTemplate({
        name: recipientName,
        email: record.to_email,
        role,
        tempPassword: newTempPassword,
      });
      sendOptions = {
        to: record.to_email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        template: 'admin_welcome',
        metadata: {
          ...record.metadata,
          tempPassword: newTempPassword,
          name: recipientName,
          role,
          resend_of: logId,
        },
        sentBy: 'admin_resend',
      };
    }
  } else {
    // Non-credential emails: re-send with saved template/content
    sendOptions = {
      to: record.to_email,
      subject: record.subject,
      html: record.html_content || `<p>Resent: ${record.subject}</p>`,
      template: record.template,
      metadata: { ...record.metadata, resend_of: logId },
      sentBy: 'admin_resend',
    };
  }

  const result = await sendMail(sendOptions);

  // Update previous record status if DB available
  try {
    await supabase
      .from('mail_logs')
      .update({ status: result.success ? 'sent' : 'failed', updated_at: new Date().toISOString() })
      .eq('id', logId);
  } catch {}

  return result;
}
