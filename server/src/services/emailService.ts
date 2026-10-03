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
  emailType: 'otp' | 'result' | 'termination_alert' | 'batch_termination_summary' | 'password_reset' | 'invitation' | 'submission_receipt' | 'inspector_notice' | 'inspector_issue_alert';
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
  const from = process.env.EMAIL_FROM || process.env.OTP_FROM_EMAIL || process.env.SMTP_USER;
  const fromName = process.env.EMAIL_FROM_NAME || 'LogicWhileLiRE';
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
        ? [{ filename: 'logo.png', path: logoPath, cid: 'logicwhilelirelogo' }]
        : [];

      await t.sendMail({
        from: `"${fromName}" <${from}>`,
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
 * Brand email wrapper for LogicWhileLiRE matching PDF report and system branding
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
<body style="margin:0; padding:0; background-color:#0b1329; font-family:'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#f0f4f8;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#0b1329; padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:600px; background-color:#101d3f; border:1px solid rgba(255,255,255,0.08); border-radius:16px; overflow:hidden; box-shadow:0 8px 32px rgba(0,0,0,0.6);" cellspacing="0" cellpadding="0" border="0">
          
          <!-- Brand Header -->
          <tr>
            <td style="padding:32px 32px 24px; text-align:center; background:linear-gradient(180deg, rgba(27,95,181,0.2) 0%, rgba(16,29,63,0) 100%); border-bottom:1px solid rgba(255,255,255,0.06);">
              ${hasLogoImage ? `
                <div style="margin-bottom:12px;">
                  <img src="cid:logicwhilelirelogo" alt="LogicWhileLiRE Logo" width="56" height="56" style="display:inline-block; border-radius:12px; border:1px solid rgba(27,95,181,0.4);" />
                </div>
              ` : `
                <div style="display:inline-block; padding:8px 16px; background:rgba(27,95,181,0.2); border:1px solid #1B5FB5; border-radius:999px; margin-bottom:12px;">
                  <span style="font-size:12px; font-weight:700; letter-spacing:2px; color:#93c5fd; text-transform:uppercase;">OFFICIAL ASSESSMENT</span>
                </div>
              `}
              <h1 style="margin:0 0 6px; font-size:26px; font-weight:800; color:#f0f4f8; letter-spacing:-0.5px;">
                LogicWhileLiRE
              </h1>
              <p style="margin:0; font-size:12px; font-weight:700; letter-spacing:2px; color:#4A7DBE; text-transform:uppercase;">
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

          <!-- Footer -->
          <tr>
            <td style="padding:22px 32px; background-color:#080e1f; border-top:1px solid rgba(255,255,255,0.06); text-align:center;">
              <p style="margin:0 0 6px; font-size:12px; color:#94a3b8;">
                Automated transmission from <strong>LogicWhileLiRE</strong> assessment engine.
              </p>
              <p style="margin:0 0 4px; font-size:11px; color:#64748b;">
                Developed by R. Charan Sai • © 2026 R. Charan Sai. All rights reserved.
              </p>
              <p style="margin:0; font-size:11px; color:#475569;">
                Server-Authoritative Timing • Autonomous AI Proctoring • Code Execution
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
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f0f0f8;">Verification Code</h2>
    <p style="margin:0 0 20px; font-size:15px; color:#8888aa; line-height:1.6;">
      Hello <strong style="color:#f0f0f8;">${recipientName}</strong>,<br>
      You have requested access to take <strong style="color:#c4b5fd;">"${examTitle}"</strong>. Use the secure one-time passcode below to verify your identity and enter the exam lobby:
    </p>

    <div style="background:rgba(124,58,237,0.08); border:2px dashed #7c3aed; border-radius:12px; padding:24px; text-align:center; margin:24px 0;">
      <span style="font-family:'Courier New', monospace; font-size:38px; font-weight:800; letter-spacing:10px; color:#a78bfa; display:block;">
        ${otp}
      </span>
      <span style="display:inline-block; margin-top:8px; font-size:12px; color:#8888aa; text-transform:uppercase; letter-spacing:1px;">
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
    text: `Hello ${recipientName},\n\nYour one-time passcode for "${examTitle}" is: ${otp}\n\nThis code expires in 10 minutes.\n\nLogicWhileLiRE — Logic. While. LiRE.`,
    html: wrapBrandTemplate('Exam OTP Verification', innerHtml),
    emailType: 'otp',
    examId,
  });
}

/**
 * Send password reset email with secure 1-hour link
 */
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

  const html = wrapBrandTemplate('Reset Your Password — LogicWhileLiRE', innerHtml);
  const text = `Hello ${recipientName || 'User'},\n\nWe received a request to reset your password for LogicWhileLiRE.\nPlease use this link within 1 hour to set a new password:\n\n${resetLink}\n\nIf you did not request this, you can safely ignore this email.`;

  return sendWithRetry({
    to: toEmail,
    subject: '🔑 Password Reset Request — LogicWhileLiRE',
    text,
    html,
    emailType: 'password_reset',
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
    hasCodingQuestions?: boolean;
    mcqScore?: number;
    mcqMaxScore?: number;
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
      Participant: <strong style="color:#f0f0f8;">${recipientName}</strong> (Hall Ticket: <span style="font-family:monospace; color:#a78bfa;">${hallTicket}</span>)
    </p>

    <!-- Score Highlight Card -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; margin-bottom:24px;">
      <tr>
        <td style="padding:20px; text-align:center; border-right:1px solid rgba(255,255,255,0.06);">
          <span style="font-size:11px; text-transform:uppercase; color:#8888aa; letter-spacing:1px; display:block; margin-bottom:4px;">${result.hasCodingQuestions || (result.mcqMaxScore !== undefined && result.mcqMaxScore < result.maxScore) ? 'Auto-Graded (MCQ)' : 'Score'}</span>
          <span style="font-size:28px; font-weight:800; color:#10b981;">${result.mcqScore !== undefined ? result.mcqScore : result.totalScore}</span>
          <span style="font-size:14px; color:#8888aa;"> / ${result.mcqMaxScore !== undefined ? result.mcqMaxScore : result.maxScore}</span>
        </td>
        <td style="padding:20px; text-align:center; border-right:1px solid rgba(255,255,255,0.06);">
          <span style="font-size:11px; text-transform:uppercase; color:#8888aa; letter-spacing:1px; display:block; margin-bottom:4px;">${result.hasCodingQuestions || (result.mcqMaxScore !== undefined && result.mcqMaxScore < result.maxScore) ? 'MCQ Accuracy' : 'Normalized %'}</span>
          <span style="font-size:28px; font-weight:800; color:#a78bfa;">${result.normalizedScore ?? percentage}%</span>
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

    ${
      result.hasCodingQuestions || (result.mcqMaxScore !== undefined && result.mcqMaxScore < result.maxScore)
        ? `
      <div style="background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.25); border-radius:8px; padding:12px 16px; margin-bottom:20px; font-size:13px; color:#fbbf24; text-align:left;">
        ℹ️ <strong>Evaluation Transparency:</strong> The score above reflects auto-graded objective/MCQ questions. Coding questions have been submitted and are pending instructor manual review.
      </div>
    `
        : ''
    }

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
    subject: `🏆 Your Exam Results: ${examTitle} — Score ${result.mcqScore !== undefined ? result.mcqScore : result.totalScore}/${result.mcqMaxScore !== undefined ? result.mcqMaxScore : result.maxScore}`,
    text: `Hello ${recipientName},\n\nYour score in "${examTitle}" is ${result.mcqScore !== undefined ? result.mcqScore : result.totalScore}/${result.mcqMaxScore !== undefined ? result.mcqMaxScore : result.maxScore} (${result.normalizedScore ?? percentage}%).${result.hasCodingQuestions || (result.mcqMaxScore !== undefined && result.mcqMaxScore < result.maxScore) ? '\n(Note: Score reflects auto-graded objective/MCQ sections. Coding questions are pending manual review.)' : ''}\nRank: ${isPublic && result.rank ? `#${result.rank}` : 'Private / Available on dashboard'}\nTime: ${timeFormatted}\n\nLogicWhileLiRE — Logic. While. LiRE.`,
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

/**
 * 5. Send Candidate Exam Invitation & Hall Ticket Email
 */
export async function sendExamInvitationEmail(
  toEmail: string,
  recipientName: string,
  hallTicket: string,
  examCode: string,
  examTitle: string,
  durationMinutes: number,
  accessUrl: string
): Promise<boolean> {
  const innerHtml = `
    <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#f8fafc;">
      Official Examination Hall Ticket & Access Pass
    </h2>
    <p style="margin:0 0 16px; font-size:14px; line-height:1.6; color:#94a3b8;">
      Dear <strong style="color:#f8fafc;">${recipientName}</strong>,
    </p>
    <p style="margin:0 0 20px; font-size:14px; line-height:1.6; color:#cbd5e1;">
      You have been scheduled to take the <strong>${examTitle}</strong> on the <strong>LogicWhileLiRE</strong> Enterprise Assessment Platform. Below are your non-transferable access credentials:
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:rgba(255,255,255,0.03); border:1px solid rgba(43,127,255,0.25); border-radius:12px; margin-bottom:24px;">
      <tr>
        <td style="padding:16px 20px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#94a3b8;">Hall Ticket:</td>
        <td style="padding:16px 20px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:15px; font-weight:800; font-family:monospace; color:#38bdf8;">${hallTicket}</td>
      </tr>
      <tr>
        <td style="padding:16px 20px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#94a3b8;">Exam Pass Code:</td>
        <td style="padding:16px 20px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:15px; font-weight:800; font-family:monospace; color:#10b981;">${examCode}</td>
      </tr>
      <tr>
        <td style="padding:16px 20px; font-size:14px; color:#94a3b8;">Duration:</td>
        <td style="padding:16px 20px; font-size:14px; font-weight:700; color:#f8fafc;">${durationMinutes} Minutes (Server-Authoritative Clock)</td>
      </tr>
    </table>
    <div style="text-align:center; margin:30px 0;">
      <a href="${accessUrl}" style="display:inline-block; padding:14px 36px; background:linear-gradient(135deg, #1B5FB5 0%, #0A3F8F 100%); color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; border-radius:8px; box-shadow:0 4px 16px rgba(27, 95, 181, 0.4); letter-spacing:0.5px;">
        🚀 Enter Examination Terminal
      </a>
    </div>
    <div style="background:rgba(27,95,181,0.08); border-left:3px solid #1B5FB5; padding:14px 18px; border-radius:6px; margin-bottom:20px;">
      <h4 style="margin:0 0 6px; font-size:13px; font-weight:700; color:#93c5fd;">System & Proctoring Requirements</h4>
      <ul style="margin:0; padding-left:18px; font-size:12px; color:#cbd5e1; line-height:1.6;">
        <li>Full-screen mode is mandatory and strictly enforced throughout the assessment.</li>
        <li>Dual proctoring (webcam gaze detection + screen live feed) will be monitored by the Inspector.</li>
        <li>Zero-OTP entry allows immediate terminal entrance with your Hall Ticket and Exam Code.</li>
      </ul>
    </div>
  `;

  return sendWithRetry({
    to: toEmail,
    subject: `🎓 Exam Scheduled: ${examTitle} — Pass Code: ${examCode}`,
    text: `Hello ${recipientName},\n\nYou are scheduled for "${examTitle}".\nHall Ticket: ${hallTicket}\nExam Code: ${examCode}\nDuration: ${durationMinutes} mins\nEntrance URL: ${accessUrl}\n\nLogicWhileLiRE — Logic. While. LiRE.`,
    html: wrapBrandTemplate('Official Exam Hall Ticket', innerHtml),
    emailType: 'invitation',
  });
}

/**
 * 6. Send Immediate Candidate Submission Confirmation & Integrity Receipt Email
 */
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
      Your submission for <strong>${examTitle}</strong> has been securely stamped into the server-authoritative audit ledger.
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
    <p style="margin:0; font-size:13px; color:#94a3b8; line-height:1.6;">
      Your results and performance analytics will be reviewed by the institution's examination committee and published to your student dashboard.
    </p>
  `;

  return sendWithRetry({
    to: toEmail,
    subject: `✅ Exam Submission Confirmed: ${examTitle} (${hallTicket})`,
    text: `Hello ${recipientName},\n\nYour submission for "${examTitle}" was successfully received.\nAnswered: ${answeredCount}/${totalQuestions}\nReceipt Hash: ${submissionHash}\n\nLogicWhileLiRE — Logic. While. LiRE.`,
    html: wrapBrandTemplate('Submission Confirmation Receipt', innerHtml),
    emailType: 'submission_receipt',
  });
}

/**
 * 7. Send Real-Time Security Anomaly Alert to Inspector / Instructor
 */
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
    <p style="margin:0 0 16px; font-size:14px; line-height:1.6; color:#cbd5e1;">
      A live anomaly was intercepted during active proctor monitoring for <strong>${examTitle}</strong>:
    </p>
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
    <p style="margin:0; font-size:13px; color:#94a3b8;">
      Open your Live Proctor Console to inspect the candidate's real-time camera feed or issue an on-screen warning.
    </p>
  `;

  return sendWithRetry({
    to: inspectorEmail,
    subject: `🚨 [INSPECTOR ALERT] ${issueType.toUpperCase()}: ${participantName} (${hallTicket})`,
    text: `PROCTOR ALERT [${severity.toUpperCase()}]: ${issueType}\nCandidate: ${participantName} (${hallTicket})\nExam: ${examTitle}\nDetails: ${details}\n\nLogicWhileLiRE Inspector Command`,
    html: wrapBrandTemplate('Inspector Security Alert', innerHtml),
    emailType: 'inspector_issue_alert',
  });
}

/**
 * 8. Send Official Proctor Warning / Direct Reprimand Notice to Candidate's Email
 */
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
    <p style="margin:0 0 20px; font-size:14px; line-height:1.6; color:#cbd5e1;">
      During your session for <strong>${examTitle}</strong>, the examination inspector issued the following directive:
    </p>
    <div style="background:rgba(255,255,255,0.04); border-left:4px solid #f59e0b; padding:16px 20px; border-radius:4px; margin-bottom:24px;">
      <p style="margin:0; font-size:15px; font-weight:600; color:#fef3c7; line-height:1.6;">
        "${noticeText}"
      </p>
      <div style="margin-top:10px; font-size:12px; color:#94a3b8;">
        — Issued by Inspector: <strong>${inspectorName || 'Exam Control Center'}</strong> at ${new Date().toLocaleTimeString()}
      </div>
    </div>
    <p style="margin:0; font-size:12px; color:#94a3b8; line-height:1.5;">
      Failure to comply with invigilator directives will result in immediate session invalidation and academic disciplinary review.
    </p>
  `;

  return sendWithRetry({
    to: toEmail,
    subject: `⚠️ Proctor Notice: ${examTitle} — Official Warning for ${hallTicket}`,
    text: `OFFICIAL PROCTOR NOTICE\nCandidate: ${recipientName} (${hallTicket})\nExam: ${examTitle}\nNotice: ${noticeText}\nIssued by: ${inspectorName}`,
    html: wrapBrandTemplate('Official Invigilator Warning', innerHtml),
    emailType: 'inspector_notice',
  });
}

