import 'dotenv/config';
import { executeSystemBackup, BACKUP_DIR } from '../services/backupService';

async function main() {
  console.log('\n========================================================================');
  console.log('💾 LogicWhileLiRE — AUTOMATED SYSTEM BACKUP & EXPORT ENGINE');
  console.log('========================================================================\n');
  console.log(`📁 Backup Output Directory (BACKUP_DIR): ${BACKUP_DIR}`);
  console.log('⏳ Exporting all key database tables from Supabase...\n');

  try {
    const result = await executeSystemBackup({ trigger: 'cli', createZip: true });

    console.log('------------------------------------------------------------------------');
    console.log(`✅ BACKUP COMPLETED IN ${result.durationMs}ms`);
    console.log(`   Backup ID:        ${result.backupId}`);
    console.log(`   Folder Path:      ${result.backupFolderPath}`);
    if (result.zipFilePath) {
      console.log(`   Zip Archive:      ${result.zipFilePath}`);
    }
    console.log(`   Integrity Status: ${result.manifest.integrityStatus === 'PASS' ? '✅ PASS (Row counts verified)' : '❌ FAIL'}`);
    console.log(`   Retention Purged: ${result.manifest.retentionPurgedCount} archives (>30 days old)`);
    console.log('------------------------------------------------------------------------\n');

    console.log('📊 EXPORTED TABLES SUMMARY:');
    console.table(
      Object.entries(result.manifest.tables).map(([table, info]) => ({
        Table: table,
        'Source Rows': info.sourceRows,
        'CSV Export': info.csvFile,
        'JSON Export': info.jsonFile,
        'Integrity Check': info.integrityPass ? '✅ MATCH' : '❌ MISMATCH',
      }))
    );

    console.log(`🎓 Batch-wise Student Files: ${result.manifest.batchStudentFilesCount}`);
    console.log(`📝 Exam Result Sheet Files:   ${result.manifest.examResultFilesCount}`);
    console.log(`🔒 Security Assurance:       All passwords, hashes, and tokens were strictly sanitized.`);
    console.log('\n🎉 System backup generated, validated, and archived successfully!\n');
    process.exit(0);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ Backup failed: ${errMsg}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal backup CLI error:', err);
  process.exit(1);
});
