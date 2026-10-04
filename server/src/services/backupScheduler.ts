import cron from 'node-cron';
import { executeGoogleDriveBackup } from './driveBackupService';

let scheduledTask: any = null;

/**
 * Initializes the nightly scheduled backup job.
 * Default runs every night at 02:00 AM server time (configurable via BACKUP_CRON_SCHEDULE).
 */
export function startBackupScheduler(): void {
  if (scheduledTask) {
    return; // Already started
  }

  const cronExpression = process.env.BACKUP_CRON_SCHEDULE || '0 2 * * *';

  if (!cron.validate(cronExpression)) {
    console.error(`[BackupScheduler] Invalid cron expression: "${cronExpression}". Falling back to "0 2 * * *".`);
  }

  const validExpr = cron.validate(cronExpression) ? cronExpression : '0 2 * * *';

  scheduledTask = cron.schedule(validExpr, async () => {
    console.log(`[BackupScheduler] ⏰ Nightly backup job triggered automatically (${validExpr})...`);
    try {
      const result = await executeGoogleDriveBackup({ trigger: 'scheduled' });
      console.log(`[BackupScheduler] ✅ Nightly backup completed: ID=${result.id}, Files=${result.file_count}, DriveStatus=${result.drive_status}`);
    } catch (err: any) {
      console.error('[BackupScheduler] ❌ Nightly backup failed:', err?.message || err);
    }
  });

  console.log(`[BackupScheduler] 🚀 Nightly backup cron initialized with schedule: "${validExpr}"`);
}

export function stopBackupScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}
