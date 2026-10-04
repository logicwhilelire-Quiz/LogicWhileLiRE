/**
 * inspectorRoutes.ts — LogicWhileLiRE Master Inspector Command & Candidate Communication Engine
 * Provides complete monitoring oversight, live broadcast, candidate reprimands, session freeze/extension,
 * and automated email dispatching (reply emails, OTPs, receipts, inspector alert messages).
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../db/supabase';
import { adminAuth } from '../middleware/adminAuth';
import { otpRateLimit } from '../middleware/rateLimiter';
import { validateBody, inspectorBroadcastSchema, inspectorCandidateActionSchema } from '../middleware/validate';
import {
  sendExamInvitationEmail,
  sendCandidateSubmissionReceiptEmail,
  sendInspectorIssueAlertEmail,
  sendInspectorDirectNoticeEmail,
  sendOtpEmail,
  sendResultEmail,
} from '../services/emailService';


const router = Router();

/**
 * In-memory fallback event ledger for demo mode
 */
interface AuditEvent {
  id: string;
  examCode: string;
  hallTicket?: string;
  eventType: string;
  actionBy: string;
  details: string;
  timestamp: string;
}

export interface OutboundEmailRecord {
  id: string;
  type: 'otp' | 'invitation' | 'submission_receipt' | 'inspector_issue_alert' | 'inspector_notice';
  recipient: string;
  recipientName?: string;
  examCode: string;
  subject: string;
  status: 'DELIVERED' | 'QUEUED';
  timestamp: string;
}

const AUDIT_LEDGER: AuditEvent[] = [];
const EMAIL_DISPATCH_LEDGER: OutboundEmailRecord[] = process.env.NODE_ENV === 'production' ? [] : [
  {
    id: 'eml-init-1',
    type: 'invitation',
    recipient: 'candidate01@example.com',
    recipientName: 'Candidate 01',
    examCode: 'DEMO123',
    subject: '🎓 Official Hall Ticket & Passcode — DEMO123',
    status: 'DELIVERED',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'eml-init-2',
    type: 'otp',
    recipient: 'candidate02@example.com',
    recipientName: 'Candidate 02',
    examCode: 'DEMO123',
    subject: '🔐 Your Verification Code: 491024 — DEMO123',
    status: 'DELIVERED',
    timestamp: new Date(Date.now() - 2800000).toISOString(),
  },
];

/**
 * POST /api/v1/inspector/broadcast
 * Broadcasts an announcement or invigilator order to all students in an exam room
 */
router.post('/broadcast', adminAuth, validateBody(inspectorBroadcastSchema), async (req: Request, res: Response) => {
  try {
    const { examCode, message, priority = 'normal', inspectorName = 'Lead Inspector' } = req.body;

    if (!examCode || !message) {
      return res.status(400).json({ success: false, error: 'examCode and message are required' });
    }

    const payload = {
      examCode: String(examCode).toUpperCase(),
      message: String(message),
      priority,
      inspectorName,
      timestamp: new Date().toISOString(),
    };

    // Broadcast through Supabase Realtime channel if available
    try {
      const channel = supabase.channel(`realtime:monitor-${payload.examCode}`);
      if (typeof (channel as any)?.send === 'function') {
        await (channel as any).send({
          type: 'broadcast',
          event: 'admin_broadcast',
          payload,
        });
      }
    } catch (realtimeErr) {
      console.warn('[INSPECTOR] Realtime broadcast channel fallback active:', realtimeErr);
    }

    const eventRecord: AuditEvent = {
      id: `bc-${Date.now()}`,
      examCode: payload.examCode,
      eventType: 'INSPECTOR_BROADCAST',
      actionBy: inspectorName,
      details: message,
      timestamp: payload.timestamp,
    };
    AUDIT_LEDGER.push(eventRecord);

    res.json({
      success: true,
      message: `Announcement broadcasted to exam room ${payload.examCode}`,
      eventId: eventRecord.id,
      data: payload,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Broadcast failed';
    res.status(500).json({ success: false, error: msg });
  }
});

/**
 * POST /api/v1/inspector/candidate-action
 * Executes direct actions on a specific candidate: warn, whisper, pause, resume, extend_time, terminate
 */
router.post('/candidate-action', adminAuth, validateBody(inspectorCandidateActionSchema), async (req: Request, res: Response) => {
  try {
    const {
      examCode,
      hallTicket,
      action, // 'warn' | 'whisper' | 'pause' | 'resume' | 'extend_time' | 'terminate'
      message,
      seconds = 300, // For time extensions (default 5 mins)
      inspectorName = 'Exam Invigilator',
      studentEmail,
      studentName,
    } = req.body;

    if (!examCode || !hallTicket || !action) {
      return res.status(400).json({ success: false, error: 'examCode, hallTicket, and action are required' });
    }

    const targetCode = String(examCode).toUpperCase();
    const targetHt = String(hallTicket).trim();

    // Map action to realtime broadcast event
    let eventName = 'admin_warning';
    let defaultMsg = `Proctor Notice: Suspicious behavior logged.`;

    if (action === 'pause') {
      eventName = 'admin_pause';
      defaultMsg = 'Your examination session has been temporarily paused by the invigilator.';
    } else if (action === 'resume') {
      eventName = 'admin_resume';
      defaultMsg = 'Your examination session has been resumed by the invigilator.';
    } else if (action === 'extend_time') {
      eventName = 'admin_extend_time';
      defaultMsg = `Inspector granted a +${Math.round(seconds / 60)} minute time extension.`;
    } else if (action === 'terminate') {
      eventName = 'admin_terminate';
      defaultMsg = 'Your session has been terminated by the exam inspector for proctoring violations.';
    } else if (action === 'whisper') {
      eventName = 'admin_message';
      defaultMsg = message || 'Message from proctor.';
    }

    const actionPayload = {
      examCode: targetCode,
      hallTicket: targetHt,
      action,
      message: message || defaultMsg,
      seconds: Number(seconds),
      inspectorName,
      timestamp: new Date().toISOString(),
    };

    // Dispatch realtime broadcast
    try {
      const channel = supabase.channel(`realtime:monitor-${targetCode}`);
      if (typeof (channel as any)?.send === 'function') {
        await (channel as any).send({
          type: 'broadcast',
          event: eventName,
          payload: actionPayload,
        });
      }
    } catch (e) {
      console.warn('[INSPECTOR] Realtime send notice:', e);
    }

    // If student email is provided and action is a warning or reprimand, also dispatch official email
    if (studentEmail && (action === 'warn' || action === 'terminate' || action === 'whisper')) {
      sendInspectorDirectNoticeEmail(
        studentEmail,
        studentName || targetHt,
        targetHt,
        targetCode,
        inspectorName,
        message || defaultMsg
      ).catch((mailErr) => console.warn('[INSPECTOR] Notice email dispatch notice:', mailErr));
    }

    const actionRecord: AuditEvent = {
      id: `act-${Date.now()}`,
      examCode: targetCode,
      hallTicket: targetHt,
      eventType: `INSPECTOR_${action.toUpperCase()}`,
      actionBy: inspectorName,
      details: message || defaultMsg,
      timestamp: actionPayload.timestamp,
    };
    AUDIT_LEDGER.push(actionRecord);

    res.json({
      success: true,
      message: `Action "${action}" successfully executed for ${targetHt}`,
      action,
      actionPayload,
      eventId: actionRecord.id,
      seconds: Number(seconds),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Action execution failed';
    res.status(500).json({ success: false, error: msg });
  }
});

/**
 * POST /api/v1/inspector/report-issue
 * Automatically alerts the inspector via email when any anomaly, hardware drop, or violation occurs
 */
router.post('/report-issue', async (req: Request, res: Response) => {
  try {
    const {
      examCode,
      hallTicket,
      studentName = 'Candidate',
      candidateName,
      issueType,
      details,
      description,
      severity = 'high',
      inspectorEmail = process.env.INSPECTOR_ALERT_EMAIL || process.env.ADMIN_EMAIL,
    } = req.body;

    if (!examCode || !hallTicket || !issueType) {
      return res.status(400).json({ success: false, error: 'examCode, hallTicket, and issueType required' });
    }

    const resolvedName = candidateName || studentName;
    const resolvedDetails = details || description || 'Live telemetry flagged anomaly during examination session.';

    // Asynchronously dispatch email to inspector
    sendInspectorIssueAlertEmail(
      inspectorEmail,
      resolvedName,
      hallTicket,
      examCode,
      issueType,
      resolvedDetails,
      severity
    ).catch((err) => console.warn('[INSPECTOR] Issue alert email notice:', err));

    const issueRecord: AuditEvent = {
      id: `iss-${Date.now()}`,
      examCode: String(examCode).toUpperCase(),
      hallTicket: String(hallTicket),
      eventType: `ANOMALY_${issueType.toUpperCase()}`,
      actionBy: 'SYSTEM_WATCHDOG',
      details: resolvedDetails,
      timestamp: new Date().toISOString(),
    };
    AUDIT_LEDGER.push(issueRecord);

    res.json({
      success: true,
      message: `Issue logged and inspector alert triggered for ${hallTicket}`,
      issueId: issueRecord.id,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Reporting issue failed';
    res.status(500).json({ success: false, error: msg });
  }
});

/**
 * POST /api/v1/communication/send-otp
 * Dispatches a one-time passcode or verification code to candidate's email
 */
router.post('/send-otp', otpRateLimit, async (req: Request, res: Response) => {
  try {
    const { email, name = 'Candidate', examTitle = 'LogicWhileLiRE Assessment', otp } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'email is required' });
    }

    const generatedOtp = otp || Math.floor(100000 + Math.random() * 900000).toString();

    await sendOtpEmail(email, generatedOtp, examTitle, name);

    res.json({
      success: true,
      message: `Passcode sent to ${email}`,
      maskedEmail: email.replace(/(.{2})(.*)(?=@)/, (_gp1: string, a: string, b: string) => `${a}${'*'.repeat(b.length)}`),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to send OTP';
    res.status(500).json({ success: false, error: msg });
  }
});

/**
 * POST /api/v1/communication/send-invitation
 * Sends candidate their exam pass code, hall ticket, and direct entrance URL
 */
router.post('/send-invitation', adminAuth, async (req: Request, res: Response) => {
  try {
    const {
      email,
      name,
      hallTicket,
      examCode,
      examTitle = 'LogicWhileLiRE Certification Exam',
      durationMinutes = 60,
      accessUrl,
    } = req.body;

    if (!email || !hallTicket || !examCode) {
      return res.status(400).json({ success: false, error: 'email, hallTicket, and examCode are required' });
    }

    const clientBase = (process.env.CLIENT_ORIGIN || process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
    const appUrl = accessUrl || `${clientBase}/enter-exam`;

    await sendExamInvitationEmail(
      email,
      name || hallTicket,
      hallTicket,
      examCode,
      examTitle,
      Number(durationMinutes),
      appUrl
    );

    res.json({
      success: true,
      message: `Exam invitation email dispatched to ${email}`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to send invitation';
    res.status(500).json({ success: false, error: msg });
  }
});

/**
 * POST /api/v1/communication/send-receipt
 * Sends immediate submission confirmation receipt to candidate
 */
router.post('/send-receipt', async (req: Request, res: Response) => {
  try {
    const email = req.body.email || req.body.candidateEmail;
    const name = req.body.name || req.body.candidateName;
    const hallTicket = req.body.hallTicket;
    const examTitle = req.body.examTitle || req.body.examName || req.body.examCode || 'LogicWhileLiRE Examination';
    const answeredCount = req.body.answeredCount !== undefined ? req.body.answeredCount : (req.body.questionsAttempted || 0);
    const totalQuestions = req.body.totalQuestions || 15;
    const submissionHash = req.body.submissionHash;

    if (!email || !hallTicket) {
      return res.status(400).json({ success: false, error: 'email (or candidateEmail) and hallTicket are required' });
    }

    const hash = submissionHash || `LWL-SUB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    await sendCandidateSubmissionReceiptEmail(
      email,
      name || hallTicket,
      hallTicket,
      examTitle,
      Number(answeredCount),
      Number(totalQuestions),
      hash
    );

    res.json({
      success: true,
      message: `Submission receipt dispatched to ${email}`,
      hash,
      receiptHash: hash,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to send submission receipt';
    res.status(500).json({ success: false, error: msg });
  }
});

/**
 * GET /api/v1/inspector/audit-log/:examCode
 * Retrieves full forensic audit log for an examination
 */
router.get('/audit-log/:examCode', adminAuth, (req: Request, res: Response) => {
  const code = String(req.params.examCode).toUpperCase();
  const logs = AUDIT_LEDGER.filter((l) => l.examCode === code);

  res.json({
    success: true,
    examCode: code,
    totalEvents: logs.length,
    events: logs,
  });
});

/**
 * GET /api/v1/inspector/email-logs/:examCode?
 * Retrieves outbound email communication records for invigilator verification
 */
router.get(['/email-logs', '/email-logs/:examCode'], adminAuth, (req: Request, res: Response) => {
  const code = req.params.examCode ? String(req.params.examCode).toUpperCase() : null;
  const filtered = code ? EMAIL_DISPATCH_LEDGER.filter((e) => e.examCode === code) : EMAIL_DISPATCH_LEDGER;

  res.json({
    success: true,
    examCode: code || 'ALL',
    totalEmails: filtered.length,
    emails: filtered,
  });
});

/**
 * POST /api/v1/inspector/test-email
 * Invigilator test workbench to live-dispatch any template
 */
router.post('/test-email', adminAuth, async (req: Request, res: Response) => {
  try {
    const {
      type,
      recipient,
      name = 'Test Candidate',
      hallTicket = 'HT-TEST-001',
      examCode = 'DEMO123',
      examTitle = 'LogicWhileLiRE Certification Exam',
    } = req.body;

    if (!recipient || !type) {
      return res.status(400).json({ success: false, error: 'recipient and type required' });
    }

    let subject = 'LogicWhileLiRE Official Communication';
    if (type === 'otp') {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      await sendOtpEmail(recipient, name, code, examTitle);
      subject = `🔐 Your Verification Code: ${code} — ${examTitle}`;
    } else if (type === 'invitation') {
      const clientBase = (process.env.CLIENT_ORIGIN || process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
      await sendExamInvitationEmail(
        recipient,
        name,
        hallTicket,
        examCode,
        examTitle,
        60,
        `${clientBase}/enter-exam?code=${examCode}&ht=${hallTicket}`
      );
      subject = `🎓 Official Examination Hall Ticket & Access Pass — ${examCode}`;
    } else if (type === 'submission_receipt') {
      const hash = `LWL-TEST-${Date.now().toString(36).toUpperCase()}`;
      await sendCandidateSubmissionReceiptEmail(recipient, name, hallTicket, examTitle, 15, 15, hash);
      subject = `✅ Exam Submission Confirmed: ${examTitle} (${hallTicket})`;
    } else if (type === 'inspector_issue_alert') {
      await sendInspectorIssueAlertEmail(
        recipient,
        name,
        hallTicket,
        examCode,
        'tab_switch',
        'Demonstration alert triggered via Inspector Email Test Workbench',
        'high'
      );
      subject = `🚨 [INSPECTOR ALERT] TAB_SWITCH: ${name} (${hallTicket})`;
    } else if (type === 'inspector_notice') {
      await sendInspectorDirectNoticeEmail(
        recipient,
        name,
        hallTicket,
        examTitle,
        'Chief Exam Invigilator',
        'Official proctor warning: Please center your webcam and keep exam in fullscreen.'
      );
      subject = `⚠️ Proctor Notice: ${examTitle} — Official Warning for ${hallTicket}`;
    }

    const rec: OutboundEmailRecord = {
      id: `eml-${Date.now()}`,
      type,
      recipient,
      recipientName: name,
      examCode,
      subject,
      status: 'DELIVERED',
      timestamp: new Date().toISOString(),
    };
    EMAIL_DISPATCH_LEDGER.unshift(rec);

    res.json({
      success: true,
      message: `Test email (${type}) successfully dispatched to ${recipient}`,
      record: rec,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Test email failed';
    res.status(500).json({ success: false, error: msg });
  }
});

export default router;
