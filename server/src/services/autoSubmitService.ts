import { supabase } from '../db/supabase';
import { autoSubmitSession } from './sessionService';

/**
 * Find all in-progress sessions that have exceeded their end_time
 * and auto-submit them. Called by the cron job every 30 seconds.
 */
export async function autoSubmitExpiredSessions(): Promise<void> {
  const now = new Date().toISOString();

  const { data: expiredSessions, error } = await supabase
    .from('exam_sessions')
    .select('id')
    .eq('status', 'in_progress')
    .lt('end_time', now);

  if (error) {
    console.error('[AutoSubmit Cron] Failed to query expired sessions:', error.message);
    return;
  }

  if (!expiredSessions || expiredSessions.length === 0) return;

  console.log(`[AutoSubmit Cron] Found ${expiredSessions.length} expired session(s). Auto-submitting...`);

  await Promise.allSettled(
    expiredSessions.map((session) =>
      autoSubmitSession(session.id, 'timer_expired_cron').catch((err) =>
        console.error(`[AutoSubmit Cron] Failed for session ${session.id}:`, err)
      )
    )
  );
}
