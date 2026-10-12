import { supabase } from '../db/supabase';
import { autoSubmitSession } from './sessionService';

/**
 * Find all in-progress sessions (standard exam_sessions and exam_code_attempts)
 * that have exceeded their end_time and auto-submit them.
 * Called by the cron job every 30 seconds (Phase D6 Spec).
 */
export async function autoSubmitExpiredSessions(): Promise<void> {
  const now = new Date().toISOString();

  // 1. Auto-submit expired exam_sessions (Participant / OTP flow)
  const { data: expiredSessions, error } = await supabase
    .from('exam_sessions')
    .select('id')
    .eq('status', 'in_progress')
    .lt('end_time', now);

  if (error) {
    console.error('[AutoSubmit Cron] Failed to query expired sessions:', error.message);
  } else if (expiredSessions && expiredSessions.length > 0) {
    console.log(`[AutoSubmit Cron] Found ${expiredSessions.length} expired session(s). Auto-submitting...`);
    await Promise.allSettled(
      expiredSessions.map((session) =>
        autoSubmitSession(session.id, 'timer_expired_cron').catch((err) =>
          console.error(`[AutoSubmit Cron] Failed for session ${session.id}:`, err)
        )
      )
    );
  }

  // 2. Auto-submit expired exam_code_attempts (Exam Code flow)
  await autoSubmitExpiredExamCodeAttempts(now);
}

export async function autoSubmitExpiredExamCodeAttempts(now: string = new Date().toISOString()): Promise<void> {
  const { data: expiredAttempts, error } = await supabase
    .from('exam_code_attempts')
    .select('id, exam_code, partial_answers, created_at, violation_count')
    .eq('status', 'in_progress')
    .lt('end_time', now);

  if (error || !expiredAttempts || expiredAttempts.length === 0) return;

  console.log(`[AutoSubmit Cron] Found ${expiredAttempts.length} expired exam_code_attempt(s). Auto-submitting...`);

  for (const attempt of expiredAttempts) {
    try {
      const { data: questions } = await supabase
        .from('questions_ec')
        .select('id, correct_answer, marks, topic')
        .eq('exam_code', String(attempt.exam_code).toUpperCase());

      let totalScore = 0;
      let maxScore = 0;
      let correctCount = 0;
      let wrongCount = 0;
      const topicBreakdown: Record<string, { correct: number; wrong: number; score: number; maxScore: number }> = {};
      const answers = (attempt.partial_answers as Record<string, any>) || {};

      for (const q of (questions || [])) {
        const qMarks = Number(q.marks || 1);
        maxScore += qMarks;
        const topic = q.topic || 'General';
        if (!topicBreakdown[topic]) {
          topicBreakdown[topic] = { correct: 0, wrong: 0, score: 0, maxScore: 0 };
        }
        topicBreakdown[topic].maxScore += qMarks;

        const studentAnswer = answers[q.id];
        if (studentAnswer !== undefined && studentAnswer !== null) {
          const expected = String(q.correct_answer || 'A').trim().toUpperCase();
          const actual = String(studentAnswer).trim().toUpperCase();
          const matches =
            actual === expected ||
            (actual === '0' && expected === 'A') ||
            (actual === '1' && expected === 'B') ||
            (actual === '2' && expected === 'C') ||
            (actual === '3' && expected === 'D');

          if (matches) {
            totalScore += qMarks;
            correctCount++;
            topicBreakdown[topic].correct++;
            topicBreakdown[topic].score += qMarks;
          } else {
            wrongCount++;
            topicBreakdown[topic].wrong++;
          }
        }
      }

      await supabase
        .from('exam_code_attempts')
        .update({
          status: 'completed',
          end_time: now,
          score: totalScore,
          max_score: maxScore,
          correct_count: correctCount,
          wrong_count: wrongCount,
          answers,
          topic_breakdown: topicBreakdown,
        })
        .eq('id', attempt.id);
    } catch (e) {
      console.error(`[AutoSubmit Cron] Failed for exam_code_attempt ${attempt.id}:`, e);
    }
  }
}
