import cron from 'node-cron';
import { autoSubmitExpiredSessions } from '../services/autoSubmitService';

/**
 * Cron job: every 30 seconds, auto-submit any sessions where now() > end_time.
 * This is the server-side safety net for when clients disconnect mid-exam.
 */
export function startSessionCron(): void {
  cron.schedule('*/30 * * * * *', async () => {
    try {
      await autoSubmitExpiredSessions();
    } catch (err) {
      console.error('[SessionCron] Unhandled error:', err);
    }
  });

  console.log('[SessionCron] Auto-submit cron started (every 30 seconds)');
}
