import { Request, Response } from 'express';
import { supabase } from '../db/supabase';
import { sendTerminationAlertEmail } from '../services/emailService';

const VIOLATION_THRESHOLD = parseInt(process.env.VIOLATION_THRESHOLD || '2');

/**
 * POST /api/session/:sessionId/violation
 * Log a proctoring violation. Can be called via navigator.sendBeacon.
 * Returns a warning or termination status based on violation count.
 */
export async function logViolation(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.participant!;
  const { type, notes } = req.body;

  try {
    // Validate session is active
    const { data: session, error: sessionError } = await supabase
      .from('exam_sessions')
      .select('status, violation_count')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }

    if (session.status === 'terminated' || session.status === 'submitted') {
      res.json({ success: true, status: session.status });
      return;
    }

    // Insert violation record
    await supabase.from('violations').insert({
      session_id: sessionId,
      type,
      timestamp: new Date().toISOString(),
      notes: notes || null,
    });

    // Increment violation count
    const newViolationCount = (session.violation_count || 0) + 1;
    const shouldTerminate = newViolationCount >= VIOLATION_THRESHOLD;

    const updatePayload: Record<string, unknown> = { violation_count: newViolationCount };

    if (shouldTerminate) {
      updatePayload.status = 'terminated';
      updatePayload.termination_reason = `Violation threshold reached: ${type}`;
      updatePayload.submitted_at = new Date().toISOString();
    }

    await supabase
      .from('exam_sessions')
      .update(updatePayload)
      .eq('id', sessionId);

    if (shouldTerminate) {
      // Trigger admin alert email asynchronously via queue & batcher
      (async () => {
        try {
          const { participantId, examId } = req.participant!;
          const { data: pData } = await supabase
            .from('participants')
            .select('name, hall_ticket')
            .eq('id', participantId)
            .single();
          const { data: eData } = await supabase
            .from('exams')
            .select('title, admin_email')
            .eq('id', examId)
            .single();

          const { data: vLogs } = await supabase
            .from('violations')
            .select('type, timestamp, notes')
            .eq('session_id', sessionId)
            .order('timestamp', { ascending: true });

          const targetAdminEmail = process.env.ADMIN_ALERT_EMAIL || eData?.admin_email || process.env.SMTP_USER;

          if (targetAdminEmail) {
            const { emailQueue } = await import('../services/emailQueue');
            emailQueue.enqueueTerminationAlert({
              sessionId,
              participantId,
              participantName: pData?.name || 'Participant',
              hallTicket: pData?.hall_ticket || 'Unknown',
              examId,
              examTitle: eData?.title || 'Exam',
              adminEmail: targetAdminEmail,
              reason: `Violation threshold reached: ${type}`,
              violationCount: newViolationCount,
              ipAddress: req.ip,
              violations: vLogs || [],
              timestamp: new Date(),
            });
          }
        } catch (e) {
          console.error('[ViolationTermination] Admin email alert enqueue failed:', e);
        }
      })();

      // Clear session cookie
      res.clearCookie('session_token', { path: '/' });
      res.json({
        success: true,
        terminated: true,
        reason: `Your session has been terminated due to repeated violations (${type}).`,
        violation_count: newViolationCount,
      });
    } else {
      res.json({
        success: true,
        warning: true,
        message: `Warning: ${getViolationMessage(type)}. This is violation ${newViolationCount} of ${VIOLATION_THRESHOLD}.`,
        violation_count: newViolationCount,
        threshold: VIOLATION_THRESHOLD,
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
}

function getViolationMessage(type: string): string {
  const messages: Record<string, string> = {
    tab_switch: 'Tab switching detected',
    window_blur: 'Window focus lost',
    fullscreen_exit: 'Fullscreen mode exited',
    devtools: 'Developer tools detected',
    copy_paste: 'Copy/paste attempt detected',
  };
  return messages[type] || 'Suspicious activity detected';
}
