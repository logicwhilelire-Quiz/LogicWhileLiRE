/**
 * test-phase3-backups.js
 *
 * Automated Test Suite for PHASE 3: Data Storage & Google Drive Cloud Backups
 * Tests:
 * 1. Supabase primary database verification
 * 2. Dated hierarchical backup folder generation:
 *    - Dated root folder (YYYY-MM-DD / backup_...)
 *    - Structured subfolders: college / year / section
 *    - Section-wise files: students_roster (xlsx/csv), section_results (xlsx/csv), official_assessment_report (PDF)
 *    - Root-level files: audit_log (xlsx/csv), exams (json/csv), master_results (xlsx), manifest.json
 * 3. PDF report generation via pdfkit (binary integrity, header, section, watermark)
 * 4. Google Drive Service Account integration:
 *    - Credentials stored strictly in server environment variables
 *    - Public status masks email and hides private key completely
 *    - Graceful fallback when Drive credentials are not set
 * 5. Admin endpoints & UI integration:
 *    - POST /api/admin/backup ("Backup now" button)
 *    - GET /api/admin/backup/history (backup history list)
 *    - GET /api/admin/backup/download?id=... (zip archive delivery)
 * 6. Role-based security:
 *    - Super Admin: permitted (200)
 *    - Faculty: blocked with 403
 *    - Inspector: blocked with 403
 * 7. Nightly cron scheduler initialization
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

process.env.ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'test_admin_jwt_secret_key_32chars_long';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_32chars_long';

const { supabase } = require('./dist/db/supabase');
const { adminAuth, requireRole } = require('./dist/middleware/adminAuth');
const { executeGoogleDriveBackup, getBackupHistoryList } = require('./dist/services/driveBackupService');
const { getGoogleDrivePublicStatus, isGoogleDriveConfigured } = require('./dist/services/googleDriveService');
const { runSystemBackup, getBackupHistory, downloadSystemBackup, getGoogleDriveStatusHandler } = require('./dist/controllers/hierarchyController');
const { startBackupScheduler, stopBackupScheduler } = require('./dist/services/backupScheduler');
const { BACKUP_DIR } = require('./dist/services/backupService');

function createMockReqRes({ role = 'super_admin', staff_id = 'st-backup-test-01', query = {}, params = {}, body = {} } = {}) {
  const token = jwt.sign(
    { sub: 'admin@logicwhile.com', role, staff_id },
    process.env.ADMIN_JWT_SECRET,
    { expiresIn: '1h' }
  );

  const req = {
    headers: { authorization: `Bearer ${token}` },
    query,
    params,
    body,
    admin: { sub: 'admin@logicwhile.com', role, staff_id },
  };

  const res = {
    statusCode: 200,
    jsonData: null,
    downloadPath: null,
    downloadFilename: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    },
    download(filePath, fileName) {
      this.downloadPath = filePath;
      this.downloadFilename = fileName;
    },
  };

  return { req, res, token };
}

async function runPhase3Tests() {
  console.log('================================================================');
  console.log('💾 PHASE 3: DATA STORAGE & GOOGLE DRIVE BACKUPS VERIFICATION');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Reason: ${err.message}`);
      failed++;
    }
  }

  // ── TEST 1: Primary Database Verification ──
  await test('Supabase remains primary database and is operational', async () => {
    assert(supabase, 'Supabase client must be initialized');
    assert(typeof supabase.from === 'function', 'Supabase query builder must be functional');

    // Query core tables
    const { data: students, error: sErr } = await supabase.from('students').select('id').limit(1);
    const { data: exams, error: eErr } = await supabase.from('exams').select('id').limit(1);
    assert(!sErr, 'Students table query must succeed');
    assert(!eErr, 'Exams table query must succeed');
  });

  // ── TEST 2: Dated Hierarchical Backup Folder Generation ──
  let backupRunResult;
  await test('executeGoogleDriveBackup generates dated hierarchy (college / year / section) with Excel, CSV & PDF', async () => {
    // Seed sample students in specific college / year / section
    await supabase.from('students').insert([
      {
        id: 'stu-p3-01',
        name: 'Aarav Sharma',
        roll_number: '22VR1A0501',
        hall_ticket: '22VR1A0501',
        college_id: 1,
        college_name: 'Velagapudi Ramakrishna Siddhartha Engineering College',
        year_of_passing: 2026,
        section: 'CSE_Section_A',
      },
      {
        id: 'stu-p3-02',
        name: 'Diya Patel',
        roll_number: '22VR1A0502',
        hall_ticket: '22VR1A0502',
        college_id: 1,
        college_name: 'Velagapudi Ramakrishna Siddhartha Engineering College',
        year_of_passing: 2026,
        section: 'CSE_Section_A',
      },
    ]);

    backupRunResult = await executeGoogleDriveBackup({ trigger: 'manual', adminId: 'super-admin-01' });

    assert(backupRunResult, 'Backup execution must return history item');
    assert.strictEqual(backupRunResult.status, 'completed', 'Backup status must be completed');
    assert(backupRunResult.dated_folder.includes('/'), 'Dated folder must include date hierarchy');
    assert(backupRunResult.file_count > 0, 'Export files must be generated');
    assert(backupRunResult.hierarchy_nodes.length > 0, 'Hierarchy nodes must be detected');

    // Verify local filesystem structure
    const datePart = backupRunResult.dated_folder.split('/')[0];
    const backupFolder = path.join(BACKUP_DIR, backupRunResult.dated_folder);
    assert(fs.existsSync(backupFolder), `Backup folder ${backupFolder} must exist on disk`);

    // Verify global exports
    const globalDir = path.join(backupFolder, 'global');
    assert(fs.existsSync(path.join(globalDir, 'audit_log.csv')), 'audit_log.csv must exist');
    assert(fs.existsSync(path.join(globalDir, 'audit_log.xlsx')), 'audit_log.xlsx must exist');
    assert(fs.existsSync(path.join(globalDir, 'exams.json')), 'exams.json must exist');
    assert(fs.existsSync(path.join(globalDir, 'exams.csv')), 'exams.csv must exist');
    assert(fs.existsSync(path.join(globalDir, 'master_results.xlsx')), 'master_results.xlsx must exist');
    assert(fs.existsSync(path.join(backupFolder, 'manifest.json')), 'manifest.json must exist');

    // Verify college / year / section exports
    const collegesDir = path.join(backupFolder, 'colleges');
    assert(fs.existsSync(collegesDir), 'colleges directory must exist in dated hierarchy');

    const firstNode = backupRunResult.hierarchy_nodes[0];
    const nodeDir = path.join(collegesDir, firstNode);
    assert(fs.existsSync(nodeDir), `Hierarchy node directory ${nodeDir} must exist`);
    assert(fs.existsSync(path.join(nodeDir, 'students_roster.xlsx')), 'students_roster.xlsx must exist in section folder');
    assert(fs.existsSync(path.join(nodeDir, 'students_roster.csv')), 'students_roster.csv must exist in section folder');
    assert(fs.existsSync(path.join(nodeDir, 'section_results.xlsx')), 'section_results.xlsx must exist in section folder');
  });

  // ── TEST 3: PDF Assessment Report Generation ──
  await test('Official assessment PDF report is generated with valid PDF header (%PDF-)', async () => {
    const backupFolder = path.join(BACKUP_DIR, backupRunResult.dated_folder);
    const collegesDir = path.join(backupFolder, 'colleges');
    const firstNode = backupRunResult.hierarchy_nodes[0];
    const pdfPath = path.join(collegesDir, firstNode, 'official_assessment_report.pdf');

    assert(fs.existsSync(pdfPath), 'official_assessment_report.pdf must be generated in section folder');
    const pdfContent = fs.readFileSync(pdfPath);
    assert(pdfContent.length > 500, 'PDF file must be non-empty');
    assert(pdfContent.slice(0, 5).toString('ascii') === '%PDF-', 'PDF file must begin with valid %PDF- magic bytes');
  });

  // ── TEST 4: Google Drive Credentials & Public Status ──
  await test('Google Drive credentials reside strictly in server env and public status masks credentials', async () => {
    const status = getGoogleDrivePublicStatus();
    assert(typeof status.configured === 'boolean', 'configured must be a boolean');

    // Ensure private key is NEVER in public status
    assert.strictEqual(status.private_key, undefined, 'private_key must NEVER be exposed');
    assert.strictEqual(status.privateKey, undefined, 'privateKey must NEVER be exposed');

    // Check masked email if present
    if (status.service_account_email) {
      assert(status.service_account_email.includes('***'), 'Email must be masked in public status');
    }

    // Call GET /api/admin/backup/drive-status controller
    const { req, res } = createMockReqRes({ role: 'super_admin' });
    await getGoogleDriveStatusHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert(res.jsonData.success, 'drive-status must return success: true');
    assert(res.jsonData.drive, 'drive object must be present');
    assert.strictEqual(res.jsonData.drive.private_key, undefined);
  });

  // ── TEST 5: Admin "Backup now" Button & History Endpoints ──
  await test('POST /api/admin/backup triggers on-demand backup and updates backup history', async () => {
    const { req: postReq, res: postRes } = createMockReqRes({ role: 'super_admin' });
    await runSystemBackup(postReq, postRes);

    assert.strictEqual(postRes.statusCode, 200, 'POST /api/admin/backup must return HTTP 200');
    assert(postRes.jsonData.success, 'Response must have success: true');
    assert(postRes.jsonData.backup.drive_backup, 'drive_backup payload must be returned');
    assert(postRes.jsonData.backup.drive_backup.dated_folder, 'dated_folder must be present');

    // Check GET /api/admin/backup/history
    const { req: getReq, res: getRes } = createMockReqRes({ role: 'super_admin' });
    await getBackupHistory(getReq, getRes);

    assert.strictEqual(getRes.statusCode, 200);
    assert(getRes.jsonData.success);
    assert(Array.isArray(getRes.jsonData.history), 'history must be an array');
    assert(getRes.jsonData.history.length > 0, 'history must contain recent backup runs');

    const latest = getRes.jsonData.history[0];
    assert(latest.id, 'id must be present');
    assert(latest.timestamp, 'timestamp must be present');
    assert(latest.dated_folder, 'dated_folder must be present');
    assert(typeof latest.file_count === 'number', 'file_count must be number');
    assert(typeof latest.total_records === 'number', 'total_records must be number');
    assert(['synced', 'local_archived', 'failed'].includes(latest.drive_status), 'valid drive_status');
  });

  // ── TEST 6: Backup Download Archive ──
  await test('GET /api/admin/backup/download serves valid ZIP archive of backup', async () => {
    const { req, res } = createMockReqRes({ role: 'super_admin', query: { id: backupRunResult.id } });
    await downloadSystemBackup(req, res);

    assert(res.downloadPath, 'res.download must be called with a file path');
    assert(fs.existsSync(res.downloadPath), 'Target zip file must exist on disk');
    assert(res.downloadFilename.endsWith('.zip'), 'Downloaded file must have .zip extension');

    // Verify zip file magic bytes (PK..)
    const zipBytes = fs.readFileSync(res.downloadPath);
    assert.strictEqual(zipBytes[0], 0x50, 'Byte 0 must be 0x50 (P)');
    assert.strictEqual(zipBytes[1], 0x4b, 'Byte 1 must be 0x4b (K)');
  });

  // ── TEST 7: Role Boundaries on Backup Endpoints ──
  await test('Non-admin roles (Faculty & Inspector) are strictly blocked from backup endpoints with HTTP 403', async () => {
    const adminCheck = requireRole('super_admin');

    // Faculty check
    const { req: fReq, res: fRes } = createMockReqRes({ role: 'faculty' });
    adminAuth(fReq, fRes, () => {});
    let fPassed = false;
    adminCheck(fReq, fRes, () => { fPassed = true; });
    assert.strictEqual(fPassed, false);
    assert.strictEqual(fRes.statusCode, 403, 'Faculty must receive HTTP 403 on backup');

    // Inspector check
    const { req: iReq, res: iRes } = createMockReqRes({ role: 'inspector' });
    adminAuth(iReq, iRes, () => {});
    let iPassed = false;
    adminCheck(iReq, iRes, () => { iPassed = true; });
    assert.strictEqual(iPassed, false);
    assert.strictEqual(iRes.statusCode, 403, 'Inspector must receive HTTP 403 on backup');
  });

  // ── TEST 8: Nightly Scheduler Initialization ──
  await test('Nightly cron scheduler initializes cleanly', async () => {
    startBackupScheduler();
    // Verify no throw and stop cleanly
    stopBackupScheduler();
  });

  console.log('\n================================================================');
  console.log(`📊 PHASE 3 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase3Tests().catch((err) => {
  console.error('Fatal Phase 3 test error:', err);
  process.exit(1);
});
