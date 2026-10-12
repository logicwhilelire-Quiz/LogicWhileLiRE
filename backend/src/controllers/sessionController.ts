import { Request, Response } from 'express';
import {
  startSession,
  getTimeRemaining,
  getSessionQuestions,
  saveAnswer,
  submitSession,
} from '../services/sessionService';

/**
 * POST /api/session/start
 * Start a session. Sets end_time server-side. Must be called once before questions are served.
 */
export async function startSessionHandler(req: Request, res: Response): Promise<void> {
  const { sessionId, participantId, examId } = req.participant!;

  try {
    // Check current status
    const { supabase } = await import('../db/supabase');
    const { data: session } = await supabase
      .from('exam_sessions')
      .select('status')
      .eq('id', sessionId)
      .single();

    if (session?.status === 'in_progress') {
      const timeInfo = await getTimeRemaining(sessionId);
      res.json({ success: true, message: 'Session already started', ...timeInfo });
      return;
    }

    if (session?.status === 'submitted') {
      res.status(400).json({ success: false, error: 'Exam already submitted' });
      return;
    }

    if (session?.status === 'terminated') {
      res.status(403).json({ success: false, error: 'Session terminated', code: 'SESSION_TERMINATED' });
      return;
    }

    const fingerprint = req.body?.fingerprint as string | undefined;
    const { endTime, questionCount, questionSet, setNumber } = await startSession(
      sessionId,
      participantId,
      examId,
      fingerprint
    );

    res.json({
      success: true,
      session_id: sessionId,
      end_time: endTime.toISOString(),
      question_count: questionCount,
      question_set: questionSet,
      set_number: setNumber,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
}

/**
 * GET /api/session/:sessionId/time-remaining
 * Returns server-authoritative remaining time. Client uses this to resync.
 */
export async function getTimeRemainingHandler(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.participant!;

  try {
    const result = await getTimeRemaining(sessionId);
    res.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
}

/**
 * GET /api/session/:sessionId/questions?page=1
 * Paginated question delivery. correct_option is NEVER included.
 */
export async function getQuestionsHandler(req: Request, res: Response): Promise<void> {
  const { sessionId, participantId } = req.participant!;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = 10;

  try {
    const result = await getSessionQuestions(sessionId, participantId, page, pageSize);
    res.json({ success: true, page, page_size: pageSize, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message === 'Session has not started yet' ? 400 : 500;
    res.status(status).json({ success: false, error: message });
  }
}

/**
 * POST /api/session/:sessionId/answer
 * Auto-save a single answer. Validates session is active server-side.
 */
export async function saveAnswerHandler(req: Request, res: Response): Promise<void> {
  const { sessionId, participantId } = req.participant!;
  const { question_id, chosen_option, answer_latency_ms } = req.body;

  try {
    await saveAnswer(sessionId, participantId, question_id, chosen_option, answer_latency_ms);
    res.json({ success: true, saved: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const code = (err as { code?: string }).code;
    if (code === 'SESSION_TERMINATED') {
      res.status(403).json({ success: false, error: message, code });
    } else if (code === 'TIME_EXPIRED' || code === 'ALREADY_SUBMITTED') {
      res.status(400).json({ success: false, error: message, code });
    } else {
      res.status(500).json({ success: false, error: message });
    }
  }
}

/**
 * POST /api/session/:sessionId/submit
 * Manual submission by participant. Triggers server-side grading.
 */
export async function submitSessionHandler(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.participant!;

  try {
    await submitSession(sessionId);
    // Clear session cookie on submission
    res.clearCookie('session_token', { path: '/' });
    res.json({ success: true, message: 'Exam submitted. Thank you!' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const code = (err as { code?: string }).code;
    if (code === 'SESSION_TERMINATED') {
      res.status(403).json({ success: false, error: message, code });
    } else {
      res.status(500).json({ success: false, error: message });
    }
  }
}
