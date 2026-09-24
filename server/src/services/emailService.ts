import nodemailer, { Transporter } from 'nodemailer';
import path from 'path';
import fs from 'fs';
import { supabase } from '../db/supabase';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_PORT === '465',
      auth: { user, pass },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production',
      },
    });
  }
  return transporter;
}

/**
 * Verify SMTP connection at boot or diagnostic check
 */
export async function verifySmtpConnection(): Promise<{ connected: boolean; error?: string }> {
  const t = getTransporter();
  if (!t) {
    return { connected: false, error: 'SMTP credentials missing in environment variables' };
  }
  try {
    await t.verify();
    return { connected: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'SMTP verification failed';
    return { connected: false, error: msg };
  }
}

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html: string;
  emailType: 'otp' | 'result' | 'termination_alert' | 'batch_termination_summary';
  examId?: string;
  sessionId?: string;
  participantId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log undeliverable email failure to the deliverable_failures database table
 */
export async function logDeliverableFailure(
  payload: EmailPayload,
  errorMessage: string,
  attemptCount: number
): Promise<void> {
  try {
    await supabase.from('deliverable_failures').insert({
      recipient_email: payload.to,
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
    console.error('[SMTP] Failed to record deliverable failure in database:', dbErr);
  }
}

/**
 * Send email with exponential backoff retry (max 3 attempts).
 * Strictly gates console-log fallback behind NODE_ENV !== 'production'.
 */
export async function sendWithRetry(payload: EmailPayload, maxAttempts: number = 3): Promise<boolean> {
  const from = process.env.OTP_FROM_EMAIL || process.env.SMTP_USER || 'noreply@logicwhilequiz.com';
  const t = getTransporter();

  // If in dev and no SMTP credentials configured, gate console log fallback
  if (!t) {
    if (process.env.NODE_ENV === 'production') {
      const err = new Error('SMTP credentials not configured in production environment');
      await logDeliverableFailure(payload, err.message, 0);
      throw err;
    } else {
      console.log(`[SMTP-DEV] (No SMTP credentials configured) Mock delivery to ${payload.to} [${payload.emailType}]: ${payload.subject}`);
      return true;
    }
  }

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const logoPath = path.resolve(__dirname, '../../logo.png');
      const attachments = fs.existsSync(logoPath)
        ? [{ filename: 'logo.png', path: logoPath, cid: 'logicwhilelogo' }]
        : [];

      await t.sendMail({
        from: `"LogicWhile QUIZ" <${from}>`,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
        attachments,
      });

      console.log(`[SMTP] Successfully delivered ${payload.emailType} to ${payload.to} on attempt ${attempt}`);
      return true;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[SMTP] Attempt ${attempt}/${maxAttempts} failed for ${payload.to}: ${lastError.message}`);

      if (attempt < maxAttempts) {
        // Exponential backoff: 1s, 2s
        const delayMs = attempt * 1000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  // All attempts failed: log to database
  const errorMessage = lastError?.message || 'SMTP send failed after maximum retries';
  await logDeliverableFailure(payload, errorMessage, maxAttempts);

  if (process.env.NODE_ENV === 'production') {
    throw lastError || new Error(errorMessage);
  }
  return false;
}

/**
 * Brand email wrapper for LogicWhile QUIZ matching PDF report and system branding
 */
export function wrapBrandTemplate(title: string, innerHtml: string): string {
  const logoPath = path.resolve(__dirname, '../../logo.png');
  const hasLogoImage = fs.existsSync(logoPath);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0; padding:0; background-color:#07090e; font-family:'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#07090e; padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:600px; background-color:#0d121f; border:1px solid rgba(245,158,11,0.22); border-radius:16px; overflow:hidden; box-shadow:0 12px 40px rgba(0,0,0,0.7), 0 0 24px rgba(245,158,11,0.08);" cellspacing="0" cellpadding="0" border="0">
          
          <!-- Brand Header -->
          <tr>
            <td style="padding:32px 32px 24px; text-align:center; background:linear-gradient(180deg, rgba(245,158,11,0.12) 0%, rgba(13,18,31,0) 100%); border-bottom:1px solid rgba(255,255,255,0.06);">
              ${hasLogoImage ? `
                <div style="margin-bottom:14px;">
                  <img src="cid:logicwhilelogo" alt="LogicWhile Logo" width="58" height="58" style="display:inline-block; border-radius:12px; border:1.5px solid rgba(245,158,11,0.85); background:#ffffff; padding:2px; box-shadow:0 4px 16px rgba(245,158,11,0.35);" />
                </div>
              ` : `
                <div style="display:inline-block; padding:8px 18px; background:rgba(245,158,11,0.15); border:1px solid rgba(245,158,11,0.5); border-radius:999px; margin-bottom:14px;">
                  <span style="font-size:12px; font-weight:700; letter-spacing:2px; color:#fbbf24; text-transform:uppercase;">OFFICIAL ASSESSMENT</span>
                </div>
              `}
              <h1 style="margin:0 0 6px; font-size:26px; font-weight:800; color:#f8fafc; letter-spacing:-0.5px;">
                LogicWhile <span style="display:inline-block; background:linear-gradient(135deg,#f59e0b 0%,#d97706 45%,#ea580c 100%); color:#ffffff; padding:3px 10px; border-radius:6px; font-size:19px; font-weight:900; letter-spacing:3px; vertical-align:middle; box-shadow:0 2px 10px rgba(245,158,11,0.45); text-shadow:0 1px 2px rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.35);">QUIZ</span>
              </h1>
              <p style="margin:0; font-size:11px; font-weight:700; letter-spacing:2.5px; color:#f59e0b; text-transform:uppercase; text-shadow:0 0 10px rgba(245,158,11,0.25);">
                Elevating Coding Knowledge
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding:32px 32px 28px;">
              ${innerHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:22px 32px; background-color:#090d16; border-top:1px solid rgba(255,255,255,0.06); text-align:center;">
              <p style="margin:0 0 6px; font-size:12px; color:#94a3b8;">
                Automated security transmission from <strong>LogicWhile QUIZ</strong> platform.
              </p>
              <p style="margin:0; font-size:11px; color:#64748b;">
                Server-Authoritative Timing • Anti-Tamper Proctoring • Rotating Question Sets
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * 1. Send OTP Verification Email with retry
 */
export async function sendOtpEmail(
  toEmail: string,
  recipientName: string,
  otp: string,
  examTitle: string,
  examId?: string
): Promise<void> {
  const innerHtml = `
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">Verification Code</h2>
    <p style="margin:0 0 20px; font-size:15px; color:#94a3b8; line-height:1.6;">
      Hello <strong style="color:#f8fafc;">${recipientName}</strong>,<br>
      You have requested access to take <strong style="color:#fbbf24;">"${examTitle}"</strong>. Use the secure one-time passcode below to verify your identity and enter the exam lobby:
    </p>

    <div style="background:rgba(245,158,11,0.06); border:2px dashed #f59e0b; border-radius:12px; padding:24px; text-align:center; margin:24px 0;">
      <span style="font-family:'Courier New', monospace; font-size:40px; font-weight:800; letter-spacing:10px; color:#f59e0b; display:block; text-shadow:0 0 16px rgba(245,158,11,0.35);">
        ${otp}
      </span>
      <span style="display:inline-block; margin-top:8px; font-size:12px; color:#94a3b8; text-transform:uppercase; letter-spacing:1px;">
        ⏱ Valid for 10 minutes only
      </span>
    </div>

    <p style="margin:0; font-size:13px; color:#8888aa; line-height:1.5;">
      ⚠️ <em>Security Notice: Never share this OTP with anyone. Our system administrators will never ask for your verification code.</em>
    </p>
  `;

  await sendWithRetry({
    to: toEmail,
    subject: `🔐 Your OTP Code: ${otp} — ${examTitle}`,
    text: `Hello ${recipientName},\n\nYour one-time passcode for "${examTitle}" is: ${otp}\n\nThis code expires in 10 minutes.\n\nLogicWhile QUIZ — Elevating Coding Knowledge`,
    html: wrapBrandTemplate('Exam OTP Verification', innerHtml),
    emailType: 'otp',
    examId,
  });
}

/**
 * 2. Send Result Email with score, rank, and time taken
 */
export async function sendResultEmail(
  toEmail: string,
  recipientName: string,
  hallTicket: string,
  examTitle: string,
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
  },
  examId?: string,
  sessionId?: string,
  participantId?: string
): Promise<void> {
  const percentage = result.maxScore > 0 ? Math.round((result.totalScore / result.maxScore) * 100) : 0;
  const minutes = Math.floor(result.timeTakenSeconds / 60);
  const seconds = result.timeTakenSeconds % 60;
  const timeFormatted = `${minutes}m ${seconds}s`;

  let topicRows = '';
  if (result.topicBreakdown) {
    topicRows = Object.entries(result.topicBreakdown)
      .map(([topic, stats]) => {
        const total = stats.correct + stats.wrong;
        const accuracy = total > 0 ? Math.round((stats.correct / total) * 100) : 0;
        return `
          <tr>
            <td style="padding:10px 14px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#f0f0f8;">${topic}</td>
            <td style="padding:10px 14px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#10b981; font-weight:700; text-align:center;">${stats.correct} / ${total}</td>
            <td style="padding:10px 14px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#a78bfa; font-weight:700; text-align:center;">${stats.score} / ${stats.maxScore}</td>
            <td style="padding:10px 14px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#8888aa; text-align:right;">${accuracy}%</td>
          </tr>
        `;
      })
      .join('');
  }

  const isPublic = result.isLeaderboardPublic !== false;
  const rankDisplay = isPublic
    ? result.rank ? `#${result.rank}` : '—'
    : '<span style="font-size:12px; color:#8888aa;">Private</span>';

  const innerHtml = `
    <h2 style="margin:0 0 6px; font-size:20px; font-weight:700; color:#f0f0f8;">Official Assessment Results</h2>
    <p style="margin:0 0 20px; font-size:15px; color:#8888aa;">
      Exam: <strong style="color:#f0f0f8;">${examTitle}</strong><br>
      Participant: <strong style="color:#f8fafc;">${recipientName}</strong> (Hall Ticket: <span style="font-family:monospace; color:#fbbf24;">${hallTicket}</span>)
    </p>

    <!-- Score Highlight Card -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; margin-bottom:24px;">
      <tr>
        <td style="padding:20px; text-align:center; border-right:1px solid rgba(255,255,255,0.06);">
          <span style="font-size:11px; text-transform:uppercase; color:#94a3b8; letter-spacing:1px; display:block; margin-bottom:4px;">Score</span>
          <span style="font-size:28px; font-weight:800; color:#10b981;">${result.totalScore}</span>
          <span style="font-size:14px; color:#94a3b8;"> / ${result.maxScore}</span>
        </td>
        <td style="padding:20px; text-align:center; border-right:1px solid rgba(255,255,255,0.06);">
          <span style="font-size:11px; text-transform:uppercase; color:#94a3b8; letter-spacing:1px; display:block; margin-bottom:4px;">Normalized %</span>
          <span style="font-size:28px; font-weight:800; color:#fbbf24;">${result.normalizedScore ?? percentage}%</span>
        </td>
        <td style="padding:20px; text-align:center;">
          <span style="font-size:11px; text-transform:uppercase; color:#8888aa; letter-spacing:1px; display:block; margin-bottom:4px;">Rank</span>
          <span style="font-size:28px; font-weight:800; color:#f59e0b;">
            ${rankDisplay}
          </span>
          ${isPublic && result.totalParticipants ? `<span style="font-size:12px; color:#8888aa;"><br>of ${result.totalParticipants}</span>` : ''}
        </td>
      </tr>
    </table>

    <p style="margin:0 0 16px; font-size:14px; color:#8888aa;">
      ⏱ <strong>Time Taken:</strong> ${timeFormatted} &nbsp;|&nbsp; 
      ✅ <strong>Correct:</strong> ${result.correctCount} &nbsp;|&nbsp; 
      ❌ <strong>Incorrect:</strong> ${result.wrongCount}
    </p>

    ${
      topicRows
        ? `
      <h3 style="margin:24px 0 12px; font-size:16px; font-weight:700; color:#f0f0f8;">Topic Breakdown</h3>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid rgba(255,255,255,0.08); border-radius:8px; overflow:hidden;">
        <thead>
          <tr style="background:rgba(255,255,255,0.04);">
            <th style="padding:10px 14px; font-size:12px; text-align:left; color:#8888aa; text-transform:uppercase;">Topic</th>
            <th style="padding:10px 14px; font-size:12px; text-align:center; color:#8888aa; text-transform:uppercase;">Questions</th>
            <th style="padding:10px 14px; font-size:12px; text-align:center; color:#8888aa; text-transform:uppercase;">Score</th>
            <th style="padding:10px 14px; font-size:12px; text-align:right; color:#8888aa; text-transform:uppercase;">Accuracy</th>
          </tr>
        </thead>
        <tbody>
          ${topicRows}
        </tbody>
      </table>
    `
        : ''
    }
  `;

  await sendWithRetry({
    to: toEmail,
    subject: `🏆 Your Exam Results: ${examTitle} — Score ${result.totalScore}/${result.maxScore}`,
    text: `Hello ${recipientName},\n\nYour score in "${examTitle}" is ${result.totalScore}/${result.maxScore} (${result.normalizedScore ?? percentage}%).\nRank: ${isPublic && result.rank ? `#${result.rank}` : 'Private / Available on dashboard'}\nTime: ${timeFormatted}\n\nLogicWhile QUIZ — Elevating Coding Knowledge`,
    html: wrapBrandTemplate('Exam Results & Standings', innerHtml),
    emailType: 'result',
    examId,
    sessionId,
    participantId,
  });
}

/**
 * 3. Send Single Admin Alert on Session Termination with Violation Log
 */
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
        <td style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; font-family:monospace; color:#fbbf24;">${hallTicket}</td>
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
        <td style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#8888aa;">Total Violations:</td>
        <td style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; font-weight:700; color:#f59e0b;">${violationCount}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px; font-size:14px; color:#8888aa;">Client IP:</td>
        <td style="padding:12px 16px; font-size:14px; font-family:monospace; color:#f0f0f8;">${ipAddress || 'Not recorded'}</td>
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

/**
 * 4. Send Batched Summary Email when > 3 terminations happen within a 5-minute window
 */
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
        <div style="font-family:monospace; font-size:11px; color:#fbbf24;">${t.hallTicket}</div>
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

    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f0f0f8;">Multiple Proctoring Breaches Detected</h2>
    <p style="margin:0 0 20px; font-size:15px; color:#8888aa; line-height:1.6;">
      Exam: <strong style="color:#f0f0f8;">${examTitle}</strong><br>
      High volume of proctoring violations detected. To avoid flooding your inbox, all terminations in this 5-minute window have been consolidated below:
    </p>

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

    <p style="margin:0; font-size:13px; color:#8888aa;">
      Access the admin console live sessions view to inspect individual audit logs or override terminations if needed.
    </p>
  `;

  await sendWithRetry({
    to: adminEmail,
    subject: `🚨 [SECURITY SUMMARY] ${terminations.length} Sessions Terminated — ${examTitle}`,
    text: `SECURITY SUMMARY: ${terminations.length} Sessions Terminated in "${examTitle}" within 5 minutes.\nReview the admin dashboard for detailed logs.`,
    html: wrapBrandTemplate('Multiple Terminations Summary', innerHtml),
    emailType: 'batch_termination_summary',
    examId,
  });
}
