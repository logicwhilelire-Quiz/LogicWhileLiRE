import nodemailer, { Transporter } from 'nodemailer';
import { supabase } from '../db/supabase';

// ============================================================================
// CONFIGURATION & ENVIRONMENT VARIABLES
// All values MUST come from env in production — no hardcoded defaults allowed.
// ============================================================================

// In dev/test fall back to sensible mock values; productionBootGuard enforces real values
const IS_PROD = process.env.NODE_ENV === 'production';

export const MAIL_DOMAIN: string = process.env.MAIL_DOMAIN || 'logicwhilelire.com';

export const EMAIL_FROM: string = (() => {
  const v = process.env.EMAIL_FROM || process.env.OTP_FROM_EMAIL;
  return v || `LogicWhile LiRE <admin@${MAIL_DOMAIN}>`;
})();

export const EMAIL_FROM_NAME: string = process.env.EMAIL_FROM_NAME || 'LogicWhileLiRE';

export const SUPPORT_EMAIL: string = process.env.SUPPORT_EMAIL || 'logicwhilelire@gmail.com';

export const ADMIN_EMAIL: string = process.env.ADMIN_EMAIL || process.env.ADMIN_ALERT_EMAIL || 'logicwhilelire@gmail.com';

export const SUPPORT_PHONE: string = process.env.ADMIN_PHONE || '+91 9493734553';

export const FRONTEND_URL: string = (() => {
  const v = process.env.FRONTEND_URL || process.env.CLIENT_ORIGIN || (IS_PROD ? 'https://logicwhilelire.com' : 'http://localhost:5173');
  const origin = v.split(',')[0].trim();
  return origin.replace(/\/+$/, '');
})();

export function getFrontendUrl(): string {
  return FRONTEND_URL;
}

export function getHostedLogoUrl(): string {
  return `${getFrontendUrl()}/logo.png`;
}

// ============================================================================
// DAILY FREE-TIER QUOTA TRACKER (Configurable Cap + Admin Warning)
// ============================================================================
export class DailyEmailQuotaTracker {
  private dateKey: string;
  private sentCount: number = 0;
  private warningEmitted: boolean = false;
  private customCap?: number;

  constructor() {
    this.dateKey = this.getUtcTodayKey();
  }

  private getUtcTodayKey(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private checkDateRollover(): void {
    const today = this.getUtcTodayKey();
    if (today !== this.dateKey) {
      this.dateKey = today;
      this.sentCount = 0;
      this.warningEmitted = false;
    }
  }

  public getCap(): number {
    if (this.customCap !== undefined) return this.customCap;
    return parseInt(process.env.EMAIL_DAILY_CAP || '100', 10);
  }

  public setCap(cap: number): void {
    this.customCap = cap;
  }

  public getStats(): {
    dateKey: string;
    sentCount: number;
    dailyCap: number;
    remaining: number;
    warningThreshold: number;
    isWarning: boolean;
    isExceeded: boolean;
  } {
    this.checkDateRollover();
    const cap = this.getCap();
    const warningThreshold = Math.floor(cap * 0.8);
    return {
      dateKey: this.dateKey,
      sentCount: this.sentCount,
      dailyCap: cap,
      remaining: Math.max(0, cap - this.sentCount),
      warningThreshold,
      isWarning: this.sentCount >= warningThreshold,
      isExceeded: this.sentCount >= cap,
    };
  }

  public canSend(): { allowed: boolean; reason?: string } {
    this.checkDateRollover();
    const cap = this.getCap();
    if (this.sentCount >= cap) {
      const msg = `Daily free-tier email limit reached (${this.sentCount}/${cap}) for date ${this.dateKey}. Outbound email blocked to prevent overage.`;
      console.error(`[EMAIL_DAILY_CAP_EXCEEDED] 🛑 ${msg}`);
      return { allowed: false, reason: msg };
    }
    return { allowed: true };
  }

  public recordSent(): void {
    this.checkDateRollover();
    this.sentCount++;
    const cap = this.getCap();
    const warningThreshold = Math.floor(cap * 0.8);

    if (this.sentCount >= warningThreshold && !this.warningEmitted) {
      this.warningEmitted = true;
      console.warn(
        `\n========================================================================\n` +
        `⚠️  [EMAIL DAILY CAP WARNING] 80% OF FREE-TIER LIMIT CONSUMED!\n` +
        `   Date: ${this.dateKey} | Sent: ${this.sentCount} / ${cap} (Remaining: ${Math.max(0, cap - this.sentCount)})\n` +
        `   Configurable via EMAIL_DAILY_CAP environment variable.\n` +
        `========================================================================\n`
      );
    }

    if (this.sentCount >= cap) {
      console.error(
        `\n========================================================================\n` +
        `🛑  [EMAIL DAILY CAP EXCEEDED] 100% OF FREE-TIER LIMIT REACHED!\n` +
        `   Date: ${this.dateKey} | Sent: ${this.sentCount} / ${cap}\n` +
        `   Outbound emails will be halted until 00:00 UTC rollover.\n` +
        `========================================================================\n`
      );
    }
  }

  public resetForTesting(): void {
    this.sentCount = 0;
    this.warningEmitted = false;
    this.dateKey = this.getUtcTodayKey();
  }
}

export const dailyEmailQuota = new DailyEmailQuotaTracker();

// ============================================================================
// TRANSPORTER SETUP — Primary (Resend SMTP), Fallback (Brevo SMTP)
// Brevo activates automatically when Resend daily cap is hit.
// ============================================================================
let primaryTransporter: Transporter | null = null;
let brevoTransporter: Transporter | null = null;

/** Primary SMTP transport (Resend or generic SMTP_HOST) */
export function getTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  if (!primaryTransporter) {
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    primaryTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: { rejectUnauthorized: IS_PROD },
    });
  }
  return primaryTransporter;
}

/**
 * Brevo SMTP fallback transport.
 * Activated when: Resend daily cap is exceeded OR RESEND_API_KEY is absent.
 * Configuration env vars: BREVO_SMTP_USER (your Brevo login email),
 *   BREVO_SMTP_PASS (Brevo SMTP key starting with xsmtp...),
 *   BREVO_SMTP_HOST (default: smtp-relay.brevo.com),
 *   BREVO_SMTP_PORT (default: 587)
 */
export function getBrevoTransporter(): Transporter | null {
  const user = process.env.BREVO_SMTP_USER;
  const pass = process.env.BREVO_SMTP_PASS || process.env.BREVO_API_KEY;
  if (!user || !pass) return null;

  if (!brevoTransporter) {
    const host = process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com';
    const port = parseInt(process.env.BREVO_SMTP_PORT || '587', 10);
    brevoTransporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: { rejectUnauthorized: IS_PROD },
    });
  }
  return brevoTransporter;
}

/**
 * Dedicated Brevo fallback dispatcher for when Resend daily cap is reached
 * or Resend API returns HTTP 429/402.
 */
export async function sendViaBrevoFallback(payload: EmailPayload): Promise<boolean> {
  const brevo = getBrevoTransporter();
  const toStr = Array.isArray(payload.to) ? payload.to.join(', ') : payload.to;
  if (!brevo) {
    if (!IS_PROD && process.env.ENABLE_BREVO_MOCK === 'true') {
      console.log(`[Brevo-Fallback-Mock] (${payload.emailType}) To: ${toStr} | Subject: "${payload.subject}" (Resend cap fallback simulation)`);
      return true;
    }
    throw new Error('Brevo fallback transport not configured (BREVO_SMTP_USER / BREVO_SMTP_PASS missing)');
  }
  const info = await brevo.sendMail({
    from: EMAIL_FROM,
    to: toStr,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    replyTo: payload.replyTo,
  });
  console.log(`[Brevo-Fallback] ✅ Delivered ${payload.emailType} to ${toStr} via Brevo SMTP (id: ${info.messageId})`);
  return true;
}

export async function verifySmtpConnection(): Promise<{ connected: boolean; error?: string }> {
  if (process.env.RESEND_API_KEY) {
    return { connected: true };
  }
  const t = getTransporter();
  if (!t) {
    return { connected: false, error: 'SMTP credentials or RESEND_API_KEY missing in environment variables' };
  }
  try {
    await t.verify();
    return { connected: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'SMTP verification failed';
    return { connected: false, error: msg };
  }
}

// ============================================================================
// PAYLOAD INTERFACES & DELIVERABILITY LOGGING
// ============================================================================
export interface EmailPayload {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
  emailType:
    | 'otp'
    | 'result'
    | 'termination_alert'
    | 'batch_termination_summary'
    | 'password_reset'
    | 'invitation'
    | 'submission_receipt'
    | 'inspector_notice'
    | 'inspector_issue_alert'
    | 'welcome'
    | 'verification'
    | 'welcome_credentials'
    | 'email_verification_otp'
    | 'exam_scheduled'
    | 'exam_started_reminder'
    | 'result_published'
    | 'contact_auto_reply'
    | 'contact_admin_notification'
    | 'admin_login_otp'
    | 'admin_system_alert';
  replyTo?: string;
  examId?: string;
  sessionId?: string;
  participantId?: string;
  metadata?: Record<string, unknown>;
}

export async function logDeliverableFailure(
  payload: EmailPayload,
  errorMessage: string,
  attemptCount: number
): Promise<void> {
  const recipient = Array.isArray(payload.to) ? payload.to.join(', ') : payload.to;
  try {
    await supabase.from('deliverable_failures').insert({
      recipient_email: recipient,
      email_type: payload.emailType,
      exam_id: payload.examId || null,
      session_id: payload.sessionId || null,
      participant_id: payload.participantId || null,
      subject: payload.subject,
      error_message: errorMessage,
      attempt_count: attemptCount,
      metadata: payload.metadata || null,
    });
  } catch (dbErr) {
    console.error('[Mail] Failed to record deliverable failure in database:', dbErr);
  }
}

// ============================================================================
// SEND DISPATCHER (Resend API -> SMTP -> Dev Mock)
// ============================================================================
export async function sendWithRetry(payload: EmailPayload, maxAttempts: number = 3): Promise<boolean> {
  const toList = Array.isArray(payload.to) ? payload.to : [payload.to];
  const toStr = toList.join(', ');
  const resendApiKey = process.env.RESEND_API_KEY;
  const smtpTransporter = getTransporter();
  const brevoFallback = getBrevoTransporter();

  // 1. Check daily cap — if exceeded, route to Brevo fallback before blocking
  const quotaCheck = dailyEmailQuota.canSend();
  if (!quotaCheck.allowed) {
    console.log(`[Mail-Fallback] ⚠️ Resend daily cap reached (${dailyEmailQuota.getCap()}/day). Engaging Brevo fallback transport...`);
    if (brevoFallback || (!IS_PROD && process.env.ENABLE_BREVO_MOCK === 'true')) {
      try {
        const sent = await sendViaBrevoFallback(payload);
        if (sent) return true;
      } catch (brevoErr: any) {
        console.error(`[Brevo-Fallback] Delivery failed: ${brevoErr?.message}`);
      }
    }
    const err = new Error(quotaCheck.reason || 'Daily email quota exceeded and no secondary fallback succeeded');
    await logDeliverableFailure(payload, err.message, 0);
    if (IS_PROD) throw err;
    return false;
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Priority 1: RESEND API (HTTPS direct)
      if (resendApiKey) {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: EMAIL_FROM,
            to: toList,
            subject: payload.subject,
            html: payload.html,
            text: payload.text,
            reply_to: payload.replyTo || undefined,
          }),
        });

        const resData = (await response.json().catch(() => ({}))) as any;
        if (!response.ok) {
          const errMsg = resData?.message || `Resend API returned status ${response.status}`;
          // On rate-limit or quota error from Resend, try Brevo fallback immediately
          if (response.status === 429 || response.status === 402) {
            throw new Error(`[RESEND_QUOTA] ${errMsg}`);
          }
          throw new Error(errMsg);
        }

        dailyEmailQuota.recordSent();
        console.log(`[Resend-API] ✅ ${payload.emailType} → ${toStr} (id: ${resData?.id || 'ok'}) attempt ${attempt}`);
        return true;
      }

      // Priority 2: Primary SMTP (Resend SMTP relay or custom)
      if (smtpTransporter) {
        const info = await smtpTransporter.sendMail({
          from: EMAIL_FROM,
          to: toStr,
          subject: payload.subject,
          text: payload.text,
          html: payload.html,
          replyTo: payload.replyTo,
        });
        dailyEmailQuota.recordSent();
        console.log(`[SMTP] ✅ ${payload.emailType} → ${toStr} (id: ${info.messageId}) attempt ${attempt}`);
        return true;
      }

      // Priority 3: Brevo SMTP fallback
      if (brevoFallback) {
        const info = await brevoFallback.sendMail({
          from: EMAIL_FROM,
          to: toStr,
          subject: payload.subject,
          text: payload.text,
          html: payload.html,
          replyTo: payload.replyTo,
        });
        dailyEmailQuota.recordSent();
        console.log(`[Brevo-SMTP] ✅ ${payload.emailType} → ${toStr} (id: ${info.messageId}) attempt ${attempt}`);
        return true;
      }

      // Priority 4: Mock dev fallback — never allowed in production
      if (IS_PROD) {
        throw new Error('No mail transport configured in production. Set RESEND_API_KEY or BREVO_SMTP_USER/PASS.');
      }
      dailyEmailQuota.recordSent();
      console.log(`[MAIL-MOCK] (${payload.emailType}) To: ${toStr} | Subject: "${payload.subject}" [Attempt ${attempt}]`);
      return true;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isQuotaErr = lastError.message.startsWith('[RESEND_QUOTA]');
      console.warn(`[Mail] Attempt ${attempt}/${maxAttempts} failed for ${toStr} (${payload.emailType}): ${lastError.message}`);

      // On Resend quota/rate-limit error, immediately try Brevo fallback
      if (isQuotaErr && (brevoFallback || !IS_PROD)) {
        try {
          const sent = await sendViaBrevoFallback(payload);
          if (sent) return true;
        } catch (brevoErr: any) {
          console.error(`[Brevo-Fallback] Failed: ${brevoErr?.message}`);
        }
      }

      if (attempt < maxAttempts) {
        const delayMs = attempt * 1000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  // All attempts exhausted
  const errorMessage = lastError?.message || 'Email delivery failed after maximum retries';
  await logDeliverableFailure(payload, errorMessage, maxAttempts);

  if (IS_PROD) throw lastError || new Error(errorMessage);
  return false;
}

// ============================================================================
// BRAND EMAIL WRAPPER (Hosted Logo URL & Support Contact Footer)
// ============================================================================
export function wrapBrandTemplate(title: string, innerHtml: string): string {
  const logoUrl = getHostedLogoUrl();
  const supportEmail = SUPPORT_EMAIL;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0; padding:0; background-color:#0b1329; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#f0f4f8;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#0b1329; padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:600px; background-color:#101d3f; border:1px solid rgba(255,255,255,0.08); border-radius:16px; overflow:hidden; box-shadow:0 8px 32px rgba(0,0,0,0.6);" cellspacing="0" cellpadding="0" border="0">
          
          <!-- Brand Header with HOSTED LOGO (No CID attachments) -->
          <tr>
            <td style="padding:32px 32px 24px; text-align:center; background:linear-gradient(180deg, rgba(27,95,181,0.2) 0%, rgba(16,29,63,0) 100%); border-bottom:1px solid rgba(255,255,255,0.06);">
              <div style="margin-bottom:14px; text-align:center;">
                <img src="${logoUrl}" alt="LogicWhileLiRE Logo" width="56" height="56" style="display:inline-block; border-radius:12px; border:1px solid rgba(56,189,248,0.3); background-color:#0b1329;" />
              </div>
              <h1 style="margin:0 0 6px; font-size:24px; font-weight:800; color:#f0f4f8; letter-spacing:-0.5px;">
                LogicWhileLiRE
              </h1>
              <p style="margin:0; font-size:12px; font-weight:700; letter-spacing:2px; color:#38bdf8; text-transform:uppercase;">
                Logic. While. LiRE.
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding:32px 32px 28px;">
              ${innerHtml}
            </td>
          </tr>

          <!-- Brand Footer with Support Contact -->
          <tr>
            <td style="padding:22px 32px; background-color:#080e1f; border-top:1px solid rgba(255,255,255,0.06); text-align:center;">
              <p style="margin:0 0 8px; font-size:13px; color:#cbd5e1;">
                Need help? Academic & Technical Support: <a href="mailto:${supportEmail}" style="color:#38bdf8; font-weight:600; text-decoration:none;">${supportEmail}</a>
                &bull; Helpline: <a href="tel:+919493734553" style="color:#38bdf8; font-weight:600; text-decoration:none;">+91 9493734553</a>
              </p>
              <p style="margin:0 0 6px; font-size:12px; color:#94a3b8;">
                Automated transmission from <strong>LogicWhileLiRE</strong> Enterprise Assessment Engine.
              </p>
              <p style="margin:0 0 4px; font-size:11px; color:#64748b;">
                LogicWhileLiRE — Logic. While. LiRE. | Career Growth & Assessment Platform
              </p>
              <p style="margin:0; font-size:11px; color:#475569;">
                Architect &amp; Lead Engineer: <strong style="color:#EAA812;">R. Charan Sai Krishna</strong> • © 2026 LogicWhile LiRE. All rights reserved.
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
// TEMPLATE 1: WELCOME WITH CREDENTIALS
// ============================================================================
export async function sendWelcomeCredentialsEmail(options: {
  toEmail: string;
  recipientName: string;
  role: string;
  identifier: string;
  tempPassword: string;
  collegeName?: string;
  portalUrl?: string;
  hallTicket?: string;
}): Promise<boolean> {
  const { toEmail, recipientName, role, identifier, tempPassword, collegeName, portalUrl, hallTicket } = options;
  const clientBase = portalUrl || getFrontendUrl();
  const isStudent = role === 'student';
  const targetLoginUrl = isStudent ? `${clientBase}/login` : `${clientBase}/admin/login`;
  const resolvedHallTicket = hallTicket || identifier || 'REGISTERED';

  const roleDisplay =
    role === 'super_admin'
      ? 'System Administrator'
      : role === 'inspector'
      ? 'College Inspector (Principal Level)'
      : role === 'faculty'
      ? 'Faculty Member'
      : 'Student Candidate';

  const innerHtml = `
    <div style="background:rgba(0,33,71,0.08); border:1px solid #002147; border-radius:8px; padding:12px 16px; margin-bottom:20px;">
      <span style="font-size:12px; font-weight:800; color:#002147; text-transform:uppercase; letter-spacing:1px;">
        🎓 INSTITUTIONAL ASSESSMENT CREDENTIALS
      </span>
    </div>
    <h2 style="margin:0 0 12px; font-size:22px; font-weight:800; color:#002147;">
      Official Examination Portal Account
    </h2>
    <p style="margin:0 0 16px; font-size:14px; line-height:1.6; color:#334155;">
      Dear <strong style="color:#002147;">${recipientName}</strong>,
    </p>
    <p style="margin:0 0 20px; font-size:14px; line-height:1.6; color:#334155;">
      Your profile has been enrolled in the <strong>LogicWhile Assessment Suite</strong> as <strong>${roleDisplay}</strong>${
    collegeName ? ` at <strong>${collegeName}</strong>` : ''
  }. Below are your official examination portal credentials:
    </p>

    <!-- Prominent Official Credentials Card -->
    <div style="background:#F8FAFC; border:2px solid #EAA812; padding:22px; border-radius:10px; margin-bottom:24px; box-shadow:0 4px 12px rgba(0,0,0,0.05);">
      <table style="width:100%; border-collapse:collapse; font-size:14px;">
        <tr>
          <td style="padding:8px 0; color:#64748B; font-weight:600; width:40%;">1. Login ID (Email):</td>
          <td style="padding:8px 0; font-family:monospace; font-size:15px; font-weight:800; color:#002147;">${toEmail}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#64748B; font-weight:600;">2. Hall Ticket / Roll Number:</td>
          <td style="padding:8px 0; font-family:monospace; font-size:16px; font-weight:800; color:#D97706;">${resolvedHallTicket}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#64748B; font-weight:600;">3. Access Password:</td>
          <td style="padding:8px 0; font-family:monospace; font-size:17px; font-weight:800; color:#1D4ED8; letter-spacing:1px;">${tempPassword}</td>
        </tr>
      </table>

      <div style="background:#FEF3C7; border-left:3px solid #D97706; padding:10px 14px; border-radius:4px; font-size:12px; color:#92400E; margin-top:14px;">
        🔒 <strong>Examination Policy:</strong> You may sign in using either your <strong>Hall Ticket Number</strong> or <strong>Login ID</strong> along with your access password.
      </div>
    </div>

    <div style="text-align:center; margin-bottom:24px;">
      <a href="${targetLoginUrl}" style="display:inline-block; background:#002147; color:#FFFFFF; font-weight:800; font-size:15px; text-decoration:none; padding:13px 32px; border-radius:6px; box-shadow:0 4px 14px rgba(0,33,71,0.3);">
        Log In to Examination Portal →
      </a>
    </div>

    <p style="margin:0; font-size:12px; color:#64748B; line-height:1.5;">
      If you need technical assistance, please contact the examination control center at <a href="mailto:${SUPPORT_EMAIL}" style="color:#002147; font-weight:700;">${SUPPORT_EMAIL}</a>.
    </p>
  `;

  const text = `LogicWhile Assessment Suite — Credentials Dispatched\n\nHello ${recipientName},\nYour account has been created as ${roleDisplay}${collegeName ? ` at ${collegeName}` : ''}.\n\n1. Login ID: ${toEmail}\n2. Hall Ticket Number: ${resolvedHallTicket}\n3. Password: ${tempPassword}\n\nPortal Link: ${targetLoginUrl}\nSupport: ${SUPPORT_EMAIL}\nLogicWhile Assessment Suite`;

  return sendWithRetry({
    to: toEmail,
    subject: `LogicWhile Assessment Suite — Credentials for ${recipientName} (${resolvedHallTicket})`,
    text,
    html: wrapBrandTemplate('LogicWhile Assessment Suite Credentials', innerHtml),
    emailType: 'welcome_credentials',
  });
}

// Backwards-compatible alias for sendWelcomeEmail
export async function sendWelcomeEmail(
  toEmail: string,
  recipientName: string,
  role: string,
  tempPassword: string,
  collegeName?: string,
  hallTicket?: string
): Promise<boolean> {
  return sendWelcomeCredentialsEmail({
    toEmail,
    recipientName,
    role,
    identifier: hallTicket || toEmail,
    hallTicket: hallTicket || toEmail,
    tempPassword,
    collegeName,
  });
}

// ============================================================================
// TEMPLATE 2: EMAIL VERIFICATION / OTP
// ============================================================================
export async function sendEmailVerificationOtpEmail(options: {
  toEmail: string;
  recipientName: string;
  otp: string;
  verifyLink?: string;
  expiresMinutes?: number;
}): Promise<boolean> {
  const { toEmail, recipientName, otp, verifyLink, expiresMinutes = 15 } = options;
  const link = verifyLink || `${getFrontendUrl()}/verify-email?otp=${otp}&email=${encodeURIComponent(toEmail)}`;

  const innerHtml = `
    <div style="background:rgba(59,130,246,0.12); border:1px solid #3b82f6; border-radius:8px; padding:12px 16px; margin-bottom:20px;">
      <span style="font-size:12px; font-weight:800; color:#60a5fa; text-transform:uppercase; letter-spacing:1px;">
        🔐 EMAIL VERIFICATION
      </span>
    </div>
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">
      Activate Your Student Account
    </h2>
    <p style="margin:0 0 16px; font-size:14px; line-height:1.6; color:#cbd5e1;">
      Hello <strong style="color:#f8fafc;">${recipientName}</strong>,<br>
      Thank you for registering on <strong>LogicWhileLiRE</strong>. To verify your email address and activate your student account, please use the one-time passcode below:
    </p>
    <div style="background:rgba(59,130,246,0.08); border:2px dashed #3b82f6; border-radius:12px; padding:24px; text-align:center; margin:24px 0;">
      <span style="font-family:'Courier New', monospace; font-size:36px; font-weight:800; letter-spacing:10px; color:#60a5fa; display:block;">
        ${otp}
      </span>
      <span style="display:inline-block; margin-top:8px; font-size:12px; color:#94a3b8; text-transform:uppercase; letter-spacing:1px;">
        ⏱ Valid for ${expiresMinutes} minutes only
      </span>
    </div>
    <div style="text-align:center; margin-bottom:24px;">
      <a href="${link}" style="display:inline-block; background:linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color:#ffffff; font-weight:700; font-size:15px; text-decoration:none; padding:12px 28px; border-radius:6px; box-shadow:0 4px 14px rgba(37,99,235,0.35);">
        Verify Email & Activate Account →
      </a>
    </div>
    <p style="margin:0; font-size:12px; color:#94a3b8; line-height:1.5;">
      ⚠️ Security Notice: Never share this OTP with anyone. If you did not initiate this registration, please disregard this email.
    </p>
  `;

  const text = `Hello ${recipientName},\n\nYour LogicWhileLiRE registration verification code is: ${otp}\n(Valid for ${expiresMinutes} minutes)\n\nOr click this link to verify directly:\n${link}\n\nSupport: ${SUPPORT_EMAIL}\nLogicWhileLiRE — Logic. While. LiRE.`;

  return sendWithRetry({
    to: toEmail,
    subject: `Verify Your LogicWhileLiRE Student Account — Code: ${otp}`,
    text,
    html: wrapBrandTemplate('Verify Student Account', innerHtml),
    emailType: 'email_verification_otp',
  });
}

// Backwards-compatible alias for sendStudentVerificationEmail & sendOtpEmail
export async function sendStudentVerificationEmail(
  toEmail: string,
  recipientName: string,
  otp: string,
  verifyLink: string
): Promise<boolean> {
  return sendEmailVerificationOtpEmail({ toEmail, recipientName, otp, verifyLink });
}

export async function sendOtpEmail(
  toEmail: string,
  recipientName: string,
  otp: string,
  examTitle: string,
  examId?: string
): Promise<void> {
  await sendEmailVerificationOtpEmail({
    toEmail,
    recipientName,
    otp,
    expiresMinutes: 10,
  });
}

/**
 * Admin & Inspector Login Verification OTP Email
 * Dispatched when staff members log into LogicWhileLiRE
 */
export async function sendStaffLoginOtpEmail(options: {
  toEmail: string;
  recipientName: string;
  otp: string;
  role: string;
  ip?: string;
  expiresMinutes?: number;
}): Promise<boolean> {
  const { toEmail, recipientName, otp, role, ip = 'Unknown IP', expiresMinutes = 10 } = options;
  const roleLabel = role === 'inspector' ? 'Exam Inspector' : role === 'super_admin' ? 'Super Administrator' : 'Staff Member';

  const innerHtml = `
    <div style="background:rgba(239,68,68,0.12); border:1px solid #ef4444; border-radius:8px; padding:12px 16px; margin-bottom:20px;">
      <span style="font-size:12px; font-weight:800; color:#f87171; text-transform:uppercase; letter-spacing:1px;">
        🛡️ ${roleLabel.toUpperCase()} LOGIN VERIFICATION
      </span>
    </div>
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">
      One-Time Passcode for ${roleLabel} Portal
    </h2>
    <p style="margin:0 0 16px; font-size:14px; line-height:1.6; color:#cbd5e1;">
      Hello <strong style="color:#f8fafc;">${recipientName}</strong>,<br>
      A login request was initiated for your ${roleLabel} account from IP address <code>${ip}</code>.
      To complete authentication, please enter the one-time passcode below:
    </p>
    <div style="background:rgba(239,68,68,0.08); border:2px dashed #ef4444; border-radius:12px; padding:24px; text-align:center; margin:24px 0;">
      <span style="font-family:'Courier New', monospace; font-size:38px; font-weight:800; letter-spacing:12px; color:#f87171; display:block;">
        ${otp}
      </span>
      <span style="display:inline-block; margin-top:8px; font-size:12px; color:#94a3b8; text-transform:uppercase; letter-spacing:1px;">
        ⏱ Valid for ${expiresMinutes} minutes only
      </span>
    </div>
    <p style="margin:0; font-size:12px; color:#94a3b8; line-height:1.5;">
      ⚠️ Security Notice: LogicWhileLiRE staff will never ask for your one-time code. If you did not initiate this login request, change your password immediately.
    </p>
  `;

  const text = `Hello ${recipientName},\n\nYour LogicWhileLiRE ${roleLabel} login verification code is: ${otp}\n(Valid for ${expiresMinutes} minutes from IP: ${ip})\n\nIf you did not initiate this login, change your password immediately.\n\nSupport: ${SUPPORT_EMAIL}\nLogicWhileLiRE — Logic. While. LiRE.`;

  return sendWithRetry({
    to: toEmail,
    subject: `🔐 [SECURITY ALERT] ${roleLabel} Login Verification Code: ${otp}`,
    text,
    html: wrapBrandTemplate(`${roleLabel} Login Verification`, innerHtml),
    emailType: 'admin_login_otp',
  });
}

// ============================================================================
// TEMPLATE 3: PASSWORD RESET
// ============================================================================
export async function sendPasswordResetEmail(
  toEmail: string,
  recipientName: string,
  resetLink: string
): Promise<boolean> {
  const innerHtml = `
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">
      Password Reset Request
    </h2>
    <p style="margin:0 0 16px; font-size:14px; line-height:1.6; color:#94a3b8;">
      Hello <strong style="color:#f8fafc;">${recipientName || 'User'}</strong>,
    </p>
    <p style="margin:0 0 24px; font-size:14px; line-height:1.6; color:#cbd5e1;">
      We received a request to reset the password for your <strong>LogicWhileLiRE</strong> account. Click the button below to choose a new, secure password:
    </p>
    <div style="text-align:center; margin:30px 0;">
      <a href="${resetLink}" style="display:inline-block; padding:14px 32px; background:linear-gradient(135deg, #1B5FB5 0%, #0A3F8F 100%); color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; border-radius:8px; box-shadow:0 4px 14px rgba(27, 95, 181, 0.4); letter-spacing:0.5px;">
        🔑 Reset Your Password
      </a>
    </div>
    <div style="background:rgba(27,95,181,0.08); border-left:3px solid #1B5FB5; padding:12px 16px; border-radius:4px; margin-bottom:24px;">
      <p style="margin:0; font-size:12px; color:#93c5fd; line-height:1.5;">
        ⏳ <strong>Security Notice:</strong> This link is strictly valid for <strong>1 hour</strong>. If you did not request a password reset, no action is needed — your account remains safe and secure.
      </p>
    </div>
    <p style="margin:0; font-size:12px; color:#64748b; line-height:1.5; word-break:break-all;">
      Or copy and paste this URL into your browser:<br />
      <a href="${resetLink}" style="color:#1B5FB5;">${resetLink}</a>
    </p>
  `;

  const text = `Hello ${recipientName || 'User'},\n\nWe received a request to reset your password for LogicWhileLiRE.\nPlease use this link within 1 hour to set a new password:\n\n${resetLink}\n\nIf you did not request this, you can safely ignore this email.\nSupport: ${SUPPORT_EMAIL}`;

  return sendWithRetry({
    to: toEmail,
    subject: '🔑 Password Reset Request — LogicWhileLiRE',
    text,
    html: wrapBrandTemplate('Reset Your Password — LogicWhileLiRE', innerHtml),
    emailType: 'password_reset',
  });
}

// ============================================================================
// TEMPLATE 4: EXAM SCHEDULED
// ============================================================================
export async function sendExamScheduledEmail(options: {
  toEmail: string;
  recipientName: string;
  hallTicket: string;
  examCode: string;
  examTitle: string;
  durationMinutes: number;
  scheduledAt?: string;
  lobbyUrl?: string;
}): Promise<boolean> {
  const { toEmail, recipientName, hallTicket, examCode, examTitle, durationMinutes, scheduledAt, lobbyUrl } = options;
  const accessUrl = lobbyUrl || `${getFrontendUrl()}/lobby/${examCode}`;

  const innerHtml = `
    <div style="background:rgba(14,165,233,0.12); border:1px solid #0ea5e9; border-radius:8px; padding:12px 16px; margin-bottom:20px;">
      <span style="font-size:12px; font-weight:800; color:#38bdf8; text-transform:uppercase; letter-spacing:1px;">
        📅 EXAMINATION SCHEDULED
      </span>
    </div>
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">
      Official Examination Hall Ticket & Schedule
    </h2>
    <p style="margin:0 0 16px; font-size:14px; line-height:1.6; color:#94a3b8;">
      Dear <strong style="color:#f8fafc;">${recipientName}</strong>,
    </p>
    <p style="margin:0 0 20px; font-size:14px; line-height:1.6; color:#cbd5e1;">
      You are scheduled to sit for <strong>${examTitle}</strong> on the <strong>LogicWhileLiRE</strong> Assessment Platform. Below are your official examination details:
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:rgba(255,255,255,0.03); border:1px solid rgba(56,189,248,0.25); border-radius:12px; margin-bottom:24px;">
      <tr>
        <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#94a3b8;">Candidate Hall Ticket:</td>
        <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:15px; font-weight:800; font-family:monospace; color:#38bdf8;">${hallTicket}</td>
      </tr>
      <tr>
        <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#94a3b8;">Exam Pass Code:</td>
        <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:15px; font-weight:800; font-family:monospace; color:#10b981;">${examCode}</td>
      </tr>
      ${
        scheduledAt
          ? `<tr>
              <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#94a3b8;">Scheduled Date & Time:</td>
              <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; font-weight:700; color:#f8fafc;">${scheduledAt}</td>
            </tr>`
          : ''
      }
      <tr>
        <td style="padding:14px 18px; font-size:14px; color:#94a3b8;">Duration:</td>
        <td style="padding:14px 18px; font-size:14px; font-weight:700; color:#f8fafc;">${durationMinutes} Minutes (Server Authoritative)</td>
      </tr>
    </table>
    <div style="text-align:center; margin:26px 0;">
      <a href="${accessUrl}" style="display:inline-block; padding:14px 36px; background:linear-gradient(135deg, #1B5FB5 0%, #0A3F8F 100%); color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; border-radius:8px; box-shadow:0 4px 16px rgba(27, 95, 181, 0.4); letter-spacing:0.5px;">
        🚀 Enter Examination Lobby
      </a>
    </div>
    <div style="background:rgba(27,95,181,0.08); border-left:3px solid #1B5FB5; padding:14px 18px; border-radius:6px; margin-bottom:20px;">
      <h4 style="margin:0 0 6px; font-size:13px; font-weight:700; color:#93c5fd;">Exam Rules & Requirements</h4>
      <ul style="margin:0; padding-left:18px; font-size:12px; color:#cbd5e1; line-height:1.6;">
        <li>Full-screen mode is required throughout the test. Tab-switching is recorded.</li>
        <li>Dual proctoring (camera gaze & tab focus) will be monitored by the assigned Inspector.</li>
        <li>Wait in the exam lobby until the Inspector starts the exam for all candidates simultaneously.</li>
      </ul>
    </div>
  `;

  const text = `Hello ${recipientName},\n\nYou are scheduled for "${examTitle}".\nHall Ticket: ${hallTicket}\nExam Code: ${examCode}\nDuration: ${durationMinutes} mins\nLobby URL: ${accessUrl}\n\nSupport: ${SUPPORT_EMAIL}\nLogicWhileLiRE — Logic. While. LiRE.`;

  return sendWithRetry({
    to: toEmail,
    subject: `🎓 Exam Scheduled: ${examTitle} — Pass Code: ${examCode}`,
    text,
    html: wrapBrandTemplate('Official Exam Hall Ticket', innerHtml),
    emailType: 'exam_scheduled',
  });
}

// Backwards-compatible alias for sendExamInvitationEmail
export async function sendExamInvitationEmail(
  toEmail: string,
  recipientName: string,
  hallTicket: string,
  examCode: string,
  examTitle: string,
  durationMinutes: number,
  accessUrl: string
): Promise<boolean> {
  return sendExamScheduledEmail({
    toEmail,
    recipientName,
    hallTicket,
    examCode,
    examTitle,
    durationMinutes,
    lobbyUrl: accessUrl,
  });
}

// ============================================================================
// TEMPLATE 5: EXAM STARTED REMINDER
// ============================================================================
export async function sendExamStartedReminderEmail(options: {
  toEmail: string;
  recipientName: string;
  hallTicket: string;
  examCode: string;
  examTitle: string;
  roomUrl?: string;
}): Promise<boolean> {
  const { toEmail, recipientName, hallTicket, examCode, examTitle, roomUrl } = options;
  const joinUrl = roomUrl || `${getFrontendUrl()}/lobby/${examCode}`;

  const innerHtml = `
    <div style="background:rgba(239,68,68,0.15); border:1px solid #ef4444; border-radius:8px; padding:14px 18px; margin-bottom:20px;">
      <span style="font-size:13px; font-weight:800; color:#ef4444; text-transform:uppercase; letter-spacing:1px;">
        🚨 EXAM IS LIVE — TIMER STARTED
      </span>
    </div>
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">
      Your Exam Has Officially Started!
    </h2>
    <p style="margin:0 0 16px; font-size:14px; line-height:1.6; color:#cbd5e1;">
      Dear <strong style="color:#f8fafc;">${recipientName}</strong> (Hall Ticket: <span style="font-family:monospace; color:#38bdf8;">${hallTicket}</span>),
    </p>
    <p style="margin:0 0 20px; font-size:14px; line-height:1.6; color:#cbd5e1;">
      Your college inspector has just clicked <strong>Start Exam</strong> for <strong>${examTitle}</strong> (Code: <span style="font-family:monospace; color:#10b981; font-weight:700;">${examCode}</span>). The server-authoritative countdown clock is now ticking for all candidates!
    </p>
    <div style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); padding:20px; border-radius:8px; margin-bottom:24px; text-align:center;">
      <div style="font-size:13px; color:#94a3b8; margin-bottom:6px;">Exam Code:</div>
      <div style="font-family:monospace; font-size:22px; font-weight:800; color:#10b981; letter-spacing:2px; margin-bottom:18px;">${examCode}</div>
      <a href="${joinUrl}" style="display:inline-block; padding:14px 36px; background:linear-gradient(135deg, #10b981 0%, #059669 100%); color:#ffffff; font-size:15px; font-weight:800; text-decoration:none; border-radius:8px; box-shadow:0 4px 14px rgba(16,185,129,0.4); letter-spacing:0.5px;">
        ⚡ Enter Exam Room Now →
      </a>
    </div>
    <p style="margin:0; font-size:12px; color:#94a3b8; line-height:1.5;">
      ⚠️ Please join immediately to utilize your full allotted time. Late joiners are synchronized to elapsed server time.
    </p>
  `;

  const text = `URGENT: ${examTitle} has started!\n\nHello ${recipientName},\nYour inspector has officially started the exam (Code: ${examCode}).\nEnter the exam room immediately:\n${joinUrl}\n\nSupport: ${SUPPORT_EMAIL}\nLogicWhileLiRE — Logic. While. LiRE.`;

  return sendWithRetry({
    to: toEmail,
    subject: `🚨 Exam Started: ${examTitle} — Join Immediately!`,
    text,
    html: wrapBrandTemplate('Exam Started Reminder', innerHtml),
    emailType: 'exam_started_reminder',
  });
}

// ============================================================================
// TEMPLATE 6: RESULT PUBLISHED
// ============================================================================
export async function sendResultPublishedEmail(options: {
  toEmail: string;
  recipientName: string;
  hallTicket: string;
  examTitle: string;
  examCode: string;
  result: {
    totalScore: number;
    maxScore: number;
    normalizedScore?: number;
    correctCount: number;
    wrongCount: number;
    timeTakenSeconds: number;
    rank?: number | null;
    totalParticipants?: number;
    isLeaderboardPublic?: boolean;
    topicBreakdown?: Record<string, { correct: number; wrong: number; score: number; maxScore: number }>;
  };
  resultsUrl?: string;
}): Promise<boolean> {
  const { toEmail, recipientName, hallTicket, examTitle, examCode, result, resultsUrl } = options;
  const percentage = result.maxScore > 0 ? Math.round((result.totalScore / result.maxScore) * 100) : 0;
  const minutes = Math.floor(result.timeTakenSeconds / 60);
  const seconds = result.timeTakenSeconds % 60;
  const timeFormatted = `${minutes}m ${seconds}s`;
  const viewUrl = resultsUrl || `${getFrontendUrl()}/results/${examCode}`;

  const rankDisplay = result.rank ? `#${result.rank}` : '—';

  const innerHtml = `
    <div style="background:rgba(16,185,129,0.12); border:1px solid #10b981; border-radius:8px; padding:12px 16px; margin-bottom:20px;">
      <span style="font-size:12px; font-weight:800; color:#10b981; text-transform:uppercase; letter-spacing:1px;">
        🏆 ASSESSMENT RESULT PUBLISHED
      </span>
    </div>
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">
      Official Results: ${examTitle}
    </h2>
    <p style="margin:0 0 16px; font-size:14px; line-height:1.6; color:#94a3b8;">
      Candidate: <strong style="color:#f8fafc;">${recipientName}</strong> (Hall Ticket: <span style="font-family:monospace; color:#38bdf8;">${hallTicket}</span>)
    </p>

    <!-- Score Highlight Card -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; margin-bottom:24px;">
      <tr>
        <td style="padding:20px; text-align:center; border-right:1px solid rgba(255,255,255,0.06);">
          <span style="font-size:11px; text-transform:uppercase; color:#8888aa; letter-spacing:1px; display:block; margin-bottom:4px;">Score</span>
          <span style="font-size:28px; font-weight:800; color:#10b981;">${result.totalScore}</span>
          <span style="font-size:14px; color:#8888aa;"> / ${result.maxScore}</span>
        </td>
        <td style="padding:20px; text-align:center; border-right:1px solid rgba(255,255,255,0.06);">
          <span style="font-size:11px; text-transform:uppercase; color:#8888aa; letter-spacing:1px; display:block; margin-bottom:4px;">Percentage</span>
          <span style="font-size:28px; font-weight:800; color:#a78bfa;">${result.normalizedScore ?? percentage}%</span>
        </td>
        <td style="padding:20px; text-align:center;">
          <span style="font-size:11px; text-transform:uppercase; color:#8888aa; letter-spacing:1px; display:block; margin-bottom:4px;">Rank</span>
          <span style="font-size:28px; font-weight:800; color:#f59e0b;">${rankDisplay}</span>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 20px; font-size:13px; color:#94a3b8;">
      ⏱ <strong>Time Taken:</strong> ${timeFormatted} &nbsp;|&nbsp; 
      ✅ <strong>Correct:</strong> ${result.correctCount} &nbsp;|&nbsp; 
      ❌ <strong>Incorrect:</strong> ${result.wrongCount}
    </p>

    <div style="text-align:center; margin-bottom:24px;">
      <a href="${viewUrl}" style="display:inline-block; background:linear-gradient(135deg, #1B5FB5 0%, #0A3F8F 100%); color:#ffffff; font-weight:700; font-size:15px; text-decoration:none; padding:12px 28px; border-radius:6px; box-shadow:0 4px 14px rgba(27,95,181,0.35);">
        View Detailed Analysis & Standings →
      </a>
    </div>
  `;

  const text = `Results for ${examTitle}\nCandidate: ${recipientName} (${hallTicket})\nScore: ${result.totalScore}/${result.maxScore} (${result.normalizedScore ?? percentage}%)\nRank: ${rankDisplay}\nTime: ${timeFormatted}\nCorrect: ${result.correctCount}, Incorrect: ${result.wrongCount}\nView online: ${viewUrl}\n\nSupport: ${SUPPORT_EMAIL}`;

  return sendWithRetry({
    to: toEmail,
    subject: `🏆 Your Exam Results: ${examTitle} — Score ${result.totalScore}/${result.maxScore}`,
    text,
    html: wrapBrandTemplate('Exam Results Published', innerHtml),
    emailType: 'result_published',
  });
}

// Backwards-compatible alias for sendResultEmail
export async function sendResultEmail(
  toEmail: string,
  recipientName: string,
  hallTicket: string,
  examTitle: string,
  result: any,
  examId?: string,
  sessionId?: string,
  participantId?: string
): Promise<void> {
  await sendResultPublishedEmail({
    toEmail,
    recipientName,
    hallTicket,
    examTitle,
    examCode: examId || 'EXAM',
    result: {
      totalScore: result.totalScore,
      maxScore: result.maxScore,
      normalizedScore: result.normalizedScore,
      correctCount: result.correctCount,
      wrongCount: result.wrongCount,
      timeTakenSeconds: result.timeTakenSeconds,
      rank: result.rank,
      totalParticipants: result.totalParticipants,
      isLeaderboardPublic: result.isLeaderboardPublic,
      topicBreakdown: result.topicBreakdown,
    },
  });
}

// ============================================================================
// TEMPLATE 7: CONTACT FORM AUTO-REPLY
// ============================================================================
export async function sendContactAutoReplyEmail(options: {
  toEmail: string;
  senderName: string;
  referenceId: string;
  subject: string;
  message: string;
}): Promise<boolean> {
  const { toEmail, senderName, referenceId, subject, message } = options;

  const innerHtml = `
    <div style="background:rgba(59,130,246,0.12); border:1px solid #3b82f6; border-radius:8px; padding:12px 16px; margin-bottom:20px;">
      <span style="font-size:12px; font-weight:800; color:#60a5fa; text-transform:uppercase; letter-spacing:1px;">
        📩 INQUIRY ACKNOWLEDGEMENT
      </span>
    </div>
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">
      We Received Your Message
    </h2>
    <p style="margin:0 0 16px; font-size:14px; line-height:1.6; color:#cbd5e1;">
      Dear <strong style="color:#f8fafc;">${senderName}</strong>,
    </p>
    <p style="margin:0 0 20px; font-size:14px; line-height:1.6; color:#cbd5e1;">
      Thank you for contacting <strong>LogicWhileLiRE</strong> support. Your message has been routed to our academic and technical engineering team.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px; margin-bottom:24px;">
      <tr>
        <td style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:13px; color:#94a3b8;">Inquiry Reference ID:</td>
        <td style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; font-weight:800; font-family:monospace; color:#38bdf8;">${referenceId}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:13px; color:#94a3b8;">Subject:</td>
        <td style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; font-weight:700; color:#f8fafc;">${subject}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px; font-size:13px; color:#94a3b8; vertical-align:top;">Message Excerpt:</td>
        <td style="padding:12px 16px; font-size:13px; color:#cbd5e1; line-height:1.5;">${message.slice(0, 300)}${message.length > 300 ? '...' : ''}</td>
      </tr>
    </table>
    <div style="background:rgba(27,95,181,0.08); border-left:3px solid #1B5FB5; padding:12px 16px; border-radius:4px; margin-bottom:20px;">
      <p style="margin:0; font-size:13px; color:#93c5fd; line-height:1.5;">
        ⏱ <strong>Turnaround Promise:</strong> Our engineering support team typically responds within <strong>24 business hours</strong>.
      </p>
    </div>
    <p style="margin:0; font-size:12px; color:#94a3b8; line-height:1.5;">
      If you need urgent assistance, you can reply directly to this email referencing your ID <strong>${referenceId}</strong>.
    </p>
  `;

  const text = `Hello ${senderName},\n\nWe have received your message regarding "${subject}".\nReference ID: ${referenceId}\n\nOur team will review your inquiry and respond within 24 business hours.\n\nSupport: ${SUPPORT_EMAIL}\nLogicWhileLiRE — Logic. While. LiRE.`;

  return sendWithRetry({
    to: toEmail,
    subject: `[${referenceId}] We Received Your Inquiry: ${subject}`,
    text,
    html: wrapBrandTemplate('Inquiry Acknowledgement', innerHtml),
    emailType: 'contact_auto_reply',
  });
}

// ============================================================================
// TEMPLATE 8: CONTACT FORM ADMIN NOTIFICATION
// ============================================================================
export async function sendContactAdminNotificationEmail(options: {
  senderName: string;
  senderEmail: string;
  referenceId: string;
  subject: string;
  message: string;
  institution?: string;
  candidateCount?: string;
  timestamp?: string;
}): Promise<boolean> {
  const { senderName, senderEmail, referenceId, subject, message, institution, candidateCount, timestamp } = options;
  const adminRecipient = ADMIN_EMAIL;
  const timeStr = timestamp || new Date().toLocaleString();

  const innerHtml = `
    <div style="background:rgba(245,158,11,0.15); border:1px solid #f59e0b; border-radius:8px; padding:12px 16px; margin-bottom:20px;">
      <span style="font-size:12px; font-weight:800; color:#f59e0b; text-transform:uppercase; letter-spacing:1px;">
        📢 NEW CONTACT FORM SUBMISSION
      </span>
    </div>
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">
      Inquiry: ${subject}
    </h2>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px; margin-bottom:24px;">
      <tr>
        <td style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:13px; color:#94a3b8;">Reference ID:</td>
        <td style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; font-weight:800; font-family:monospace; color:#f59e0b;">${referenceId}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:13px; color:#94a3b8;">From:</td>
        <td style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; font-weight:700; color:#f8fafc;">${senderName} &lt;<a href="mailto:${senderEmail}" style="color:#38bdf8;">${senderEmail}</a>&gt;</td>
      </tr>
      ${
        institution
          ? `<tr>
              <td style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:13px; color:#94a3b8;">Institution:</td>
              <td style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#f8fafc;">${institution}</td>
            </tr>`
          : ''
      }
      ${
        candidateCount
          ? `<tr>
              <td style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:13px; color:#94a3b8;">Batch Scale:</td>
              <td style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#f8fafc;">${candidateCount}</td>
            </tr>`
          : ''
      }
      <tr>
        <td style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:13px; color:#94a3b8;">Received At:</td>
        <td style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:13px; color:#94a3b8;">${timeStr}</td>
      </tr>
    </table>
    <div style="background:rgba(255,255,255,0.04); border-left:4px solid #38bdf8; padding:16px 20px; border-radius:4px; margin-bottom:24px;">
      <h4 style="margin:0 0 8px; font-size:13px; font-weight:700; color:#93c5fd;">Message Body:</h4>
      <p style="margin:0; font-size:14px; color:#f0f4f8; line-height:1.6; white-space:pre-wrap;">${message}</p>
    </div>
    <div style="text-align:center;">
      <a href="mailto:${senderEmail}?subject=Re: [${referenceId}] ${encodeURIComponent(subject)}" style="display:inline-block; padding:12px 28px; background:linear-gradient(135deg, #0284c7 0%, #2563eb 100%); color:#ffffff; font-size:14px; font-weight:700; text-decoration:none; border-radius:6px;">
        ✉️ Reply Directly to ${senderName}
      </a>
    </div>
  `;

  const text = `NEW CONTACT INQUIRY\nReference ID: ${referenceId}\nFrom: ${senderName} (${senderEmail})\nInstitution: ${institution || 'N/A'}\nSubject: ${subject}\nTime: ${timeStr}\n\nMessage:\n${message}\n\nReply directly to ${senderEmail}`;

  return sendWithRetry({
    to: adminRecipient,
    replyTo: senderEmail,
    subject: `🚨 [CONTACT INQUIRY] ${subject} — ${senderName} (${referenceId})`,
    text,
    html: wrapBrandTemplate('New Contact Inquiry', innerHtml),
    emailType: 'contact_admin_notification',
  });
}

// ============================================================================
// PROCTORING & SECURITY ALERTS (Preserved for backwards compatibility)
// ============================================================================
export async function sendTerminationAlertEmail(
  adminEmail: string,
  participantName: string,
  hallTicket: string,
  examTitle: string,
  reason: string,
  violationCount: number,
  violations: Array<{ type: string; timestamp: string; notes?: string }>,
  ipAddress?: string,
  examId?: string,
  sessionId?: string,
  participantId?: string
): Promise<void> {
  const violationRows = violations.length > 0
    ? violations.map((v, i) => `
        <tr>
          <td style="padding:8px 12px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:13px; color:#8888aa;">#${i + 1}</td>
          <td style="padding:8px 12px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:13px; color:#ef4444; font-weight:600;">${v.type}</td>
          <td style="padding:8px 12px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:12px; font-family:monospace; color:#a78bfa;">${new Date(v.timestamp).toLocaleTimeString()}</td>
          <td style="padding:8px 12px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:13px; color:#f0f0f8;">${v.notes || '—'}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="4" style="padding:12px; text-align:center; color:#8888aa;">No detailed logs available</td></tr>';

  const innerHtml = `
    <div style="background:rgba(239,68,68,0.1); border:1px solid #ef4444; border-radius:8px; padding:14px 18px; margin-bottom:20px;">
      <span style="font-size:14px; font-weight:700; color:#ef4444; text-transform:uppercase; letter-spacing:1px;">
        🚨 PROCTORING TERMINATION TRIGGERED
      </span>
    </div>
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f0f0f8;">Participant Session Terminated</h2>
    <p style="margin:0 0 20px; font-size:15px; color:#8888aa; line-height:1.6;">
      An active exam session was terminated due to a proctoring policy breach:
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px; margin-bottom:24px;">
      <tr>
        <td style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#8888aa;">Participant:</td>
        <td style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; font-weight:700; color:#f0f0f8;">${participantName}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#8888aa;">Hall Ticket:</td>
        <td style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; font-family:monospace; color:#a78bfa;">${hallTicket}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#8888aa;">Exam:</td>
        <td style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#f0f0f8;">${examTitle}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#8888aa;">Termination Reason:</td>
        <td style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#ef4444; font-weight:700;">${reason}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px; font-size:14px; color:#8888aa;">Total Violations:</td>
        <td style="padding:12px 16px; font-size:14px; font-weight:700; color:#f59e0b;">${violationCount}</td>
      </tr>
    </table>
    <h3 style="margin:24px 0 12px; font-size:16px; font-weight:700; color:#f0f0f8;">Violation Audit Log</h3>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid rgba(255,255,255,0.08); border-radius:8px; overflow:hidden;">
      <thead>
        <tr style="background:rgba(255,255,255,0.04);">
          <th style="padding:10px 12px; font-size:12px; text-align:left; color:#8888aa;">#</th>
          <th style="padding:10px 12px; font-size:12px; text-align:left; color:#8888aa;">Type</th>
          <th style="padding:10px 12px; font-size:12px; text-align:left; color:#8888aa;">Time</th>
          <th style="padding:10px 12px; font-size:12px; text-align:left; color:#8888aa;">Notes</th>
        </tr>
      </thead>
      <tbody>
        ${violationRows}
      </tbody>
    </table>
  `;

  await sendWithRetry({
    to: adminEmail,
    subject: `🚨 [SECURITY ALERT] Session Terminated: ${participantName} (${hallTicket})`,
    text: `SECURITY ALERT: Session Terminated\nParticipant: ${participantName} (${hallTicket})\nExam: ${examTitle}\nReason: ${reason}\nViolations: ${violationCount}`,
    html: wrapBrandTemplate('Session Termination Alert', innerHtml),
    emailType: 'termination_alert',
    examId,
    sessionId,
    participantId,
  });
}

export async function sendBatchTerminationSummaryEmail(
  adminEmail: string,
  examTitle: string,
  terminations: Array<{
    participantName: string;
    hallTicket: string;
    reason: string;
    violationCount: number;
    timestamp: Date;
    violationsCount: number;
  }>,
  examId?: string
): Promise<void> {
  const summaryRows = terminations.map((t, idx) => `
    <tr>
      <td style="padding:10px 12px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:13px; color:#8888aa;">${idx + 1}</td>
      <td style="padding:10px 12px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:13px; font-weight:700; color:#f0f0f8;">
        ${t.participantName}
        <div style="font-family:monospace; font-size:11px; color:#a78bfa;">${t.hallTicket}</div>
      </td>
      <td style="padding:10px 12px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:13px; color:#ef4444; font-weight:600;">${t.reason}</td>
      <td style="padding:10px 12px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:13px; font-weight:700; color:#f59e0b; text-align:center;">${t.violationCount}</td>
      <td style="padding:10px 12px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:12px; font-family:monospace; color:#8888aa; text-align:right;">${t.timestamp.toLocaleTimeString()}</td>
    </tr>
  `).join('');

  const innerHtml = `
    <div style="background:rgba(239,68,68,0.15); border:1px solid #ef4444; border-radius:8px; padding:16px 20px; margin-bottom:20px;">
      <span style="font-size:14px; font-weight:800; color:#ef4444; text-transform:uppercase; letter-spacing:1px;">
        🚨 BATCHED TERMINATION SUMMARY (5-MINUTE WINDOW)
      </span>
      <p style="margin:6px 0 0; font-size:13px; color:#fca5a5;">
        ${terminations.length} sessions were terminated for proctoring violations within the last 5 minutes.
      </p>
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid rgba(255,255,255,0.08); border-radius:8px; overflow:hidden; margin-bottom:24px;">
      <thead>
        <tr style="background:rgba(255,255,255,0.04);">
          <th style="padding:10px 12px; font-size:12px; text-align:left; color:#8888aa;">#</th>
          <th style="padding:10px 12px; font-size:12px; text-align:left; color:#8888aa;">Participant</th>
          <th style="padding:10px 12px; font-size:12px; text-align:left; color:#8888aa;">Reason</th>
          <th style="padding:10px 12px; font-size:12px; text-align:center; color:#8888aa;">Violations</th>
          <th style="padding:10px 12px; font-size:12px; text-align:right; color:#8888aa;">Time</th>
        </tr>
      </thead>
      <tbody>
        ${summaryRows}
      </tbody>
    </table>
  `;

  await sendWithRetry({
    to: adminEmail,
    subject: `🚨 [SECURITY SUMMARY] ${terminations.length} Sessions Terminated — ${examTitle}`,
    text: `SECURITY SUMMARY: ${terminations.length} Sessions Terminated in "${examTitle}" within 5 minutes.`,
    html: wrapBrandTemplate('Multiple Terminations Summary', innerHtml),
    emailType: 'batch_termination_summary',
    examId,
  });
}

export async function sendCandidateSubmissionReceiptEmail(
  toEmail: string,
  recipientName: string,
  hallTicket: string,
  examTitle: string,
  answeredCount: number,
  totalQuestions: number,
  submissionHash: string
): Promise<boolean> {
  const innerHtml = `
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#10b981;">
      ✅ Exam Submission Recorded Successfully
    </h2>
    <p style="margin:0 0 16px; font-size:14px; line-height:1.6; color:#94a3b8;">
      Dear <strong style="color:#f8fafc;">${recipientName}</strong>,
    </p>
    <p style="margin:0 0 20px; font-size:14px; line-height:1.6; color:#cbd5e1;">
      Your submission for <strong>${examTitle}</strong> has been securely stamped into the server audit ledger.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:rgba(255,255,255,0.03); border:1px solid rgba(16,185,129,0.3); border-radius:12px; margin-bottom:24px;">
      <tr>
        <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#94a3b8;">Hall Ticket:</td>
        <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; font-weight:700; color:#f8fafc;">${hallTicket}</td>
      </tr>
      <tr>
        <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#94a3b8;">Questions Completed:</td>
        <td style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; font-weight:800; color:#10b981;">${answeredCount} / ${totalQuestions} answered</td>
      </tr>
      <tr>
        <td style="padding:14px 18px; font-size:14px; color:#94a3b8;">Digital Audit Hash:</td>
        <td style="padding:14px 18px; font-size:12px; font-family:monospace; color:#a78bfa; word-break:break-all;">${submissionHash}</td>
      </tr>
    </table>
  `;

  return sendWithRetry({
    to: toEmail,
    subject: `✅ Exam Submission Confirmed: ${examTitle} (${hallTicket})`,
    text: `Hello ${recipientName},\nYour submission for "${examTitle}" was successfully received.\nAnswered: ${answeredCount}/${totalQuestions}\nReceipt Hash: ${submissionHash}\nSupport: ${SUPPORT_EMAIL}`,
    html: wrapBrandTemplate('Submission Confirmation Receipt', innerHtml),
    emailType: 'submission_receipt',
  });
}

export async function sendInspectorIssueAlertEmail(
  inspectorEmail: string,
  participantName: string,
  hallTicket: string,
  examTitle: string,
  issueType: string,
  details: string,
  severity: 'low' | 'medium' | 'high' | 'critical' = 'high'
): Promise<boolean> {
  const colorMap = {
    low: '#38bdf8',
    medium: '#f59e0b',
    high: '#ef4444',
    critical: '#dc2626',
  };
  const color = colorMap[severity] || '#ef4444';

  const innerHtml = `
    <div style="background:${color}15; border:1px solid ${color}; border-radius:8px; padding:14px 18px; margin-bottom:20px;">
      <span style="font-size:13px; font-weight:800; color:${color}; text-transform:uppercase; letter-spacing:1px;">
        ⚠️ LIVE PROCTOR INSPECTION ALERT [${severity.toUpperCase()}]
      </span>
    </div>
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">
      Candidate Flagged by Real-Time Telemetry
    </h2>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px; margin-bottom:24px;">
      <tr>
        <td style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#94a3b8;">Candidate:</td>
        <td style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; font-weight:700; color:#f8fafc;">${participantName} (${hallTicket})</td>
      </tr>
      <tr>
        <td style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#94a3b8;">Flag Type:</td>
        <td style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; font-weight:800; color:${color};">${issueType.replace(/_/g, ' ').toUpperCase()}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px; font-size:14px; color:#94a3b8;">Telemetry Details:</td>
        <td style="padding:12px 16px; font-size:14px; color:#f8fafc;">${details}</td>
      </tr>
    </table>
  `;

  return sendWithRetry({
    to: inspectorEmail,
    subject: `🚨 [INSPECTOR ALERT] ${issueType.toUpperCase()}: ${participantName} (${hallTicket})`,
    text: `PROCTOR ALERT: ${issueType}\nCandidate: ${participantName} (${hallTicket})\nExam: ${examTitle}\nDetails: ${details}`,
    html: wrapBrandTemplate('Inspector Security Alert', innerHtml),
    emailType: 'inspector_issue_alert',
  });
}

export async function sendInspectorDirectNoticeEmail(
  toEmail: string,
  recipientName: string,
  hallTicket: string,
  examTitle: string,
  inspectorName: string,
  noticeText: string
): Promise<boolean> {
  const innerHtml = `
    <div style="background:rgba(245,158,11,0.15); border:1px solid #f59e0b; border-radius:8px; padding:14px 18px; margin-bottom:20px;">
      <span style="font-size:13px; font-weight:800; color:#f59e0b; text-transform:uppercase; letter-spacing:1px;">
        ⚠️ OFFICIAL PROCTOR REPRIMAND & WARNING
      </span>
    </div>
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">
      Notice from Examination Invigilator
    </h2>
    <p style="margin:0 0 16px; font-size:14px; line-height:1.6; color:#cbd5e1;">
      Dear <strong style="color:#f8fafc;">${recipientName}</strong> (Hall Ticket: ${hallTicket}),
    </p>
    <div style="background:rgba(255,255,255,0.04); border-left:4px solid #f59e0b; padding:16px 20px; border-radius:4px; margin-bottom:24px;">
      <p style="margin:0; font-size:15px; font-weight:600; color:#fef3c7; line-height:1.6;">
        "${noticeText}"
      </p>
      <div style="margin-top:10px; font-size:12px; color:#94a3b8;">
        — Issued by Inspector: <strong>${inspectorName || 'Exam Control Center'}</strong> at ${new Date().toLocaleTimeString()}
      </div>
    </div>
  `;

  return sendWithRetry({
    to: toEmail,
    subject: `⚠️ Proctor Notice: ${examTitle} — Official Warning for ${hallTicket}`,
    text: `OFFICIAL PROCTOR NOTICE\nCandidate: ${recipientName} (${hallTicket})\nExam: ${examTitle}\nNotice: ${noticeText}`,
    html: wrapBrandTemplate('Official Invigilator Warning', innerHtml),
    emailType: 'inspector_notice',
  });
}

// ============================================================================
// TEMPLATE 12: SYSTEM ALERTING AGENT (ADMIN IMMEDIATE NOTIFICATION)
// ============================================================================
export async function sendSystemAlertAdminEmail(options: {
  alertType: string;
  severity: string;
  message: string;
  ip?: string;
  userAgent?: string;
  details?: Record<string, any>;
  timestamp?: string;
}): Promise<boolean> {
  const { alertType, severity, message, ip, userAgent, details, timestamp } = options;
  const adminRecipient = ADMIN_EMAIL;
  const timeStr = timestamp || new Date().toLocaleString();

  const isCritical = severity === 'CRITICAL' || severity === 'HIGH';
  const headerBg = isCritical ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)';
  const headerColor = isCritical ? '#ef4444' : '#f59e0b';

  const innerHtml = `
    <div style="background:${headerBg}; border:1px solid ${headerColor}; border-radius:8px; padding:12px 16px; margin-bottom:20px;">
      <span style="font-size:12px; font-weight:800; color:${headerColor}; text-transform:uppercase; letter-spacing:1px;">
        🚨 SYSTEM ALERTING AGENT — ${severity}
      </span>
    </div>
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">
      ${alertType}: ${message}
    </h2>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px; margin-bottom:24px;">
      <tr>
        <td style="padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:13px; color:#94a3b8;">Timestamp:</td>
        <td style="padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:13px; color:#f8fafc;">${timeStr}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:13px; color:#94a3b8;">Severity:</td>
        <td style="padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:13px; font-weight:800; color:${headerColor};">${severity}</td>
      </tr>
      ${ip ? `<tr>
        <td style="padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:13px; color:#94a3b8;">IP Address:</td>
        <td style="padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:13px; font-family:monospace; color:#38bdf8;">${ip}</td>
      </tr>` : ''}
      ${userAgent ? `<tr>
        <td style="padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:13px; color:#94a3b8;">User-Agent:</td>
        <td style="padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:12px; color:#cbd5e1;">${userAgent}</td>
      </tr>` : ''}
      ${details ? `<tr>
        <td style="padding:10px 16px; font-size:13px; color:#94a3b8;">Details:</td>
        <td style="padding:10px 16px; font-size:12px; font-family:monospace; color:#f1f5f9;"><pre style="margin:0; white-space:pre-wrap;">${JSON.stringify(details, null, 2)}</pre></td>
      </tr>` : ''}
    </table>
    <p style="font-size:12px; color:#64748b; margin:0;">
      Automated dispatch from LogicWhileLiRE Real-Time System Alerting Agent.
    </p>
  `;

  return sendWithRetry({
    to: adminRecipient,
    subject: `🚨 [${severity}] System Alert: ${alertType} - ${message.slice(0, 50)}`,
    text: `SYSTEM ALERT [${severity}]\nType: ${alertType}\nMessage: ${message}\nTime: ${timeStr}\nIP: ${ip || 'N/A'}\nDetails: ${JSON.stringify(details || {})}`,
    html: wrapBrandTemplate('System Security & Health Alert', innerHtml),
    emailType: 'admin_system_alert',
  });
}
