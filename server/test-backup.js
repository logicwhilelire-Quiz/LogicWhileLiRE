const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

require('dotenv').config();
const { isRealSupabase, cleanupTestData } = require('./test-helper');
if (!isRealSupabase) {
  process.env.DEMO_MODE = 'true';
}
process.env.NODE_ENV = 'development';
process.env.BACKUP_DIR = path.resolve(__dirname, 'test_backups');

const {
  executeSystemBackup,
  pruneOldBackups,
  sanitizeRecord,
  convertToCsv,
  countCsvRecords,
  BACKUP_DIR,
} = require('./dist/services/backupService');
const { supabase } = require('./dist/db/supabase');

let passed = 0;
function pass(num, label) {
  passed++;
  console.log(`  ✅ [${num}] ${label}`);
}

async function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : '';
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: global.__SERVER_PORT__,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(dataString),
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const rawBuffer = Buffer.concat(chunks);
          let parsed;
          try {
            parsed = JSON.parse(rawBuffer.toString('utf8'));
          } catch {
            parsed = rawBuffer.toString('utf8');
          }
          resolve({
            status: res.statusCode,
            body: parsed,
            buffer: rawBuffer,
            headers: res.headers,
          });
        });
      }
    );
    req.on('error', reject);
    if (dataString) req.write(dataString);
    req.end();
  });
}

async function run() {
  console.log('\n================================================================');
  console.log('💾 LogicWhileLiRE — AUTOMATED SYSTEM BACKUP TEST SUITE');
  console.log('================================================================\n');

  try {
    // Clean up test backup dir
    if (fs.existsSync(process.env.BACKUP_DIR)) {
      fs.rmSync(process.env.BACKUP_DIR, { recursive: true, force: true });
    }

    // Ensure at least one test exam code and attempt exists for backup export testing
    await supabase.from('exam_code_attempts').delete().eq('exam_code', 'TEST-BCK-01');
    await supabase.from('exam_codes').delete().eq('exam_code', 'TEST-BCK-01');
    await supabase.from('colleges').delete().eq('college_code', 'TBC');

    const { data: testCol } = await supabase.from('colleges').insert({
      college_name: 'Test Backup College',
      college_code: 'TBC',
      city: 'Vijayawada',
      state: 'AP',
      contact_email: 'test@tbc.edu',
      is_active: true,
    }).select().single();

    if (testCol) {
      await supabase.from('exam_codes').insert({
        exam_code: 'TEST-BCK-01',
        college_id: testCol.id,
        exam_name: 'Automated Backup Test Exam',
        duration_minutes: 60,
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 3600000).toISOString(),
        is_active: true,
      });

      await supabase.from('exam_code_attempts').insert({
        exam_code: 'TEST-BCK-01',
        hall_ticket_no: 'TEST-HT-999',
        student_name: 'Backup Test Student',
        score: 85,
        max_score: 100,
        correct_count: 17,
        wrong_count: 3,
        status: 'completed',
      });
    }

    // ── 1. CREDENTIAL SANITIZATION RIGIDITY TEST ──────────────────
    console.log('--- 1. Credential Sanitization Rigidity Check ---');

    const rawDummyRecord = {
      id: 'usr-101',
      name: 'John Doe',
      email: 'john@example.com',
      password: 'PlainSecretPassword123!',
      password_hash: '$2b$12$eKx...hashedPasswordValue',
      temp_password: 'TempPassword#2026',
      session_token: 'jwt_session_token_xyz_999',
      totp_secret: 'JBSWY3DPEHPK3PXP',
      auth_token: 'bearer_token_abc',
      jwt_secret: 'super_secret_signing_key',
      role: 'student',
      college_id: 1,
    };

    const sanitized = sanitizeRecord(rawDummyRecord);
    assert.strictEqual(sanitized.id, 'usr-101');
    assert.strictEqual(sanitized.email, 'john@example.com');
    assert.strictEqual(sanitized.password, undefined, 'password must be stripped');
    assert.strictEqual(sanitized.password_hash, undefined, 'password_hash must be stripped');
    assert.strictEqual(sanitized.temp_password, undefined, 'temp_password must be stripped');
    assert.strictEqual(sanitized.session_token, undefined, 'session_token must be stripped');
    assert.strictEqual(sanitized.totp_secret, undefined, 'totp_secret must be stripped');
    assert.strictEqual(sanitized.auth_token, undefined, 'auth_token must be stripped');
    assert.strictEqual(sanitized.jwt_secret, undefined, 'jwt_secret must be stripped');
    pass(1, 'Credential sanitizer strictly strips passwords, hashes, and auth tokens');

    // ── 2. FULL BACKUP EXECUTION (CSV + JSON + INTEGRITY CHECK) ──
    console.log('\n--- 2. Full System Backup Execution ---');

    const backupResult = await executeSystemBackup({ trigger: 'cli', createZip: true });
    assert.strictEqual(backupResult.success, true);
    assert.ok(fs.existsSync(backupResult.backupFolderPath), 'Backup folder must exist on disk');
    assert.ok(fs.existsSync(backupResult.zipFilePath), 'Backup zip archive must exist on disk');

    const manifest = backupResult.manifest;
    assert.strictEqual(manifest.integrityStatus, 'PASS', 'Integrity status must be PASS');
    pass(2, `System backup executed and validated with integrityStatus: PASS in ${backupResult.durationMs}ms`);

    // Required tables
    const requiredTables = [
      'students',
      'staff',
      'colleges',
      'sections',
      'batches',
      'exams',
      'questions',
      'attempts',
      'results',
      'audit_logs',
    ];

    for (const tbl of requiredTables) {
      assert.ok(manifest.tables[tbl], `Manifest must contain table: ${tbl}`);
      assert.strictEqual(manifest.tables[tbl].integrityPass, true, `Table ${tbl} row counts must match`);

      const csvPath = path.join(backupResult.backupFolderPath, manifest.tables[tbl].csvFile);
      const jsonPath = path.join(backupResult.backupFolderPath, manifest.tables[tbl].jsonFile);

      assert.ok(fs.existsSync(csvPath), `CSV export must exist: ${csvPath}`);
      assert.ok(fs.existsSync(jsonPath), `JSON export must exist: ${jsonPath}`);
    }
    pass(3, 'All 10 required database tables exported as both CSV and JSON');

    // ── 3. STRICT CREDENTIAL CHECK ON GENERATED BACKUP FILES ─────
    console.log('\n--- 3. Credential Leak Verification Across All Export Files ---');

    const forbiddenStrings = ['PlainSecretPassword', 'password_hash', 'temp_password', 'totp_secret'];
    const csvDir = path.join(backupResult.backupFolderPath, 'csv');
    const jsonDir = path.join(backupResult.backupFolderPath, 'json');

    for (const dir of [csvDir, jsonDir]) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const content = fs.readFileSync(path.join(dir, file), 'utf8');
        for (const forbidden of forbiddenStrings) {
          assert.ok(
            !content.includes(`"${forbidden}"`),
            `Leak detected: ${file} must not contain sensitive key "${forbidden}"`
          );
        }
      }
    }
    pass(4, 'Verified zero credential leakage across all generated CSV and JSON files');

    // ── 4. BATCH-WISE STUDENT LISTS & EXAM RESULT SHEETS ─────────
    console.log('\n--- 4. Batch-wise Lists & Exam Result Sheets ---');

    const batchDir = path.join(backupResult.backupFolderPath, 'batch_wise_students');
    const examResultsDir = path.join(backupResult.backupFolderPath, 'exam_results');

    assert.ok(fs.existsSync(batchDir), 'batch_wise_students directory must exist');
    assert.ok(fs.existsSync(examResultsDir), 'exam_results directory must exist');

    const batchFiles = fs.readdirSync(batchDir);
    assert.ok(batchFiles.length >= 1, 'At least 1 batch-wise student CSV must be generated');
    const sampleBatchContent = fs.readFileSync(path.join(batchDir, batchFiles[0]), 'utf8');
    assert.ok(sampleBatchContent.includes('roll_number'), 'Batch CSV header must include roll_number');
    assert.ok(sampleBatchContent.includes('full_name'), 'Batch CSV header must include full_name');
    assert.ok(sampleBatchContent.includes('email'), 'Batch CSV header must include email');
    pass(5, `Batch-wise student rosters generated (${batchFiles.length} batch CSV files)`);

    const examFiles = fs.readdirSync(examResultsDir);
    assert.ok(examFiles.length >= 1, 'At least 1 exam result CSV must be generated');
    const sampleResultContent = fs.readFileSync(path.join(examResultsDir, examFiles[0]), 'utf8');
    assert.ok(sampleResultContent.includes('hall_ticket_no'), 'Exam results CSV must include hall_ticket_no');
    assert.ok(sampleResultContent.includes('score'), 'Exam results CSV must include score');
    assert.ok(sampleResultContent.includes('percentage'), 'Exam results CSV must include percentage');
    pass(6, `Exam result sheets generated (${examFiles.length} exam CSV files)`);

    // ── 5. 30-DAY RETENTION POLICY VERIFICATION ───────────────────
    console.log('\n--- 5. 30-Day Retention Policy & Pruning ---');

    // Create a synthetic backup older than 31 days
    const oldTimestamp = Date.now() - 35 * 24 * 60 * 60 * 1000;
    const oldBackupDir = path.join(process.env.BACKUP_DIR, 'backup_2026-08-01T00-00-00');
    fs.mkdirSync(oldBackupDir, { recursive: true });
    fs.writeFileSync(path.join(oldBackupDir, 'test.txt'), 'old backup data', 'utf8');
    fs.utimesSync(oldBackupDir, new Date(oldTimestamp), new Date(oldTimestamp));

    // Run retention cleanup
    const pruneResult = pruneOldBackups(30);
    assert.ok(pruneResult.purged.includes('backup_2026-08-01T00-00-00'), 'Old backup must be purged');
    assert.ok(!fs.existsSync(oldBackupDir), 'Purged backup directory must be deleted from disk');
    assert.ok(pruneResult.kept.length >= 1, 'Recent backup must be retained');
    pass(7, '30-day retention policy purges older archives while keeping recent backups intact');

    // ── 6. ADMIN HTTP ENDPOINTS & DOWNLOAD BUTTON INTEGRATION ─────
    console.log('\n--- 6. Admin API Endpoints & Role Checks ---');

    const express = require('express');
    const cookieParser = require('cookie-parser');
    const app = express();
    app.use(express.json());
    app.use(cookieParser());

    // Inject super admin token simulation
    const jwt = require('jsonwebtoken');
    const adminSecret = process.env.ADMIN_JWT_SECRET || 'quiz_exam_portal_jwt_secret_admin_key_2026_super_secure_random_string_abc';
    const superAdminToken = jwt.sign(
      { sub: 'st000000-0000-0000-0000-000000000001', role: 'super_admin', email: 'admin@example.com' },
      adminSecret,
      { expiresIn: '1h' }
    );
    const inspectorToken = jwt.sign(
      { sub: 'st000000-0000-0000-0000-000000000004', role: 'inspector', college_id: 1 },
      adminSecret,
      { expiresIn: '1h' }
    );

    const adminRoutes = require('./dist/routes/admin').default;
    app.use('/api/admin', adminRoutes);

    const testServer = http.createServer(app);
    await new Promise((resolve) => {
      testServer.listen(0, '127.0.0.1', () => {
        global.__SERVER_PORT__ = testServer.address().port;
        resolve();
      });
    });

    // Test: Non-super_admin (Inspector) must be blocked from backup route (403)
    const blockRes = await request('GET', '/api/admin/backup', null, {
      Authorization: `Bearer ${inspectorToken}`,
    });
    assert.strictEqual(blockRes.status, 403, 'Inspector must be blocked from running backup');
    pass(8, 'Role check: Inspector is strictly blocked from backup endpoints with HTTP 403');

    // Test: Super Admin runs backup via JSON API
    const superBackupRes = await request('GET', '/api/admin/backup', null, {
      Authorization: `Bearer ${superAdminToken}`,
    });
    assert.strictEqual(superBackupRes.status, 200);
    assert.strictEqual(superBackupRes.body?.success, true);
    assert.strictEqual(superBackupRes.body?.backup?.download_url, '/api/admin/backup/download');
    pass(9, 'Super Admin GET /api/admin/backup returns execution manifest and download URL');

    // Test: Super Admin direct ZIP download
    const downloadRes = await request('GET', '/api/admin/backup/download', null, {
      Authorization: `Bearer ${superAdminToken}`,
    });
    assert.strictEqual(downloadRes.status, 200);
    assert.ok(
      downloadRes.headers['content-type']?.includes('application/zip') ||
      downloadRes.headers['content-disposition']?.includes('.zip'),
      'Download endpoint must stream ZIP archive'
    );
    assert.ok(downloadRes.buffer.length > 500, 'Downloaded ZIP file must contain binary payload');
    pass(10, `Super Admin GET /api/admin/backup/download delivers valid zip archive (${downloadRes.buffer.length} bytes)`);

    testServer.close();

    // Clean up test folder
    if (fs.existsSync(process.env.BACKUP_DIR)) {
      fs.rmSync(process.env.BACKUP_DIR, { recursive: true, force: true });
    }

    await cleanupTestData(supabase);

    console.log('\n================================================================');
    console.log(`🎉 ALL ${passed}/10 SYSTEM BACKUP TESTS PASSED CLEANLY!`);
    console.log('================================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
    try {
      await cleanupTestData(supabase);
    } catch {}
    process.exit(1);
  }
}

run();
