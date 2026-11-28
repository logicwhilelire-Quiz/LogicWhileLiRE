import bcrypt from 'bcrypt';
import { supabase } from '../db/supabase';
import { getTransporter, getBrevoTransporter, dailyEmailQuota } from './emailService';
import { systemAlertAgent } from './systemAlertService';

// ============================================================================
// CONFIGURATION & ENVIRONMENT
// ============================================================================
export const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

export const MAIL_FROM_NOREPLY =
  process.env.MAIL_FROM_NOREPLY ||
  process.env.EMAIL_FROM ||
  'LogicWhile LiRE <noreply@logicwhilelire.com>';

export const MAIL_REPLY_TO =
  process.env.MAIL_REPLY_TO ||
  process.env.SUPPORT_EMAIL ||
  'support@logicwhilelire.com';

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

export const LOGIN_ID_MAIL_FROM = process.env.LOGIN_ID_FROM_EMAIL || 'LogicWhile LiRE Inspections <inspector@logicwhilelire.com>';
export const LOGIN_ID_MAIL_REPLY_TO = process.env.LOGIN_ID_REPLY_TO || 'inspector@logicwhilelire.com';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================
export interface SendMailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html: string;
  text?: string;
  template?: string;
  metadata?: Record<string, any>;
  sentBy?: string;
  from?: string;
  replyTo?: string;
  skipForwarders?: boolean;
}

export interface MailForwarderRule {
  id: string;
  name: string;
  template: string; // 'all' | 'password_reset' | 'user_id_recovery' | 'admin_alert' | 'exam_scheduled' | 'result_report' | 'custom_broadcast'
  forwardTo: string;
  mode: 'bcc' | 'forward_copy';
  enabled: boolean;
  forwardCount: number;
  lastForwardedAt?: string | null;
  createdAt: string;
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
// MAIL FORWARDER RULES ENGINE (Configurable Institutional Forwarding)
// ============================================================================
const DEFAULT_FORWARDERS: MailForwarderRule[] = [];
let memoryForwarders: MailForwarderRule[] = [...DEFAULT_FORWARDERS];
let forwardersLoadedFromDb = false;

function filterRealEmails(list: string[]): string[] {
  return list
    .map((e) => String(e || '').trim())
    .filter((email) => {
      const lower = email.toLowerCase();
      if (!lower || !lower.includes('@') || !lower.includes('.')) return false;
      if (
        lower.endsWith('@example.com') ||
        lower.endsWith('@test.com') ||
        lower.endsWith('@sample.com') ||
        lower.endsWith('@mailinator.com')
      ) {
        return false;
      }
      if (lower.includes('placeholder') || lower.includes('fake_student') || lower.includes('demo_user')) {
        return false;
      }
      return true;
    });
}

async function ensureForwardersLoaded(): Promise<MailForwarderRule[]> {
  if (forwardersLoadedFromDb) return memoryForwarders;
  try {
    const { data } = await supabase
      .from('platform_settings')
      .select('mail_forwarders')
      .limit(1)
      .maybeSingle();
    if (data && Array.isArray((data as any).mail_forwarders)) {
      memoryForwarders = (data as any).mail_forwarders;
    }
  } catch {
    // Non-blocking fallback to in-memory rules
  } finally {
    forwardersLoadedFromDb = true;
  }
  return memoryForwarders;
}

async function persistForwardersToDb(rules: MailForwarderRule[]): Promise<void> {
  memoryForwarders = rules;
  forwardersLoadedFromDb = true;
  try {
    await supabase
      .from('platform_settings')
      .upsert({
        id: '00000000-0000-0000-0000-000000000001',
        mail_forwarders: rules,
        updated_at: new Date().toISOString(),
      });
  } catch {
    // Keep in-memory state if DB column not migrated yet
  }
}

export async function listMailForwarders(): Promise<MailForwarderRule[]> {
  return await ensureForwardersLoaded();
}

export async function upsertMailForwarder(input: {
  id?: string;
  name: string;
  template: string;
  forwardTo: string;
  mode?: 'bcc' | 'forward_copy';
  enabled?: boolean;
}): Promise<MailForwarderRule> {
  const existingList = await ensureForwardersLoaded();
  const cleanRecipients = String(input.forwardTo || '')
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(', ');

  if (!cleanRecipients) {
    throw new Error('At least one valid forwarding email address is required.');
  }

  const now = new Date().toISOString();
  const idx = input.id ? existingList.findIndex((r) => r.id === input.id) : -1;
  let savedRule: MailForwarderRule;

  if (idx >= 0) {
    savedRule = {
      ...existingList[idx],
      name: input.name?.trim() || existingList[idx].name,
      template: input.template || existingList[idx].template,
      forwardTo: cleanRecipients,
      mode: input.mode || existingList[idx].mode,
      enabled: input.enabled !== undefined ? Boolean(input.enabled) : existingList[idx].enabled,
    };
    const updated = [...existingList];
    updated[idx] = savedRule;
    await persistForwardersToDb(updated);
  } else {
    savedRule = {
      id: input.id || `fwd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: input.name?.trim() || 'Institutional Forwarder',
      template: input.template || 'all',
      forwardTo: cleanRecipients,
      mode: input.mode === 'bcc' ? 'bcc' : 'forward_copy',
      enabled: input.enabled !== undefined ? Boolean(input.enabled) : true,
      forwardCount: 0,
      lastForwardedAt: null,
      createdAt: now,
    };
    await persistForwardersToDb([savedRule, ...existingList]);
  }

  return savedRule;
}

export async function deleteMailForwarder(ruleId: string): Promise<boolean> {
  const existingList = await ensureForwardersLoaded();
  const next = existingList.filter((r) => r.id !== ruleId);
  if (next.length === existingList.length) return false;
  await persistForwardersToDb(next);
  return true;
}

// ============================================================================
// 1. CORE DISPATCH SERVICE: sendMail
// ============================================================================
export async function sendMail(options: SendMailOptions): Promise<SendMailResult> {
  const toList = Array.isArray(options.to) ? options.to : String(options.to || '').split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
  const ccListRaw = options.cc ? (Array.isArray(options.cc) ? options.cc : String(options.cc).split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)) : [];
  const bccListRaw = options.bcc ? (Array.isArray(options.bcc) ? options.bcc : String(options.bcc).split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)) : [];

  const toStr = toList.join(', ');
  const templateName = options.template || 'custom';
  const sentBy = options.sentBy || 'system';

  // Load matching active forwarder rules (never forward mail_forwarded to prevent loops)
  const activeForwarders = (!options.skipForwarders && templateName !== 'mail_forwarded')
    ? (await ensureForwardersLoaded()).filter((r) => r.enabled && (r.template === 'all' || r.template === templateName))
    : [];

  for (const rule of activeForwarders) {
    if (rule.mode === 'bcc') {
      const ruleAddrs = rule.forwardTo.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
      bccListRaw.push(...ruleAddrs);
    }
  }

  // 0. Anti-Spam & Placeholder Filter: Prevent fake / demo / loop emails from triggering real mail dispatch
  const realRecipients = filterRealEmails(toList);
  const realCc = filterRealEmails(Array.from(new Set(ccListRaw)));
  const realBcc = filterRealEmails(Array.from(new Set(bccListRaw))).filter((b) => !realRecipients.includes(b));

  if (realRecipients.length === 0) {
    console.info(`[MailService] 🛡️ Shielded simulated/test recipient(s) (${toStr}) — suppressed outbound spam.`);
    return {
      success: true,
      status: 'delivered',
      resend_id: `sim_${Date.now()}`,
      log_id: `log_sim_${Date.now()}`,
    };
  }

  const resendApiKey = (process.env.NODE_ENV === 'test' || process.env.TEST_MOCK_ONLY === 'true')
    ? ''
    : (process.env.RESEND_API_KEY || RESEND_API_KEY);
  const senderAddress = options.from || process.env.MAIL_FROM_NOREPLY || MAIL_FROM_NOREPLY;
  const replyToAddress = options.replyTo || process.env.MAIL_REPLY_TO || MAIL_REPLY_TO;

  let resendId: string | null = null;
  let isSuccess = false;
  let errorMessage: string | null = null;

  // 1. Check daily quota tracker if available
  const quotaCheck = dailyEmailQuota.canSend();
  if (!quotaCheck.allowed) {
    errorMessage = quotaCheck.reason || 'Daily outbound email quota reached.';
    console.warn(`[MailService] 🛑 ${errorMessage}`);
  } else {
    // Attempt dispatch via Resend API
    try {
      if (resendApiKey) {
        const buildResendBody = (fromVal: string) => ({
          from: fromVal,
          to: realRecipients,
          ...(realCc.length > 0 ? { cc: realCc } : {}),
          ...(realBcc.length > 0 ? { bcc: realBcc } : {}),
          subject: options.subject,
          html: options.html,
          text: options.text || undefined,
          reply_to: replyToAddress,
        });

        let res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(buildResendBody(senderAddress)),
        });

        let resData = (await res.json().catch(() => ({}))) as any;

        // Auto-fallback: If domain not yet DNS-verified in Resend, retry with onboarding@resend.dev
        if (!res.ok && (res.status === 403 || String(resData?.message || '').toLowerCase().includes('domain') || String(resData?.message || '').toLowerCase().includes('verify'))) {
          console.warn(`[MailService:Resend] ⚠️ Custom domain sender rejected (${resData?.message}). Retrying with verified onboarding@resend.dev...`);
          res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(buildResendBody('LogicWhile LiRE <onboarding@resend.dev>')),
          });
          resData = (await res.json().catch(() => ({}))) as any;
        }

        if (res.ok) {
          resendId = resData?.id || `resend_${Date.now()}`;
          isSuccess = true;
          dailyEmailQuota.recordSent();
          console.log(`[MailService:Resend] ✅ Sent [${templateName}] to ${realRecipients.join(', ')} (ID: ${resendId})`);
        } else {
          // Fall back to SMTP relay if Resend API failed
          const smtp = getTransporter() || getBrevoTransporter();
          if (smtp) {
            console.log(`[MailService] Engaging SMTP fallback transport...`);
            const info = await smtp.sendMail({
              from: senderAddress,
              to: realRecipients.join(', '),
              ...(realCc.length > 0 ? { cc: realCc.join(', ') } : {}),
              ...(realBcc.length > 0 ? { bcc: realBcc.join(', ') } : {}),
              subject: options.subject,
              html: options.html,
              text: options.text,
              replyTo: replyToAddress,
            });
            resendId = info.messageId || `smtp_${Date.now()}`;
            isSuccess = true;
            dailyEmailQuota.recordSent();
            console.log(`[MailService:SMTP] ✅ Sent [${templateName}] to ${toStr} (ID: ${resendId})`);
          } else {
            throw new Error(resData?.message || `Resend API returned status ${res.status}`);
          }
        }
      } else {
        // Fallback to SMTP transport (Resend SMTP or Brevo)
        const isTestOrMock = process.env.NODE_ENV === 'test' || process.env.TEST_MOCK_ONLY === 'true' || process.env.DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production';
        const smtp = (process.env.NODE_ENV === 'test' || process.env.TEST_MOCK_ONLY === 'true')
          ? null
          : (getTransporter() || getBrevoTransporter());
        if (smtp) {
          const info = await smtp.sendMail({
            from: senderAddress,
            to: realRecipients.join(', '),
            ...(realCc.length > 0 ? { cc: realCc.join(', ') } : {}),
            ...(realBcc.length > 0 ? { bcc: realBcc.join(', ') } : {}),
            subject: options.subject,
            html: options.html,
            text: options.text,
            replyTo: replyToAddress,
          });
          resendId = info.messageId || `smtp_${Date.now()}`;
          isSuccess = true;
          dailyEmailQuota.recordSent();
          console.log(`[MailService:SMTP] ✅ Sent [${templateName}] to ${toStr} (ID: ${resendId})`);
        } else if (isTestOrMock) {
          // Dev mock fallback
          resendId = `mock_${Date.now()}`;
          isSuccess = true;
          dailyEmailQuota.recordSent();
          console.log(`[MailService:Mock] 🧪 Simulating send [${templateName}] to ${toStr}`);
        } else {
          throw new Error('No email transport configured. RESEND_API_KEY missing.');
        }
      }
    } catch (err: any) {
      errorMessage = err?.message || String(err);
      console.error(`[MailService] ❌ Dispatch failed for [${templateName}] to ${toStr}:`, errorMessage);
      systemAlertAgent.recordFailedMail({
        to: toStr,
        template: templateName,
        error: err,
      }).catch(() => { });
    }
  }

  // 2-4. Persist log record & execute active forwarders via unified helper
  return await persistMailLogAndForwarders({
    toStr,
    templateName,
    subject: options.subject,
    html: options.html,
    text: options.text,
    metadata: options.metadata,
    sentBy,
    isSuccess,
    resendId,
    errorMessage,
    activeForwarders,
    skipForwarders: options.skipForwarders,
  });
}

async function persistMailLogAndForwarders(params: {
  toStr: string;
  templateName: string;
  subject: string;
  html: string;
  text?: string;
  metadata?: Record<string, any>;
  sentBy: string;
  isSuccess: boolean;
  resendId: string | null;
  errorMessage: string | null;
  activeForwarders?: MailForwarderRule[];
  skipForwarders?: boolean;
}): Promise<SendMailResult> {
  const {
    toStr,
    templateName,
    subject,
    html,
    text,
    metadata,
    sentBy,
    isSuccess,
    resendId,
    errorMessage,
    skipForwarders,
  } = params;

  const { cleanMetadata, cleanHtml } = sanitizeLogData(metadata, html);
  const nowIso = new Date().toISOString();
  const logRecordId = crypto.randomUUID();

  const logEntry: MailLogRecord = {
    id: logRecordId,
    to_email: toStr,
    template: templateName,
    subject,
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

  // Persist to Supabase mail_logs table
  try {
    const { error } = await supabase
      .from('mail_logs')
      .insert({
        id: logRecordId,
        to_email: toStr,
        template: templateName,
        subject,
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

  // Execute non-blocking 'forward_copy' rules when send succeeded
  const forwarders = params.activeForwarders ?? (
    (!skipForwarders && templateName !== 'mail_forwarded')
      ? (await ensureForwardersLoaded()).filter((r) => r.enabled && (r.template === 'all' || r.template === templateName))
      : []
  );

  if (isSuccess && forwarders.length > 0 && !skipForwarders && templateName !== 'mail_forwarded') {
    const copyRules = forwarders.filter((r) => r.mode === 'forward_copy');
    const bccRules = forwarders.filter((r) => r.mode === 'bcc');
    const nowFwd = new Date().toISOString();

    for (const r of [...copyRules, ...bccRules]) {
      r.forwardCount = (r.forwardCount || 0) + 1;
      r.lastForwardedAt = nowFwd;
    }

    for (const rule of copyRules) {
      const fwdTarget = rule.forwardTo.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
      if (fwdTarget.length === 0) continue;
      const fwdHtml = `
        <div style="background:#0d1835;border:1px solid rgba(56,189,248,0.3);border-radius:12px;padding:16px 20px;margin-bottom:20px;color:#e2e8f0;font-family:Inter,Arial,sans-serif;">
          <div style="font-size:11px;font-weight:800;color:#38bdf8;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">
            AUTO-FORWARDED COPY (${rule.name})
          </div>
          <div style="font-size:13px;line-height:1.5;color:#cbd5e1;">
            <strong>Original Recipient:</strong> ${toStr}<br/>
            <strong>Template:</strong> ${templateName}<br/>
            <strong>Original Subject:</strong> ${subject}<br/>
            <strong>Timestamp:</strong> ${nowIso}
          </div>
        </div>
        ${cleanHtml}
      `;
      sendMail({
        to: fwdTarget,
        subject: `[FWD: ${templateName}] ${subject}`,
        html: fwdHtml,
        text: `Auto-forwarded copy (${rule.name})\nOriginal To: ${toStr}\nTemplate: ${templateName}\nSubject: ${subject}\n\n${text || ''}`,
        template: 'mail_forwarded',
        metadata: { forwardedFromRule: rule.id, originalRecipient: toStr, originalTemplate: templateName },
        sentBy: `forwarder:${rule.name}`,
        skipForwarders: true,
      }).catch(() => { });
    }
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

/**
 * Records outbound emails dispatched through emailService.ts into mail_logs + active forwarders
 */
export async function recordExternalMailLog(params: {
  to: string | string[];
  template: string;
  subject: string;
  html: string;
  text?: string;
  isSuccess: boolean;
  resendId?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, any>;
  sentBy?: string;
}): Promise<void> {
  try {
    const toList = Array.isArray(params.to) ? params.to : [params.to];
    const isTestEnv = process.env.NODE_ENV === 'test' || process.env.TEST_MOCK_ONLY === 'true';
    await persistMailLogAndForwarders({
      toStr: toList.join(', '),
      templateName: params.template || 'custom',
      subject: params.subject,
      html: params.html,
      text: params.text,
      metadata: params.metadata,
      sentBy: params.sentBy || 'email_service',
      isSuccess: params.isSuccess,
      resendId: params.resendId || null,
      errorMessage: params.errorMessage || null,
      skipForwarders: isTestEnv,
    });
  } catch {
    // Non-blocking audit persistence
  }
}

export async function getActiveBccForTemplate(templateName: string): Promise<string[]> {
  try {
    const rules = await ensureForwardersLoaded();
    const bccs = rules
      .filter((r) => r.enabled && r.mode === 'bcc' && (r.template === 'all' || r.template === templateName))
      .flatMap((r) => r.forwardTo.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean));
    return filterRealEmails(Array.from(new Set(bccs)));
  } catch {
    return [];
  }
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
                Automated transmission dispatched from the <strong>LogicWhile</strong> Online Assessment Platform.
              </p>
              <p style="margin:0 0 4px; font-size:11px; color:#64748b;">
                <a href="${FRONTEND_URL}" style="color:#64748b; text-decoration:none;">https://logicwhilelire.com</a> • Institutional Assessment Platform
              </p>
              <p style="margin:0; font-size:11px; color:#475569;">
                © ${year} LogicWhile. All rights reserved.
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
      ${tempPassword
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
      ${tempPassword
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

    ${verifyUrl
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
      ${collegeName
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
  userId?: string;
  portalRole?: string;
  loginUrl?: string;
  resetToken?: string;
  resetUrl: string;
  expiresMinutes?: number;
}): { subject: string; html: string; text: string } {
  const {
    name,
    email,
    userId,
    portalRole = 'Account',
    loginUrl = `${FRONTEND_URL}/login`,
    resetUrl,
    expiresMinutes = 60,
  } = data;
  const subject = `🔑 Password Reset & Account Recovery — LogicWhile LiRE`;
  const effectiveUserId = userId || email;

  const contentHtml = `
    <div style="background:rgba(245,158,11,0.12); border:1px solid #f59e0b; border-radius:8px; padding:12px 16px; margin-bottom:20px;">
      <span style="font-size:12px; font-weight:800; color:#fbbf24; text-transform:uppercase; letter-spacing:1px;">
        🔐 ${portalRole.toUpperCase()} SECURITY & CREDENTIAL RECOVERY
      </span>
    </div>
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">
      Reset Your Password
    </h2>
    <p style="margin:0 0 16px; font-size:14px; line-height:1.6; color:#94a3b8;">
      Hello <strong style="color:#f8fafc;">${name}</strong>,
    </p>
    <p style="margin:0 0 18px; font-size:14px; line-height:1.6; color:#cbd5e1;">
      We received a request to reset the password associated with your LogicWhile LiRE ${portalRole} account. Your account summary is confirmed below:
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#070d1e; border:1px solid rgba(56,189,248,0.22); border-radius:10px; margin-bottom:22px;">
      <tr>
        <td style="padding:14px 18px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="6" border="0" style="font-size:13px;">
            <tr>
              <td style="color:#94a3b8; width:145px;">User ID / Login ID:</td>
              <td style="color:#fbbf24; font-family:monospace; font-weight:800;">${effectiveUserId}</td>
            </tr>
            <tr>
              <td style="color:#94a3b8;">Registered Email:</td>
              <td style="color:#38bdf8; font-family:monospace;">${email}</td>
            </tr>
            <tr>
              <td style="color:#94a3b8;">Portal Access:</td>
              <td style="color:#e2e8f0;">${portalRole} (<a href="${loginUrl}" style="color:#38bdf8;text-decoration:none;">${loginUrl}</a>)</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <div style="text-align:center; margin:26px 0;">
      <a href="${resetUrl}" style="display:inline-block; padding:14px 36px; background:linear-gradient(135deg, #1B5FB5 0%, #0A3F8F 100%); color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; border-radius:8px; box-shadow:0 4px 16px rgba(27, 95, 181, 0.45);">
        Reset My Password →
      </a>
    </div>

    <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px 14px; margin-bottom:18px; word-break:break-all;">
      <div style="font-size:11px; color:#94a3b8; margin-bottom:4px; text-transform:uppercase; font-weight:700;">Fallback Verification URL</div>
      <a href="${resetUrl}" style="font-size:12px; color:#38bdf8; text-decoration:none; font-family:monospace;">${resetUrl}</a>
    </div>

    <div style="background:rgba(239,68,68,0.08); border-left:3px solid #ef4444; padding:12px 16px; border-radius:6px; margin-bottom:24px;">
      <p style="margin:0; font-size:12px; color:#fca5a5; line-height:1.5;">
        ⏱️ This secure link will expire in <strong>${expiresMinutes} minutes</strong>. If you did not request a password reset, you can safely ignore this message; your account credentials remain unchanged.
      </p>
    </div>
  `;

  const html = getSharedEmailLayout({
    title: subject,
    preheader: `Password reset & User ID (${effectiveUserId}) details for ${email}. Expires in ${expiresMinutes} minutes.`,
    contentHtml,
  });

  const text = `Hello ${name},\n\nPassword reset & account details for LogicWhile LiRE (${portalRole}):\nUser ID / Login ID: ${effectiveUserId}\nEmail: ${email}\nReset link: ${resetUrl}\nExpires in ${expiresMinutes} minutes.\n\nSupport: ${MAIL_REPLY_TO}`;
  return { subject, html, text };
}

/**
 * TEMPLATE 6B: user_id_recovery
 * Sends recovered Hall Ticket / Staff Username + Portal login URL
 */
export function renderUserIdRecoveryTemplate(data: {
  name: string;
  email: string;
  recoveredAccounts: Array<{
    userId: string;
    portalRole: string;
    loginUrl: string;
    extraInfo?: string;
  }>;
}): { subject: string; html: string; text: string } {
  const { name, email, recoveredAccounts } = data;
  const subject = `🪪 Your LogicWhile LiRE User ID & Portal Details`;

  const rowsHtml = recoveredAccounts
    .map(
      (acc) => `
      <tr>
        <td style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.06);">
          <div style="font-size:11px; color:#38bdf8; font-weight:800; text-transform:uppercase; letter-spacing:0.6px; margin-bottom:4px;">${acc.portalRole}</div>
          <div style="font-size:18px; color:#fbbf24; font-family:monospace; font-weight:900; margin-bottom:4px;">${acc.userId}</div>
          ${acc.extraInfo ? `<div style="font-size:12px; color:#94a3b8; margin-bottom:6px;">${acc.extraInfo}</div>` : ''}
          <a href="${acc.loginUrl}" style="font-size:12px; color:#34d399; font-weight:700; text-decoration:none;">Sign In at ${acc.loginUrl} →</a>
        </td>
      </tr>
    `
    )
    .join('');

  const contentHtml = `
    <div style="background:rgba(56,189,248,0.12); border:1px solid #38bdf8; border-radius:8px; padding:12px 16px; margin-bottom:20px;">
      <span style="font-size:12px; font-weight:800; color:#38bdf8; text-transform:uppercase; letter-spacing:1px;">
        🪪 USER ID & HALL TICKET RECOVERY
      </span>
    </div>
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">
      Your Registered Login Identifiers
    </h2>
    <p style="margin:0 0 16px; font-size:14px; line-height:1.6; color:#94a3b8;">
      Hello <strong style="color:#f8fafc;">${name}</strong>,
    </p>
    <p style="margin:0 0 18px; font-size:14px; line-height:1.6; color:#cbd5e1;">
      Here are the LogicWhile LiRE User ID(s) / Hall Ticket number(s) registered with <strong style="color:#f8fafc;">${email}</strong>:
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#070d1e; border:1px solid rgba(56,189,248,0.25); border-radius:10px; margin-bottom:24px;">
      ${rowsHtml}
    </table>

    <div style="text-align:center; margin:24px 0;">
      <a href="${FRONTEND_URL}/forgot-password" style="display:inline-block; padding:12px 28px; background:rgba(255,180,0,0.14); border:1px solid rgba(255,180,0,0.45); color:#fbbf24; font-size:13px; font-weight:700; text-decoration:none; border-radius:8px;">
        Also Need to Reset Your Password? →
      </a>
    </div>
  `;

  const html = getSharedEmailLayout({
    title: subject,
    preheader: `Recovered User ID / Hall Ticket details for ${email}.`,
    contentHtml,
  });

  const textLines = recoveredAccounts
    .map((a) => `- ${a.portalRole}: User ID = ${a.userId} (Sign in: ${a.loginUrl})${a.extraInfo ? ` [${a.extraInfo}]` : ''}`)
    .join('\n');
  const text = `Hello ${name},\n\nHere are your LogicWhile LiRE login IDs registered with ${email}:\n${textLines}\n\nReset password: ${FRONTEND_URL}/forgot-password\nSupport: ${MAIL_REPLY_TO}`;
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
      ${scheduledAt
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
      ${submissionDeadline
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
  userId?: string;
  portalRole?: string;
  loginUrl?: string;
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
    metadata: {
      name: data.name,
      userId: data.userId || data.email,
      portalRole: data.portalRole || 'Account',
      expiresMinutes: data.expiresMinutes || 60,
    },
  });
}

export async function sendUserIdRecovery(data: {
  name: string;
  email: string;
  recoveredAccounts: Array<{
    userId: string;
    portalRole: string;
    loginUrl: string;
    extraInfo?: string;
  }>;
}): Promise<SendMailResult> {
  const rendered = renderUserIdRecoveryTemplate(data);
  return sendMail({
    to: data.email,
    from: process.env.LOGIN_ID_FROM_EMAIL || LOGIN_ID_MAIL_FROM,
    replyTo: process.env.LOGIN_ID_REPLY_TO || LOGIN_ID_MAIL_REPLY_TO,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    template: 'user_id_recovery',
    metadata: {
      name: data.name,
      accountsCount: data.recoveredAccounts.length,
      portals: data.recoveredAccounts.map((a) => a.portalRole).join(', '),
    },
  });
}

export async function forwardMailLogById(
  logId: string,
  forwardTo: string,
  note?: string,
  forwardedBy: string = 'admin_forward'
): Promise<SendMailResult> {
  let record: MailLogRecord | null = null;
  try {
    const { data } = await supabase.from('mail_logs').select('*').eq('id', logId).maybeSingle();
    if (data) record = data as MailLogRecord;
  } catch { }

  if (!record) {
    record = memoryMailLogs.find((l) => l.id === logId) || null;
  }
  if (!record) {
    throw new Error('Mail log record not found');
  }

  const targetRecipients = String(forwardTo || '')
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (targetRecipients.length === 0) {
    throw new Error('At least one valid forwarding recipient is required');
  }

  const safeOriginalHtml = record.html_content || `<p>Original subject: ${record.subject}</p>`;
  const noteBlock = note && note.trim()
    ? `<div style="margin-top:8px;padding:10px 12px;border-radius:8px;background:rgba(255,180,0,0.1);border:1px solid rgba(255,180,0,0.3);color:#fde68a;"><strong>Forwarding Note:</strong> ${note.trim()}</div>`
    : '';

  const forwardedHtml = `
    <div style="background:#0d1835;border:1px solid rgba(56,189,248,0.35);border-radius:12px;padding:16px 20px;margin-bottom:20px;color:#e2e8f0;font-family:Inter,Arial,sans-serif;">
      <div style="font-size:11px;font-weight:800;color:#38bdf8;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">
        FORWARDED INSTITUTIONAL TRANSMISSION
      </div>
      <div style="font-size:13px;line-height:1.55;color:#cbd5e1;">
        <strong>Original Recipient:</strong> ${record.to_email}<br/>
        <strong>Template:</strong> ${record.template}<br/>
        <strong>Dispatched At:</strong> ${new Date(record.created_at).toLocaleString()}<br/>
        <strong>Forwarded By:</strong> ${forwardedBy}
      </div>
      ${noteBlock}
    </div>
    ${safeOriginalHtml}
  `;

  return sendMail({
    to: targetRecipients,
    subject: `Fwd: ${record.subject}`,
    html: forwardedHtml,
    text: `Forwarded message (from log ${logId})\nOriginal To: ${record.to_email}\nSubject: ${record.subject}\n${note ? `Note: ${note}\n` : ''}`,
    template: 'mail_forwarded',
    metadata: {
      forwarded_of: logId,
      original_to: record.to_email,
      original_template: record.template,
      note: note || null,
    },
    sentBy: forwardedBy,
    skipForwarders: true,
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

  // Calculate overall stats accurately across DB + memory buffer
  const totalCount = dbTotal || memoryMailLogs.length;
  const sentFromSlice = combined.filter((l) => l.status === 'sent' || l.status === 'delivered').length;
  const failedFromSlice = combined.filter((l) => l.status === 'failed').length;
  const memSent = memoryMailLogs.filter((l) => l.status === 'sent' || l.status === 'delivered').length;
  const memFailed = memoryMailLogs.filter((l) => l.status === 'failed').length;

  return {
    logs: combined,
    total: dbTotal || memoryMailLogs.length,
    page,
    limit,
    stats: {
      total: totalCount,
      sent: Math.max(memSent, sentFromSlice),
      failed: Math.max(memFailed, failedFromSlice),
    },
  };
}

export async function resendMailLogById(logId: string): Promise<SendMailResult> {
  // Look up log from DB, then fallback to memory buffer
  let record: MailLogRecord | null = null;

  try {
    const { data } = await supabase.from('mail_logs').select('*').eq('id', logId).maybeSingle();
    if (data) record = data as MailLogRecord;
  } catch { }

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
      for (let i = pw.length - 1; i > 0; i--) { const j = randomInt(0, i + 1);[pw[i], pw[j]] = [pw[j], pw[i]]; }
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
    } catch { }

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
  } catch { }

  return result;
}

// ============================================================================
// 7. COMPLETE SYSTEM EVENT TEMPLATES & UNIFIED TEMPLATE CATALOG (25 TEMPLATES)
// ============================================================================

function renderBadgeHeader(label: string, accentHex: string, bgRgba: string): string {
  return `<div style="background:${bgRgba}; border:1px solid ${accentHex}; border-radius:8px; padding:12px 16px; margin-bottom:20px;">
    <span style="font-size:12px; font-weight:800; color:${accentHex}; text-transform:uppercase; letter-spacing:1px;">${label}</span>
  </div>`;
}

function renderKeyValueCard(rows: Array<{ label: string; value: string; valueColor?: string; mono?: boolean }>, borderColor = 'rgba(255,255,255,0.08)'): string {
  const trs = rows
    .filter((r) => r.value !== undefined && r.value !== '')
    .map(
      (r, idx, arr) => `<tr>
        <td style="padding:12px 16px; ${idx < arr.length - 1 ? 'border-bottom:1px solid rgba(255,255,255,0.06);' : ''} font-size:13px; color:#94a3b8;">${r.label}:</td>
        <td style="padding:12px 16px; ${idx < arr.length - 1 ? 'border-bottom:1px solid rgba(255,255,255,0.06);' : ''} font-size:14px; font-weight:700; color:${r.valueColor || '#f8fafc'}; ${r.mono ? 'font-family:monospace;' : ''}">${r.value}</td>
      </tr>`
    )
    .join('');
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:rgba(255,255,255,0.03); border:1px solid ${borderColor}; border-radius:12px; margin-bottom:22px;">${trs}</table>`;
}

function renderCtaButton(label: string, href: string, gradient = 'linear-gradient(135deg, #1B5FB5 0%, #0A3F8F 100%)'): string {
  return `<div style="text-align:center; margin:24px 0 12px;">
    <a href="${href}" style="display:inline-block; padding:14px 32px; background:${gradient}; color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; border-radius:8px; box-shadow:0 4px 16px rgba(27,95,181,0.4);">${label}</a>
  </div>`;
}

export function renderWelcomeCredentialsTemplate(data: {
  recipientName: string;
  role: 'student' | 'faculty' | 'inspector' | 'admin' | string;
  identifier: string;
  tempPassword?: string;
  collegeName?: string;
  loginUrl?: string;
}): { subject: string; html: string; text: string } {
  const roleUpper = String(data.role || 'student').toUpperCase();
  const loginUrl = data.loginUrl || `${FRONTEND_URL}/${data.role === 'student' ? 'login' : data.role === 'inspector' ? 'inspector' : 'admin'}`;
  const subject = `🎓 Welcome to LogicWhile LiRE — Your ${roleUpper} Account & Credentials`;
  const contentHtml = `
    ${renderBadgeHeader(`🏛️ ${roleUpper} CREDENTIAL ONBOARDING`, '#38bdf8', 'rgba(56,189,248,0.12)')}
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">Welcome to LogicWhile LiRE, ${data.recipientName}!</h2>
    <p style="margin:0 0 18px; font-size:14px; line-height:1.6; color:#cbd5e1;">Your <strong style="color:#38bdf8;">${roleUpper}</strong> account has been provisioned. Keep these credentials confidential.</p>
    ${renderKeyValueCard([
      { label: data.role === 'student' ? 'Hall Ticket / Roll No' : 'Login Identifier', value: data.identifier, valueColor: '#38bdf8', mono: true },
      ...(data.tempPassword ? [{ label: 'Temporary Password', value: data.tempPassword, valueColor: '#fbbf24', mono: true }] : []),
      ...(data.collegeName ? [{ label: 'Institution', value: data.collegeName }] : []),
    ])}
    ${renderCtaButton('🚀 Access Portal Dashboard', loginUrl)}
  `;
  return {
    subject,
    html: getSharedEmailLayout({ title: subject, preheader: `Welcome ${data.recipientName} (${data.identifier})`, contentHtml }),
    text: `Welcome ${data.recipientName}\nRole: ${roleUpper}\nID: ${data.identifier}\n${data.tempPassword ? `Temporary Password: ${data.tempPassword}\n` : ''}Login: ${loginUrl}\nSupport: ${MAIL_REPLY_TO}`,
  };
}

export function renderAdminLoginOtpTemplate(data: {
  recipientName: string;
  otp: string;
  role?: string;
  ip?: string;
  expiresMinutes?: number;
}): { subject: string; html: string; text: string } {
  const roleLabel = data.role === 'inspector' ? 'Exam Inspector' : data.role === 'super_admin' ? 'Super Administrator' : 'Staff Member';
  const expiresMinutes = data.expiresMinutes ?? 10;
  const ip = data.ip || '127.0.0.1';
  const subject = `🔐 [SECURITY ALERT] ${roleLabel} Login Verification Code: ${data.otp}`;
  const contentHtml = `
    ${renderBadgeHeader(`🛡️ ${roleLabel.toUpperCase()} LOGIN VERIFICATION`, '#f87171', 'rgba(239,68,68,0.12)')}
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">One-Time Passcode for ${roleLabel} Portal</h2>
    <p style="margin:0 0 16px; font-size:14px; line-height:1.6; color:#cbd5e1;">Hello <strong style="color:#f8fafc;">${data.recipientName}</strong>, a sign-in request was received from IP <code>${ip}</code>:</p>
    <div style="background:rgba(239,68,68,0.08); border:2px dashed #ef4444; border-radius:12px; padding:22px; text-align:center; margin:20px 0;">
      <div style="font-family:'Courier New', monospace; font-size:36px; font-weight:900; letter-spacing:10px; color:#f87171;">${data.otp}</div>
      <div style="margin-top:8px; font-size:12px; color:#94a3b8;">⏱ Valid for ${expiresMinutes} minutes</div>
    </div>
    <p style="margin:0; font-size:12px; color:#94a3b8;">If you did not request this code, rotate your credentials immediately.</p>
  `;
  return {
    subject,
    html: getSharedEmailLayout({ title: subject, preheader: `Login OTP ${data.otp} for ${roleLabel}`, contentHtml }),
    text: `Hello ${data.recipientName},\nYour ${roleLabel} login OTP is ${data.otp} (valid ${expiresMinutes} mins, IP: ${ip}).`,
  };
}

export function renderExamStartedReminderTemplate(data: {
  recipientName: string;
  hallTicket: string;
  examCode: string;
  examTitle: string;
  roomUrl?: string;
}): { subject: string; html: string; text: string } {
  const joinUrl = data.roomUrl || `${FRONTEND_URL}/lobby/${data.examCode}`;
  const subject = `🚨 Exam Started: ${data.examTitle} — Join Immediately!`;
  const contentHtml = `
    ${renderBadgeHeader('🚨 EXAM IS LIVE — TIMER STARTED', '#ef4444', 'rgba(239,68,68,0.14)')}
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">Your Exam Has Officially Started!</h2>
    <p style="margin:0 0 18px; font-size:14px; line-height:1.6; color:#cbd5e1;">Dear <strong style="color:#f8fafc;">${data.recipientName}</strong> (Hall Ticket: <span style="font-family:monospace; color:#38bdf8;">${data.hallTicket}</span>), your invigilator has launched <strong>${data.examTitle}</strong>.</p>
    ${renderKeyValueCard([
      { label: 'Active Exam Code', value: data.examCode, valueColor: '#10b981', mono: true },
      { label: 'Candidate Hall Ticket', value: data.hallTicket, valueColor: '#38bdf8', mono: true },
    ], 'rgba(16,185,129,0.3)')}
    ${renderCtaButton('⚡ Enter Exam Room Now →', joinUrl, 'linear-gradient(135deg, #10b981 0%, #059669 100%)')}
  `;
  return {
    subject,
    html: getSharedEmailLayout({ title: subject, preheader: `${data.examTitle} (${data.examCode}) is live now`, contentHtml }),
    text: `URGENT: ${data.examTitle} (${data.examCode}) is live! Join now: ${joinUrl}`,
  };
}

export function renderSubmissionReceiptTemplate(data: {
  recipientName: string;
  hallTicket: string;
  examTitle: string;
  answeredCount: number;
  totalQuestions: number;
  submissionHash: string;
}): { subject: string; html: string; text: string } {
  const subject = `✅ Exam Submission Confirmed: ${data.examTitle} (${data.hallTicket})`;
  const contentHtml = `
    ${renderBadgeHeader('✅ DIGITAL SUBMISSION AUDIT RECEIPT', '#10b981', 'rgba(16,185,129,0.12)')}
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#10b981;">Exam Submission Recorded Successfully</h2>
    <p style="margin:0 0 18px; font-size:14px; line-height:1.6; color:#cbd5e1;">Dear <strong style="color:#f8fafc;">${data.recipientName}</strong>, your responses for <strong>${data.examTitle}</strong> are sealed in the server audit ledger.</p>
    ${renderKeyValueCard([
      { label: 'Hall Ticket', value: data.hallTicket, valueColor: '#38bdf8', mono: true },
      { label: 'Questions Answered', value: `${data.answeredCount} / ${data.totalQuestions}`, valueColor: '#10b981' },
      { label: 'Audit Hash', value: data.submissionHash, valueColor: '#a78bfa', mono: true },
    ], 'rgba(16,185,129,0.3)')}
  `;
  return {
    subject,
    html: getSharedEmailLayout({ title: subject, preheader: `Submission receipt for ${data.examTitle}`, contentHtml }),
    text: `Submission Confirmed: ${data.examTitle}\nCandidate: ${data.recipientName} (${data.hallTicket})\nAnswered: ${data.answeredCount}/${data.totalQuestions}\nHash: ${data.submissionHash}`,
  };
}

export function renderInspectorNoticeTemplate(data: {
  recipientName: string;
  hallTicket: string;
  examTitle: string;
  inspectorName: string;
  noticeText: string;
}): { subject: string; html: string; text: string } {
  const subject = `⚠️ Proctor Notice: ${data.examTitle} — Official Warning for ${data.hallTicket}`;
  const contentHtml = `
    ${renderBadgeHeader('⚠️ OFFICIAL INVIGILATOR NOTICE & WARNING', '#f59e0b', 'rgba(245,158,11,0.14)')}
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">Direct Notice from Examination Invigilator</h2>
    <p style="margin:0 0 14px; font-size:14px; color:#cbd5e1;">Candidate: <strong style="color:#f8fafc;">${data.recipientName}</strong> (${data.hallTicket}) • Exam: <strong>${data.examTitle}</strong></p>
    <div style="background:rgba(255,255,255,0.04); border-left:4px solid #f59e0b; padding:16px 20px; border-radius:6px; margin-bottom:20px;">
      <p style="margin:0; font-size:15px; font-weight:600; color:#fef3c7; line-height:1.6;">"${data.noticeText}"</p>
      <div style="margin-top:8px; font-size:12px; color:#94a3b8;">Issued by: <strong>${data.inspectorName}</strong></div>
    </div>
  `;
  return {
    subject,
    html: getSharedEmailLayout({ title: subject, preheader: `Proctor notice from ${data.inspectorName}`, contentHtml }),
    text: `PROCTOR NOTICE\nTo: ${data.recipientName} (${data.hallTicket})\nExam: ${data.examTitle}\nInspector: ${data.inspectorName}\nMessage: ${data.noticeText}`,
  };
}

export function renderInspectorIssueAlertTemplate(data: {
  participantName: string;
  hallTicket: string;
  examTitle: string;
  issueType: string;
  details: string;
  severity?: 'low' | 'medium' | 'high' | 'critical' | string;
}): { subject: string; html: string; text: string } {
  const sev = String(data.severity || 'high').toUpperCase();
  const color = sev === 'LOW' ? '#38bdf8' : sev === 'MEDIUM' ? '#f59e0b' : '#ef4444';
  const subject = `🚨 [INSPECTOR ALERT] ${data.issueType.toUpperCase()}: ${data.participantName} (${data.hallTicket})`;
  const contentHtml = `
    ${renderBadgeHeader(`⚠️ LIVE PROCTOR INSPECTION ALERT [${sev}]`, color, 'rgba(239,68,68,0.12)')}
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">Candidate Flagged by Telemetry</h2>
    ${renderKeyValueCard([
      { label: 'Candidate', value: `${data.participantName} (${data.hallTicket})`, mono: true },
      { label: 'Examination', value: data.examTitle },
      { label: 'Flag Type', value: data.issueType.replace(/_/g, ' ').toUpperCase(), valueColor: color },
      { label: 'Telemetry Details', value: data.details },
    ])}
  `;
  return {
    subject,
    html: getSharedEmailLayout({ title: subject, preheader: `${data.issueType} flagged for ${data.participantName}`, contentHtml }),
    text: `INSPECTOR ALERT [${sev}]\nCandidate: ${data.participantName} (${data.hallTicket})\nExam: ${data.examTitle}\nFlag: ${data.issueType}\nDetails: ${data.details}`,
  };
}

export function renderTerminationAlertTemplate(data: {
  participantName: string;
  hallTicket: string;
  examTitle: string;
  reason: string;
  violationCount: number;
  reviewUrl?: string;
}): { subject: string; html: string; text: string } {
  const subject = `🚨 [SECURITY ALERT] Session Terminated: ${data.participantName} (${data.hallTicket})`;
  const contentHtml = `
    ${renderBadgeHeader('🚨 PROCTORING TERMINATION TRIGGERED', '#ef4444', 'rgba(239,68,68,0.14)')}
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">Participant Session Terminated</h2>
    <p style="margin:0 0 18px; font-size:14px; color:#cbd5e1;">An active candidate session was locked and terminated after exceeding proctoring thresholds.</p>
    ${renderKeyValueCard([
      { label: 'Candidate', value: data.participantName },
      { label: 'Hall Ticket', value: data.hallTicket, valueColor: '#a78bfa', mono: true },
      { label: 'Exam', value: data.examTitle },
      { label: 'Reason', value: data.reason, valueColor: '#ef4444' },
      { label: 'Total Violations', value: String(data.violationCount), valueColor: '#f59e0b' },
    ])}
    ${renderCtaButton('🛡️ Review Violation Audit', data.reviewUrl || `${FRONTEND_URL}/admin/monitor`)}
  `;
  return {
    subject,
    html: getSharedEmailLayout({ title: subject, preheader: `Session terminated: ${data.participantName} (${data.hallTicket})`, contentHtml }),
    text: `SECURITY TERMINATION\nCandidate: ${data.participantName} (${data.hallTicket})\nExam: ${data.examTitle}\nReason: ${data.reason}\nViolations: ${data.violationCount}`,
  };
}

export function renderBatchTerminationSummaryTemplate(data: {
  examTitle: string;
  terminationCount: number;
  windowMinutes?: number;
  summaryNote?: string;
}): { subject: string; html: string; text: string } {
  const windowMinutes = data.windowMinutes ?? 5;
  const subject = `🚨 [SECURITY SUMMARY] ${data.terminationCount} Sessions Terminated — ${data.examTitle}`;
  const contentHtml = `
    ${renderBadgeHeader(`🚨 BATCHED TERMINATION SUMMARY (${windowMinutes}-MIN WINDOW)`, '#ef4444', 'rgba(239,68,68,0.15)')}
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">High-Frequency Proctoring Incidents</h2>
    <p style="margin:0 0 18px; font-size:14px; color:#cbd5e1;"><strong>${data.terminationCount}</strong> candidate sessions were automatically terminated in <strong>${data.examTitle}</strong> during the last ${windowMinutes} minutes.</p>
    ${renderKeyValueCard([
      { label: 'Examination', value: data.examTitle },
      { label: 'Sessions Terminated', value: String(data.terminationCount), valueColor: '#ef4444' },
      ...(data.summaryNote ? [{ label: 'Notes', value: data.summaryNote }] : []),
    ])}
    ${renderCtaButton('📊 Inspect Live Proctor Console', `${FRONTEND_URL}/admin`)}
  `;
  return {
    subject,
    html: getSharedEmailLayout({ title: subject, preheader: `${data.terminationCount} terminations in ${data.examTitle}`, contentHtml }),
    text: `BATCH TERMINATION SUMMARY\nExam: ${data.examTitle}\nCount: ${data.terminationCount} in ${windowMinutes} mins`,
  };
}

export function renderAdminSystemAlertTemplate(data: {
  alertType: string;
  severity: string;
  message: string;
  ip?: string;
}): { subject: string; html: string; text: string } {
  const sev = String(data.severity || 'HIGH').toUpperCase();
  const color = sev === 'CRITICAL' || sev === 'HIGH' ? '#ef4444' : '#f59e0b';
  const subject = `🚨 [${sev}] System Alert: ${data.alertType} - ${data.message.slice(0, 50)}`;
  const contentHtml = `
    ${renderBadgeHeader(`🚨 SYSTEM ALERTING AGENT — ${sev}`, color, 'rgba(239,68,68,0.15)')}
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">${data.alertType}</h2>
    <p style="margin:0 0 18px; font-size:14px; color:#cbd5e1;">${data.message}</p>
    ${renderKeyValueCard([
      { label: 'Severity', value: sev, valueColor: color },
      { label: 'Source IP', value: data.ip || 'System Internal', mono: true },
      { label: 'Recorded At', value: new Date().toISOString(), mono: true },
    ])}
    ${renderCtaButton('🛡️ Open Security Dashboard', `${FRONTEND_URL}/admin`)}
  `;
  return {
    subject,
    html: getSharedEmailLayout({ title: subject, preheader: `${sev} Alert: ${data.alertType}`, contentHtml }),
    text: `SYSTEM ALERT [${sev}]\nType: ${data.alertType}\nMessage: ${data.message}\nIP: ${data.ip || 'System'}`,
  };
}

export function renderDailyBackupTemplate(data: {
  backupId: string;
  fileCount: number | string;
  driveStatus: string;
  trigger?: string;
}): { subject: string; html: string; text: string } {
  return renderAdminAlertTemplate({
    alertType: 'daily_backup_completed',
    title: 'Nightly Database Backup Completed',
    message: 'The automated disaster recovery snapshot & Google Drive sync finished cleanly.',
    details: {
      backupId: data.backupId,
      trigger: data.trigger || 'scheduled',
      fileCount: data.fileCount,
      googleDriveStatus: data.driveStatus,
    },
  });
}

export function renderContactAutoReplyTemplate(data: {
  senderName: string;
  referenceId: string;
  subject: string;
  message: string;
}): { subject: string; html: string; text: string } {
  const emailSubject = `[${data.referenceId}] We Received Your Inquiry: ${data.subject}`;
  const contentHtml = `
    ${renderBadgeHeader('📩 INQUIRY ACKNOWLEDGEMENT', '#60a5fa', 'rgba(59,130,246,0.12)')}
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">We Received Your Message</h2>
    <p style="margin:0 0 18px; font-size:14px; color:#cbd5e1;">Dear <strong style="color:#f8fafc;">${data.senderName}</strong>, thank you for contacting <strong>LogicWhileLiRE</strong>. Our engineering team will reply within 24 business hours.</p>
    ${renderKeyValueCard([
      { label: 'Inquiry Reference ID', value: data.referenceId, valueColor: '#38bdf8', mono: true },
      { label: 'Subject', value: data.subject },
      { label: 'Excerpt', value: data.message.slice(0, 260) },
    ])}
  `;
  return {
    subject: emailSubject,
    html: getSharedEmailLayout({ title: emailSubject, preheader: `Reference ${data.referenceId}`, contentHtml }),
    text: `Hello ${data.senderName},\nWe received your inquiry (${data.referenceId}): ${data.subject}\nSupport: ${MAIL_REPLY_TO}`,
  };
}

export function renderContactAdminNotificationTemplate(data: {
  senderName: string;
  senderEmail: string;
  referenceId: string;
  subject: string;
  message: string;
  institution?: string;
  candidateCount?: string;
}): { subject: string; html: string; text: string } {
  const emailSubject = `🚨 [CONTACT INQUIRY] ${data.subject} — ${data.senderName} (${data.referenceId})`;
  const contentHtml = `
    ${renderBadgeHeader('📢 NEW CONTACT FORM SUBMISSION', '#f59e0b', 'rgba(245,158,11,0.14)')}
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">Inquiry: ${data.subject}</h2>
    ${renderKeyValueCard([
      { label: 'Reference ID', value: data.referenceId, valueColor: '#f59e0b', mono: true },
      { label: 'From', value: `${data.senderName} <${data.senderEmail}>` },
      ...(data.institution ? [{ label: 'Institution', value: data.institution }] : []),
      ...(data.candidateCount ? [{ label: 'Batch Scale', value: data.candidateCount }] : []),
    ])}
    <div style="background:rgba(255,255,255,0.04); border-left:4px solid #38bdf8; padding:14px 18px; border-radius:6px; margin-bottom:20px;">
      <p style="margin:0; font-size:14px; color:#f0f4f8; line-height:1.6;">${data.message}</p>
    </div>
    ${renderCtaButton(`✉️ Reply to ${data.senderName}`, `mailto:${data.senderEmail}?subject=${encodeURIComponent(`Re: [${data.referenceId}] ${data.subject}`)}`)}
  `;
  return {
    subject: emailSubject,
    html: getSharedEmailLayout({ title: emailSubject, preheader: `Contact inquiry from ${data.senderName}`, contentHtml }),
    text: `NEW CONTACT INQUIRY\nRef: ${data.referenceId}\nFrom: ${data.senderName} (${data.senderEmail})\nSubject: ${data.subject}\n\n${data.message}`,
  };
}

export function renderMailForwardedTemplate(data: {
  originalTo: string;
  originalTemplate: string;
  originalSubject: string;
  note?: string;
  forwardedBy?: string;
  bodyHtml?: string;
}): { subject: string; html: string; text: string } {
  const subject = `Fwd: ${data.originalSubject}`;
  const contentHtml = `
    ${renderBadgeHeader('🔁 FORWARDED INSTITUTIONAL TRANSMISSION', '#a78bfa', 'rgba(167,139,250,0.14)')}
    ${renderKeyValueCard([
      { label: 'Original Recipient', value: data.originalTo, valueColor: '#38bdf8', mono: true },
      { label: 'Source Template', value: data.originalTemplate, mono: true },
      { label: 'Forwarded By', value: data.forwardedBy || 'System Relay' },
      ...(data.note ? [{ label: 'Note', value: data.note, valueColor: '#fde68a' }] : []),
    ], 'rgba(167,139,250,0.3)')}
    <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:16px 20px; color:#cbd5e1; font-size:14px; line-height:1.6;">
      ${data.bodyHtml || '<p>Original institutional transmission payload attached inline.</p>'}
    </div>
  `;
  return {
    subject,
    html: getSharedEmailLayout({ title: subject, preheader: `Forwarded: ${data.originalSubject}`, contentHtml }),
    text: `Forwarded message\nOriginal To: ${data.originalTo}\nTemplate: ${data.originalTemplate}\nSubject: ${data.originalSubject}\n${data.note ? `Note: ${data.note}\n` : ''}`,
  };
}

export function renderCustomBroadcastTemplate(data: {
  headline: string;
  recipientGreeting?: string;
  messageBody: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): { subject: string; html: string; text: string } {
  const subject = `📣 ${data.headline} — LogicWhile LiRE`;
  const contentHtml = `
    ${renderBadgeHeader('📣 INSTITUTIONAL BROADCAST NOTICE', '#38bdf8', 'rgba(56,189,248,0.12)')}
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">${data.headline}</h2>
    <p style="margin:0 0 16px; font-size:14px; color:#cbd5e1;">${data.recipientGreeting || 'Dear Candidate,'}</p>
    <div style="background:rgba(255,255,255,0.03); border-left:4px solid #38bdf8; border-radius:6px; padding:14px 18px; margin-bottom:20px; font-size:14px; line-height:1.65; color:#e2e8f0;">
      ${data.messageBody}
    </div>
    ${data.ctaUrl ? renderCtaButton(data.ctaLabel || 'Open Assessment Portal', data.ctaUrl) : ''}
  `;
  return {
    subject,
    html: getSharedEmailLayout({ title: subject, preheader: data.headline, contentHtml }),
    text: `${data.headline}\n\n${data.recipientGreeting || 'Dear Candidate,'}\n\n${data.messageBody.replace(/<[^>]+>/g, ' ')}`,
  };
}

export type MailTemplateCategory = 'auth_recovery' | 'exam_lifecycle' | 'proctoring_security' | 'support_ops';

export interface MailTemplateVariableSpec {
  key: string;
  label: string;
  defaultValue: string;
}

export interface MailTemplateCatalogEntry {
  key: string;
  name: string;
  category: MailTemplateCategory;
  categoryLabel: string;
  audience: string;
  triggerEvent: string;
  description: string;
  variables: MailTemplateVariableSpec[];
}

export const MAIL_TEMPLATE_CATALOG: MailTemplateCatalogEntry[] = [
  {
    key: 'admin_welcome',
    name: 'Admin Console Onboarding',
    category: 'auth_recovery',
    categoryLabel: 'Auth & Recovery',
    audience: 'Administrators / Super Admin',
    triggerEvent: 'adminController -> createStaffAccount (role: admin)',
    description: 'Provisions new Admin / Super Admin account with temporary access key and TOTP requirement.',
    variables: [
      { key: 'name', label: 'Admin Name', defaultValue: 'Dr. Ananya Rao' },
      { key: 'email', label: 'Registered Email', defaultValue: 'admin.demo@college.edu' },
      { key: 'role', label: 'Assigned Role', defaultValue: 'Administrator' },
      { key: 'tempPassword', label: 'Temporary Password', defaultValue: 'LwAdm!98xQp2' },
    ],
  },
  {
    key: 'inspector_created',
    name: 'Inspector / Invigilator Onboarding',
    category: 'auth_recovery',
    categoryLabel: 'Auth & Recovery',
    audience: 'Exam Inspectors',
    triggerEvent: 'adminController -> createStaffAccount (role: inspector)',
    description: 'Delivers proctor console login ID, temporary password, and mandatory first-login reset rule.',
    variables: [
      { key: 'name', label: 'Inspector Name', defaultValue: 'Prof. Vikram Menon' },
      { key: 'email', label: 'Login Email', defaultValue: 'inspector@college.edu' },
      { key: 'tempPassword', label: 'Temporary Password', defaultValue: 'LwInsp!47kTz' },
      { key: 'collegeName', label: 'Assigned College', defaultValue: 'RV Institute of Technology (RVIT)' },
    ],
  },
  {
    key: 'faculty_created',
    name: 'Faculty Onboarding & Section Allocation',
    category: 'auth_recovery',
    categoryLabel: 'Auth & Recovery',
    audience: 'Faculty / Subject Leads',
    triggerEvent: 'adminController -> createStaffAccount (role: faculty)',
    description: 'Sends temporary password and assigned college sections badge list to new faculty.',
    variables: [
      { key: 'name', label: 'Faculty Name', defaultValue: 'Prof. Kavitha Sharma' },
      { key: 'email', label: 'Faculty Email', defaultValue: 'faculty@college.edu' },
      { key: 'tempPassword', label: 'Temporary Password', defaultValue: 'LwFac#73mNp9' },
      { key: 'assignedSections', label: 'Assigned Sections (CSV)', defaultValue: 'BTECH-CSE-3A, BTECH-CSE-3B' },
    ],
  },
  {
    key: 'welcome_credentials',
    name: 'Candidate / Staff Credentials Welcome',
    category: 'auth_recovery',
    categoryLabel: 'Auth & Recovery',
    audience: 'Students / Bulk Enrolled Cohorts',
    triggerEvent: 'hierarchyController -> bulkEnrollStudents / createStudent',
    description: 'Dispatched when students or staff are enrolled with initial Hall Ticket and temporary credentials.',
    variables: [
      { key: 'recipientName', label: 'Recipient Name', defaultValue: 'Aarav Verma' },
      { key: 'role', label: 'Role', defaultValue: 'student' },
      { key: 'identifier', label: 'Hall Ticket / User ID', defaultValue: '24HU1A05F9' },
      { key: 'tempPassword', label: 'Temporary Password', defaultValue: 'Logic#2026Tmp' },
      { key: 'collegeName', label: 'College Name', defaultValue: 'RV Institute of Technology (RVIT)' },
    ],
  },
  {
    key: 'student_otp',
    name: 'Student Registration / Enrollment OTP',
    category: 'auth_recovery',
    categoryLabel: 'Auth & Recovery',
    audience: 'Students',
    triggerEvent: 'authController / candidateController / enrollmentController -> sendOtp',
    description: '6-digit verification OTP with 10-minute expiry timer and direct verification button.',
    variables: [
      { key: 'name', label: 'Student Name', defaultValue: 'Aarav Verma' },
      { key: 'email', label: 'Student Email', defaultValue: '24hu1a05f9@college.edu' },
      { key: 'otp', label: '6-Digit OTP', defaultValue: '482916' },
      { key: 'expiresMinutes', label: 'Expiry (Minutes)', defaultValue: '10' },
    ],
  },
  {
    key: 'admin_login_otp',
    name: 'Staff / Admin / Inspector Login OTP',
    category: 'auth_recovery',
    categoryLabel: 'Auth & Recovery',
    audience: 'Admin, Inspector, Faculty',
    triggerEvent: 'adminController -> adminLogin / sendStaffLoginOtpEmail',
    description: '2FA email verification code stamped with requester IP during privileged portal sign-ins.',
    variables: [
      { key: 'recipientName', label: 'Staff Name', defaultValue: 'LogicWhile Super Admin' },
      { key: 'role', label: 'Portal Role', defaultValue: 'super_admin' },
      { key: 'otp', label: '6-Digit Security Code', defaultValue: '930415' },
      { key: 'ip', label: 'Login IP Address', defaultValue: '103.21.44.18' },
    ],
  },
  {
    key: 'student_registered',
    name: 'Student Account Verified & Activated',
    category: 'auth_recovery',
    categoryLabel: 'Auth & Recovery',
    audience: 'Students',
    triggerEvent: 'authController -> verifyStudentOtp',
    description: 'Confirmation welcome email once OTP verification activates the candidate hall ticket.',
    variables: [
      { key: 'name', label: 'Student Name', defaultValue: 'Aarav Verma' },
      { key: 'email', label: 'Student Email', defaultValue: '24hu1a05f9@college.edu' },
      { key: 'hallTicket', label: 'Hall Ticket', defaultValue: '24HU1A05F9' },
      { key: 'collegeName', label: 'Institution', defaultValue: 'RV Institute of Technology (RVIT)' },
    ],
  },
  {
    key: 'password_reset',
    name: 'Multi-Portal Password Reset Link',
    category: 'auth_recovery',
    categoryLabel: 'Auth & Recovery',
    audience: 'Students, Faculty, Inspectors, Admins',
    triggerEvent: 'POST /api/auth/forgot-password',
    description: 'Single-use password reset token URL valid for 1 hour across all portals.',
    variables: [
      { key: 'name', label: 'User Name', defaultValue: 'Aarav Verma' },
      { key: 'role', label: 'Portal Role', defaultValue: 'Student' },
      { key: 'resetUrl', label: 'Reset Link URL', defaultValue: `${FRONTEND_URL}/reset-password?token=demo_token_xyz` },
    ],
  },
  {
    key: 'user_id_recovery',
    name: 'Forgot User ID / Hall Ticket Recovery',
    category: 'auth_recovery',
    categoryLabel: 'Auth & Recovery',
    audience: 'Students, Faculty, Inspectors, Admins',
    triggerEvent: 'POST /api/auth/forgot-user-id',
    description: 'Returns all registered User IDs, Hall Tickets, and direct portal sign-in links by email.',
    variables: [
      { key: 'name', label: 'Account Holder', defaultValue: 'Aarav Verma' },
      { key: 'email', label: 'Recovery Email', defaultValue: '24hu1a05f9@college.edu' },
      { key: 'userId', label: 'Recovered User ID / Hall Ticket', defaultValue: '24HU1A05F9' },
      { key: 'portalRole', label: 'Portal Role', defaultValue: 'Student Candidate' },
    ],
  },
  {
    key: 'exam_scheduled',
    name: 'Examination Scheduled & Hall Ticket',
    category: 'exam_lifecycle',
    categoryLabel: 'Exam Lifecycle',
    audience: 'Targeted Student Cohorts',
    triggerEvent: 'mailService / inspectorRoutes -> dispatchExamScheduled / sendExamInvitationEmail',
    description: 'Dispatches hall ticket, pass code, scheduled slot, proctoring regulations, and lobby link.',
    variables: [
      { key: 'studentName', label: 'Candidate Name', defaultValue: 'Aarav Verma' },
      { key: 'hallTicket', label: 'Hall Ticket', defaultValue: '24HU1A05F9' },
      { key: 'examTitle', label: 'Exam Title', defaultValue: 'Data Structures & Systems Assessment' },
      { key: 'examCode', label: 'Exam Code', defaultValue: 'GR-RVIT-HHABJ5' },
      { key: 'durationMinutes', label: 'Duration (Mins)', defaultValue: '60' },
      { key: 'scheduledAt', label: 'Scheduled Slot', defaultValue: 'Today • 10:00 AM IST' },
    ],
  },
  {
    key: 'exam_started_reminder',
    name: 'Live Exam Started Urgent Reminder',
    category: 'exam_lifecycle',
    categoryLabel: 'Exam Lifecycle',
    audience: 'Lobby / Late Candidates',
    triggerEvent: 'emailService -> sendExamStartedReminderEmail',
    description: 'Urgent call-to-action sent when the inspector starts the synchronized server exam timer.',
    variables: [
      { key: 'recipientName', label: 'Candidate Name', defaultValue: 'Aarav Verma' },
      { key: 'hallTicket', label: 'Hall Ticket', defaultValue: '24HU1A05F9' },
      { key: 'examCode', label: 'Exam Code', defaultValue: 'GR-RVIT-HHABJ5' },
      { key: 'examTitle', label: 'Exam Title', defaultValue: 'Data Structures & Systems Assessment' },
    ],
  },
  {
    key: 'submission_receipt',
    name: 'Digital Exam Submission Audit Receipt',
    category: 'exam_lifecycle',
    categoryLabel: 'Exam Lifecycle',
    audience: 'Exam Candidates',
    triggerEvent: 'inspectorRoutes / examCodeController -> sendCandidateSubmissionReceiptEmail',
    description: 'Provides candidate with answered count and cryptographic audit ledger submission hash.',
    variables: [
      { key: 'recipientName', label: 'Candidate Name', defaultValue: 'Aarav Verma' },
      { key: 'hallTicket', label: 'Hall Ticket', defaultValue: '24HU1A05F9' },
      { key: 'examTitle', label: 'Exam Title', defaultValue: 'Data Structures & Systems Assessment' },
      { key: 'answeredCount', label: 'Answered Count', defaultValue: '28' },
      { key: 'totalQuestions', label: 'Total Questions', defaultValue: '30' },
      { key: 'submissionHash', label: 'Audit Hash', defaultValue: 'sha256:9f84b2c1e0a77124d981f0b1c3' },
    ],
  },
  {
    key: 'result_report',
    name: 'Official Score Card & Result Report',
    category: 'exam_lifecycle',
    categoryLabel: 'Exam Lifecycle',
    audience: 'Exam Candidates',
    triggerEvent: 'gradingService / inspectorRoutes -> sendResultPublishedEmail / sendResultReport',
    description: 'Rich performance scorecard with score, percentage, cohort rank, time taken, and breakdown link.',
    variables: [
      { key: 'studentName', label: 'Candidate Name', defaultValue: 'Aarav Verma' },
      { key: 'hallTicket', label: 'Hall Ticket', defaultValue: '24HU1A05F9' },
      { key: 'examTitle', label: 'Exam Title', defaultValue: 'Data Structures & Systems Assessment' },
      { key: 'examCode', label: 'Exam Code', defaultValue: 'GR-RVIT-HHABJ5' },
      { key: 'score', label: 'Score', defaultValue: '88' },
      { key: 'maxScore', label: 'Max Score', defaultValue: '100' },
      { key: 'rank', label: 'Cohort Rank', defaultValue: '3' },
    ],
  },
  {
    key: 'faculty_paper_allocated',
    name: 'Faculty Question Paper Allocation',
    category: 'exam_lifecycle',
    categoryLabel: 'Exam Lifecycle',
    audience: 'Faculty / Paper Authors',
    triggerEvent: 'mailService -> sendFacultyPaperAllocated',
    description: 'Notifies faculty authority of paper code assignment, question count, and review deadline.',
    variables: [
      { key: 'facultyName', label: 'Faculty Name', defaultValue: 'Prof. Kavitha Sharma' },
      { key: 'examTitle', label: 'Exam Title', defaultValue: 'Operating Systems Mid-Term' },
      { key: 'examCode', label: 'Exam Code', defaultValue: 'OS-2026-MID' },
      { key: 'questionCount', label: 'Question Count', defaultValue: '50' },
      { key: 'submissionDeadline', label: 'Review Deadline', defaultValue: 'Friday, 5:00 PM IST' },
    ],
  },
  {
    key: 'inspector_notice',
    name: 'Official Proctor Direct Notice / Warning',
    category: 'proctoring_security',
    categoryLabel: 'Proctoring & Security',
    audience: 'Exam Candidates',
    triggerEvent: 'inspectorRoutes -> sendInspectorDirectNoticeEmail',
    description: 'Real-time warning/whisper dispatched by the invigilator to a flagged candidate.',
    variables: [
      { key: 'recipientName', label: 'Candidate Name', defaultValue: 'Aarav Verma' },
      { key: 'hallTicket', label: 'Hall Ticket', defaultValue: '24HU1A05F9' },
      { key: 'examTitle', label: 'Exam Title', defaultValue: 'Data Structures & Systems Assessment' },
      { key: 'inspectorName', label: 'Inspector Name', defaultValue: 'Prof. Vikram Menon' },
      { key: 'noticeText', label: 'Warning Message', defaultValue: 'Please keep your face centered on webcam and avoid looking away from the screen.' },
    ],
  },
  {
    key: 'inspector_issue_alert',
    name: 'Telemetry Flag Alert to Inspector',
    category: 'proctoring_security',
    categoryLabel: 'Proctoring & Security',
    audience: 'Assigned Exam Inspectors',
    triggerEvent: 'inspectorRoutes -> sendInspectorIssueAlertEmail',
    description: 'Alerts inspector when candidate AI telemetry detects repeated tab switch or multiple faces.',
    variables: [
      { key: 'participantName', label: 'Candidate Name', defaultValue: 'Aarav Verma' },
      { key: 'hallTicket', label: 'Hall Ticket', defaultValue: '24HU1A05F9' },
      { key: 'examTitle', label: 'Exam Title', defaultValue: 'Data Structures & Systems Assessment' },
      { key: 'issueType', label: 'Violation Type', defaultValue: 'fullscreen_exit_and_tab_switch' },
      { key: 'details', label: 'Telemetry Details', defaultValue: 'Candidate exited fullscreen twice within 45 seconds.' },
      { key: 'severity', label: 'Severity', defaultValue: 'high' },
    ],
  },
  {
    key: 'termination_alert',
    name: 'Proctoring Session Termination Alert',
    category: 'proctoring_security',
    categoryLabel: 'Proctoring & Security',
    audience: 'Super Admin / Exam Controller',
    triggerEvent: 'terminationBatcher / violationController -> sendTerminationAlertEmail',
    description: 'Immediate security alert sent when an active candidate exam session is terminated.',
    variables: [
      { key: 'participantName', label: 'Candidate Name', defaultValue: 'Aarav Verma' },
      { key: 'hallTicket', label: 'Hall Ticket', defaultValue: '24HU1A05F9' },
      { key: 'examTitle', label: 'Exam Title', defaultValue: 'Data Structures & Systems Assessment' },
      { key: 'reason', label: 'Termination Reason', defaultValue: 'Exceeded maximum allowed tab-switch limit (3/3)' },
      { key: 'violationCount', label: 'Violation Count', defaultValue: '3' },
    ],
  },
  {
    key: 'batch_termination_summary',
    name: 'Batched 5-Min Termination Digest',
    category: 'proctoring_security',
    categoryLabel: 'Proctoring & Security',
    audience: 'Super Admin / Exam Controller',
    triggerEvent: 'terminationBatcher -> flushBatch (>3 terminations in 5 mins)',
    description: 'Debounced digest consolidating multiple exam terminations within a 5-minute window.',
    variables: [
      { key: 'examTitle', label: 'Exam Title', defaultValue: 'Data Structures & Systems Assessment' },
      { key: 'terminationCount', label: 'Terminated Count', defaultValue: '6' },
      { key: 'windowMinutes', label: 'Window (Mins)', defaultValue: '5' },
      { key: 'summaryNote', label: 'Summary Context', defaultValue: 'Room B12 experienced mass network/tab focus drops during check.' },
    ],
  },
  {
    key: 'admin_alert',
    name: 'Executive Admin Incident Alert',
    category: 'proctoring_security',
    categoryLabel: 'Proctoring & Security',
    audience: 'Administrators / Super Admin',
    triggerEvent: 'violationController / authController -> sendAdminAlert',
    description: 'Structured administrative security telemetry bulletin with detail table and audit link.',
    variables: [
      { key: 'alertType', label: 'Alert Mode', defaultValue: 'system_alert' },
      { key: 'title', label: 'Alert Headline', defaultValue: 'Elevated Failed Login Rate Detected' },
      { key: 'message', label: 'Incident Description', defaultValue: 'Repeated invalid password attempts blocked from perimeter IP range.' },
      { key: 'source', label: 'Telemetry Source', defaultValue: 'authController -> lockoutGuard' },
    ],
  },
  {
    key: 'admin_system_alert',
    name: 'System Alerting Agent Security Bulletin',
    category: 'proctoring_security',
    categoryLabel: 'Proctoring & Security',
    audience: 'Operations / Super Admin',
    triggerEvent: 'systemAlertService -> sendSystemAlertAdminEmail',
    description: 'Automated dispatch from SystemAlertingAgent when high-severity infrastructure errors occur.',
    variables: [
      { key: 'alertType', label: 'Agent Event Type', defaultValue: 'DB_LATENCY_SPIKE' },
      { key: 'severity', label: 'Severity', defaultValue: 'HIGH' },
      { key: 'message', label: 'Alert Message', defaultValue: 'Connection pool utilization briefly exceeded 85% during concurrent lobby join.' },
      { key: 'ip', label: 'Origin IP', defaultValue: '10.0.4.12' },
    ],
  },
  {
    key: 'daily_backup_completed',
    name: 'Nightly Google Drive Backup Report',
    category: 'support_ops',
    categoryLabel: 'Support & Operations',
    audience: 'Super Admin',
    triggerEvent: 'backupScheduler -> nightly cron -> sendAdminAlert(daily_backup_completed)',
    description: 'Confirms scheduled disaster-recovery archive count and Google Drive sync status.',
    variables: [
      { key: 'backupId', label: 'Snapshot ID', defaultValue: 'bkp_20261128_0200' },
      { key: 'fileCount', label: 'Archived Artifacts', defaultValue: '14' },
      { key: 'driveStatus', label: 'Google Drive Sync', defaultValue: 'UPLOADED_VERIFIED' },
      { key: 'trigger', label: 'Trigger Mode', defaultValue: 'scheduled' },
    ],
  },
  {
    key: 'contact_auto_reply',
    name: 'Support Contact Inquiry Auto-Reply',
    category: 'support_ops',
    categoryLabel: 'Support & Operations',
    audience: 'External Visitors / Institutions',
    triggerEvent: 'contactRoutes -> POST /api/contact',
    description: 'Sends immediate inquiry reference ticket ID and 24-hour SLA acknowledgement.',
    variables: [
      { key: 'senderName', label: 'Sender Name', defaultValue: 'Dr. Ramesh Babu' },
      { key: 'referenceId', label: 'Ticket Reference ID', defaultValue: 'REF-2026-84102' },
      { key: 'subject', label: 'Inquiry Subject', defaultValue: 'Institutional Sandbox & 500-Seat Capacity' },
      { key: 'message', label: 'Inquiry Excerpt', defaultValue: 'Requesting institutional onboarding timeline for Autumn placement exams.' },
    ],
  },
  {
    key: 'contact_admin_notification',
    name: 'Support Inquiry Admin Routing Alert',
    category: 'support_ops',
    categoryLabel: 'Support & Operations',
    audience: 'Platform Support & Admin',
    triggerEvent: 'contactRoutes -> enqueueContactAdminNotification',
    description: 'Forwards submitted contact inquiry with reply-to header and batch scale metadata to Admin.',
    variables: [
      { key: 'senderName', label: 'Sender Name', defaultValue: 'Dr. Ramesh Babu' },
      { key: 'senderEmail', label: 'Sender Email', defaultValue: 'ramesh.babu@university.edu' },
      { key: 'referenceId', label: 'Ticket Reference ID', defaultValue: 'REF-2026-84102' },
      { key: 'subject', label: 'Inquiry Subject', defaultValue: 'Institutional Sandbox & 500-Seat Capacity' },
      { key: 'message', label: 'Message Body', defaultValue: 'We want to schedule a 500-candidate pilot next week.' },
      { key: 'institution', label: 'Institution', defaultValue: 'Apex Institute of Technology' },
    ],
  },
  {
    key: 'mail_forwarded',
    name: 'Forwarded & Relay Copy Wrapper',
    category: 'support_ops',
    categoryLabel: 'Support & Operations',
    audience: 'HODs, Exam Cell, Backup Inboxes',
    triggerEvent: 'mailService -> forwardMailLogById / Auto-Forwarder Rules',
    description: 'Wraps any manually or automatically forwarded email with original sender & audit metadata.',
    variables: [
      { key: 'originalTo', label: 'Original Recipient', defaultValue: 'student@college.edu' },
      { key: 'originalTemplate', label: 'Original Template', defaultValue: 'password_reset' },
      { key: 'originalSubject', label: 'Original Subject', defaultValue: 'Password Reset Request — LogicWhile LiRE' },
      { key: 'note', label: 'Forwarding Note', defaultValue: 'Forwarded per institutional exam-cell escalation.' },
    ],
  },
  {
    key: 'custom_broadcast',
    name: 'Custom / Cohort Assessment Broadcast',
    category: 'support_ops',
    categoryLabel: 'Support & Operations',
    audience: 'Selected Cohort / Recipients',
    triggerEvent: 'POST /api/admin/mail-logs/dispatch',
    description: 'Branded executive bulletin supporting college/course/branch/section cohort targeting.',
    variables: [
      { key: 'headline', label: 'Headline', defaultValue: 'Mandatory Pre-Exam System Check Notice' },
      { key: 'recipientGreeting', label: 'Greeting', defaultValue: 'Dear B.Tech CSE Candidates,' },
      { key: 'messageBody', label: 'Broadcast Message', defaultValue: 'Please complete your browser camera & fullscreen verification test before 9:30 AM tomorrow.' },
      { key: 'ctaLabel', label: 'Button Text', defaultValue: 'Open Student Portal →' },
      { key: 'ctaUrl', label: 'Button URL', defaultValue: `${FRONTEND_URL}/login` },
    ],
  },
];

export function getMailTemplateCatalog(): MailTemplateCatalogEntry[] {
  return MAIL_TEMPLATE_CATALOG;
}

/**
 * Renders any catalog template using merged default + override variables.
 */
export function renderMailTemplateByKey(
  templateKey: string,
  overrides: Record<string, any> = {}
): { subject: string; html: string; text: string; templateKey: string; metadata: Record<string, any> } {
  const entry = MAIL_TEMPLATE_CATALOG.find((t) => t.key === templateKey);
  const v: Record<string, any> = {};
  if (entry) {
    for (const spec of entry.variables) {
      v[spec.key] = overrides[spec.key] !== undefined && String(overrides[spec.key]).trim() !== ''
        ? overrides[spec.key]
        : spec.defaultValue;
    }
  }
  Object.assign(v, overrides);

  let rendered: { subject: string; html: string; text: string };
  switch (templateKey) {
    case 'admin_welcome':
      rendered = renderAdminWelcomeTemplate({
        name: v.name,
        email: v.email,
        role: v.role,
        tempPassword: v.tempPassword,
      });
      break;
    case 'inspector_created':
      rendered = renderInspectorCreatedTemplate({
        name: v.name,
        email: v.email,
        tempPassword: v.tempPassword,
        collegeName: v.collegeName,
      });
      break;
    case 'faculty_created':
      rendered = renderFacultyCreatedTemplate({
        name: v.name,
        email: v.email,
        tempPassword: v.tempPassword,
        assignedSections: Array.isArray(v.assignedSections)
          ? v.assignedSections
          : String(v.assignedSections || '').split(',').map((s) => s.trim()).filter(Boolean),
      });
      break;
    case 'welcome_credentials':
      rendered = renderWelcomeCredentialsTemplate({
        recipientName: v.recipientName,
        role: v.role,
        identifier: v.identifier,
        tempPassword: v.tempPassword,
        collegeName: v.collegeName,
      });
      break;
    case 'student_otp':
      rendered = renderStudentOtpTemplate({
        name: v.name,
        email: v.email,
        otp: v.otp,
        expiresMinutes: Number(v.expiresMinutes || 10),
      });
      break;
    case 'admin_login_otp':
      rendered = renderAdminLoginOtpTemplate({
        recipientName: v.recipientName,
        otp: v.otp,
        role: v.role,
        ip: v.ip,
      });
      break;
    case 'student_registered':
      rendered = renderStudentRegisteredTemplate({
        name: v.name,
        email: v.email,
        hallTicket: v.hallTicket,
        collegeName: v.collegeName,
      });
      break;
    case 'password_reset':
      rendered = renderPasswordResetTemplate({
        name: v.name,
        email: v.email || '24hu1a05f9@college.edu',
        portalRole: v.role || v.portalRole,
        resetUrl: v.resetUrl,
      });
      break;
    case 'user_id_recovery':
      rendered = renderUserIdRecoveryTemplate({
        name: v.name,
        email: v.email,
        recoveredAccounts: [
          {
            userId: v.userId,
            portalRole: v.portalRole,
            loginUrl: `${FRONTEND_URL}/login`,
          },
        ],
      });
      break;
    case 'exam_scheduled':
      rendered = renderExamScheduledTemplate({
        studentName: v.studentName,
        hallTicket: v.hallTicket,
        examTitle: v.examTitle,
        examCode: v.examCode,
        durationMinutes: Number(v.durationMinutes || 60),
        scheduledAt: v.scheduledAt,
      });
      break;
    case 'exam_started_reminder':
      rendered = renderExamStartedReminderTemplate({
        recipientName: v.recipientName,
        hallTicket: v.hallTicket,
        examCode: v.examCode,
        examTitle: v.examTitle,
      });
      break;
    case 'submission_receipt':
      rendered = renderSubmissionReceiptTemplate({
        recipientName: v.recipientName,
        hallTicket: v.hallTicket,
        examTitle: v.examTitle,
        answeredCount: Number(v.answeredCount || 25),
        totalQuestions: Number(v.totalQuestions || 30),
        submissionHash: v.submissionHash,
      });
      break;
    case 'result_report': {
      const score = Number(v.score || 0);
      const maxScore = Math.max(1, Number(v.maxScore || 100));
      rendered = renderResultReportTemplate({
        studentName: v.studentName,
        hallTicket: v.hallTicket,
        examTitle: v.examTitle,
        examCode: v.examCode,
        score,
        maxScore,
        percentage: Math.round((score / maxScore) * 100),
        rank: v.rank,
        correctCount: Math.max(0, Math.round((score / maxScore) * 30)),
        wrongCount: Math.max(0, 30 - Math.round((score / maxScore) * 30)),
        timeTakenSeconds: 2450,
      });
      break;
    }
    case 'faculty_paper_allocated':
      rendered = renderFacultyPaperAllocatedTemplate({
        facultyName: v.facultyName,
        examTitle: v.examTitle,
        examCode: v.examCode,
        questionCount: Number(v.questionCount || 50),
        submissionDeadline: v.submissionDeadline,
      });
      break;
    case 'inspector_notice':
      rendered = renderInspectorNoticeTemplate({
        recipientName: v.recipientName,
        hallTicket: v.hallTicket,
        examTitle: v.examTitle,
        inspectorName: v.inspectorName,
        noticeText: v.noticeText,
      });
      break;
    case 'inspector_issue_alert':
      rendered = renderInspectorIssueAlertTemplate({
        participantName: v.participantName,
        hallTicket: v.hallTicket,
        examTitle: v.examTitle,
        issueType: v.issueType,
        details: v.details,
        severity: v.severity,
      });
      break;
    case 'termination_alert':
      rendered = renderTerminationAlertTemplate({
        participantName: v.participantName,
        hallTicket: v.hallTicket,
        examTitle: v.examTitle,
        reason: v.reason,
        violationCount: Number(v.violationCount || 3),
      });
      break;
    case 'batch_termination_summary':
      rendered = renderBatchTerminationSummaryTemplate({
        examTitle: v.examTitle,
        terminationCount: Number(v.terminationCount || 5),
        windowMinutes: Number(v.windowMinutes || 5),
        summaryNote: v.summaryNote,
      });
      break;
    case 'admin_alert':
      rendered = renderAdminAlertTemplate({
        alertType: v.alertType || 'system_alert',
        title: v.title,
        message: v.message,
        details: { source: v.source || 'Admin Console' },
      });
      break;
    case 'admin_system_alert':
      rendered = renderAdminSystemAlertTemplate({
        alertType: v.alertType,
        severity: v.severity,
        message: v.message,
        ip: v.ip,
      });
      break;
    case 'daily_backup_completed':
      rendered = renderDailyBackupTemplate({
        backupId: v.backupId,
        fileCount: v.fileCount,
        driveStatus: v.driveStatus,
        trigger: v.trigger,
      });
      break;
    case 'contact_auto_reply':
      rendered = renderContactAutoReplyTemplate({
        senderName: v.senderName,
        referenceId: v.referenceId,
        subject: v.subject,
        message: v.message,
      });
      break;
    case 'contact_admin_notification':
      rendered = renderContactAdminNotificationTemplate({
        senderName: v.senderName,
        senderEmail: v.senderEmail,
        referenceId: v.referenceId,
        subject: v.subject,
        message: v.message,
        institution: v.institution,
      });
      break;
    case 'mail_forwarded':
      rendered = renderMailForwardedTemplate({
        originalTo: v.originalTo,
        originalTemplate: v.originalTemplate,
        originalSubject: v.originalSubject,
        note: v.note,
      });
      break;
    case 'custom_broadcast':
    default:
      rendered = renderCustomBroadcastTemplate({
        headline: v.headline || 'Institutional Assessment Notice',
        recipientGreeting: v.recipientGreeting,
        messageBody: v.messageBody || '<p>Please review the updated assessment details on the portal.</p>',
        ctaLabel: v.ctaLabel,
        ctaUrl: v.ctaUrl,
      });
      break;
  }

  return {
    ...rendered,
    templateKey: entry?.key || templateKey || 'custom_broadcast',
    metadata: { ...v, renderedFromCatalog: true },
  };
}
