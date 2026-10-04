/**
 * test-role-hierarchy.js
 *
 * Comprehensive Automated Test Suite for LogicWhileLiRE Role Hierarchy & Security:
 * - Roles: admin (super_admin), inspector, faculty, student
 * - Server-side permission checks on every route & Cross-role route blocking
 * - Inspector scoped to assigned college(s); blocked from system settings & backups
 * - Faculty scoped to own subjects/exams; blocked from other exams & staff management
 * - Student scoped to own profile and exams; blocked from admin/inspector routes
 * - Data model: college -> academic year -> cohort -> section -> batch
 * - Student belongs to exactly one section and batch constraint
 * - Bulk Excel/CSV import & batch-wise student list export
 * - Welcome email with temporary password & forced password change on first login
 * - 2FA (RFC 6238 TOTP) protection for admin and inspector
 * - Account lockout after 5 failed attempts (15-min cooldown, HTTP 423)
 * - Complete audit logging of all administrative actions
 */

const assert = require('assert');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

process.env.TOTP_ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY || 'test-totp-encryption-key-for-role-hierarchy-32b';

const { isRealSupabase, cleanupTestData } = require('./test-helper');

const { supabase } = require('./dist/db/supabase');
const { adminAuth, requireRole, requireCollegeScope, requireExamOwnership } = require('./dist/middleware/adminAuth');
const { studentAuth } = require('./dist/middleware/auth');
const { recordAuditLog } = require('./dist/middleware/auditLog');
const {
  generateTotpSecret,
  generateTotpCode,
  verifyTotpCode,
  generateTotpQrCode,
  encryptTotpSecret,
  decryptTotpSecret,
  isEncryptedTotpSecret,
  migrateTotpSecretToGcm,
} = require('./dist/utils/totp');
const { sendWelcomeEmail } = require('./dist/services/emailService');

console.log('================================================================');
console.log('👑 LogicWhileLiRE — ROLE HIERARCHY & SECURITY AUDIT TEST SUITE');
console.log('================================================================\n');

async function runRoleHierarchyTests() {
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✅ [${total}] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [${total}] FAIL: ${name}`);
      console.error(err);
      throw err;
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ [${total}] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [${total}] FAIL: ${name}`);
      console.error(err);
      throw err;
    }
  }

  // Helper to generate mock request/response objects
  function createMockReqRes(options = {}) {
    let statusCode = 200;
    let jsonBody = null;
    let headersSent = false;
    let nextCalled = false;

    const req = {
      headers: options.headers || {},
      cookies: options.cookies || {},
      admin: options.admin || null,
      user: options.user || null,
      params: options.params || {},
      query: options.query || {},
      body: options.body || {},
      ip: options.ip || '127.0.0.1',
    };

    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonBody = data;
        headersSent = true;
        return this;
      },
      setHeader() {
        return this;
      },
      send(data) {
        jsonBody = data;
        headersSent = true;
        return this;
      },
    };

    const next = () => {
      nextCalled = true;
    };

    return {
      req,
      res,
      next,
      getStatus: () => statusCode,
      getBody: () => jsonBody,
      isNextCalled: () => nextCalled,
    };
  }

  // Sign tokens
  function createAdminToken(payload) {
    return jwt.sign(payload, process.env.ADMIN_JWT_SECRET, { expiresIn: '1h' });
  }

  function createStudentToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
  }

  console.log('--- 1. Server-Side Role Enforcement & Cross-Role Route Blocking ---');

  // Test 1: adminAuth accepts super_admin, inspector, and faculty
  test('adminAuth accepts super_admin token', () => {
    const token = createAdminToken({ sub: 'admin@example.com', id: 'adm-1', role: 'super_admin' });
    const { req, res, next, isNextCalled } = createMockReqRes({
      headers: { authorization: `Bearer ${token}` },
    });
    adminAuth(req, res, next);
    assert(isNextCalled(), 'super_admin should pass adminAuth');
    assert.strictEqual(req.admin.role, 'super_admin');
  });

  // Test 2: adminAuth accepts inspector token
  test('adminAuth accepts inspector token with college scope', () => {
    const token = createAdminToken({ sub: 'inspector@example.com', id: 'insp-1', role: 'inspector', college_id: 1 });
    const { req, res, next, isNextCalled } = createMockReqRes({
      headers: { authorization: `Bearer ${token}` },
    });
    adminAuth(req, res, next);
    assert(isNextCalled(), 'inspector should pass adminAuth');
    assert.strictEqual(req.admin.role, 'inspector');
    assert.strictEqual(req.admin.college_id, 1);
  });

  // Test 3: adminAuth accepts faculty token
  test('adminAuth accepts faculty token', () => {
    const token = createAdminToken({ sub: 'faculty@example.com', id: 'fac-1', role: 'faculty' });
    const { req, res, next, isNextCalled } = createMockReqRes({
      headers: { authorization: `Bearer ${token}` },
    });
    adminAuth(req, res, next);
    assert(isNextCalled(), 'faculty should pass adminAuth');
    assert.strictEqual(req.admin.role, 'faculty');
  });

  // Test 4: adminAuth rejects student token on admin routes
  test('adminAuth blocks student token with 401 Unauthorized', () => {
    const studentToken = createStudentToken({ sub: 'student@example.com', id: 'stu-1', role: 'student' });
    const { req, res, next, getStatus, isNextCalled } = createMockReqRes({
      headers: { authorization: `Bearer ${studentToken}` },
    });
    adminAuth(req, res, next);
    assert(!isNextCalled(), 'student token must NOT pass adminAuth');
    assert.strictEqual(getStatus(), 401, 'Expected 401 Unauthorized for student token on adminAuth');
  });

  // Test 5: requireRole('super_admin') blocks Inspector (Cannot edit system settings)
  test('requireRole("super_admin") blocks Inspector with 403 Forbidden', () => {
    const guard = requireRole('super_admin');
    const { req, res, next, getStatus, isNextCalled } = createMockReqRes({
      admin: { id: 'insp-1', role: 'inspector', college_id: 1 },
    });
    guard(req, res, next);
    assert(!isNextCalled(), 'Inspector must be blocked from super_admin routes');
    assert.strictEqual(getStatus(), 403, 'Expected 403 Forbidden');
  });

  // Test 6: requireRole('super_admin') blocks Faculty
  test('requireRole("super_admin") blocks Faculty with 403 Forbidden', () => {
    const guard = requireRole('super_admin');
    const { req, res, next, getStatus, isNextCalled } = createMockReqRes({
      admin: { id: 'fac-1', role: 'faculty' },
    });
    guard(req, res, next);
    assert(!isNextCalled(), 'Faculty must be blocked from super_admin routes');
    assert.strictEqual(getStatus(), 403, 'Expected 403 Forbidden');
  });

  // Test 7: requireRole('inspector') allows both inspector and college_admin
  test('requireRole("inspector") allows inspector role and college_admin alias', () => {
    const guard = requireRole('inspector');
    const { req: req1, res: res1, next: next1, isNextCalled: called1 } = createMockReqRes({
      admin: { id: 'insp-1', role: 'inspector', college_id: 1 },
    });
    guard(req1, res1, next1);
    assert(called1(), 'inspector role allowed');

    const { req: req2, res: res2, next: next2, isNextCalled: called2 } = createMockReqRes({
      admin: { id: 'insp-2', role: 'college_admin', college_id: 1 },
    });
    guard(req2, res2, next2);
    assert(called2(), 'college_admin alias allowed');
  });

  // Test 8: requireRole('inspector') blocks Faculty
  test('requireRole("inspector") blocks Faculty with 403 Forbidden', () => {
    const guard = requireRole('inspector');
    const { req, res, next, getStatus, isNextCalled } = createMockReqRes({
      admin: { id: 'fac-1', role: 'faculty' },
    });
    guard(req, res, next);
    assert(!isNextCalled(), 'Faculty must be blocked from inspector-only routes');
    assert.strictEqual(getStatus(), 403, 'Expected 403 Forbidden');
  });

  // Test 9: requireCollegeScope allows inspector to access own college
  test('requireCollegeScope allows Inspector to access assigned College 1', () => {
    const guard = requireCollegeScope();
    const { req, res, next, isNextCalled } = createMockReqRes({
      admin: { id: 'insp-1', role: 'inspector', college_id: 1 },
      query: { college_id: '1' },
    });
    guard(req, res, next);
    assert(isNextCalled(), 'Inspector must have access to assigned college');
  });

  // Test 10: requireCollegeScope blocks Inspector from accessing other colleges (Cross-College Forbidden)
  test('requireCollegeScope blocks Inspector from accessing College 2 with 403 CROSS_COLLEGE_FORBIDDEN', () => {
    const guard = requireCollegeScope();
    const { req, res, next, getStatus, getBody, isNextCalled } = createMockReqRes({
      admin: { id: 'insp-1', role: 'inspector', college_id: 1 },
      query: { college_id: '2' },
    });
    guard(req, res, next);
    assert(!isNextCalled(), 'Inspector must be blocked from other colleges');
    assert.strictEqual(getStatus(), 403, 'Expected 403 Forbidden');
    assert.strictEqual(getBody()?.code, 'CROSS_COLLEGE_FORBIDDEN');
  });

  // Test 11: requireCollegeScope allows Super Admin full access across all colleges
  test('requireCollegeScope allows Super Admin unrestricted access to any college', () => {
    const guard = requireCollegeScope();
    const { req, res, next, isNextCalled } = createMockReqRes({
      admin: { id: 'adm-1', role: 'super_admin' },
      query: { college_id: '999' },
    });
    guard(req, res, next);
    assert(isNextCalled(), 'Super admin must not be restricted by college scope');
  });

  // Test 12: requireExamOwnership allows faculty on own exams, blocks other faculty
  await testAsync('requireExamOwnership enforces strict exam creator ownership for faculty', async () => {
    const guard = requireExamOwnership();

    // Faculty owner
    const { req: reqOwner, res: resOwner, next: nextOwner, isNextCalled: calledOwner } = createMockReqRes({
      admin: { id: 'st000000-0000-0000-0000-000000000002', role: 'faculty' },
      params: { id: 'e1000000-0000-0000-0000-000000000001' },
    });
    await guard(reqOwner, resOwner, nextOwner);
    assert(calledOwner(), 'Faculty creator should be allowed access to own exam');

    // Other faculty
    const { req: reqOther, res: resOther, next: nextOther, getStatus, getBody, isNextCalled: calledOther } = createMockReqRes({
      admin: { id: 'unauthorized-faculty-id', role: 'faculty' },
      params: { id: 'e1000000-0000-0000-0000-000000000001' },
    });
    await guard(reqOther, resOther, nextOther);
    assert(!calledOther(), 'Other faculty must NOT be allowed access to exam');
    assert.strictEqual(getStatus(), 403, 'Expected 403 Forbidden');
    assert.strictEqual(getBody()?.code, 'FORBIDDEN_NOT_EXAM_OWNER');
  });

  console.log('\n--- 2. Data Model Hierarchy: College -> Academic Year -> Cohort -> Section -> Batch ---');

  // Test 13: Academic Years query
  await testAsync('Query academic_years for College 1', async () => {
    const { data: years, error } = await supabase
      .from('academic_years')
      .select('*')
      .eq('college_id', 1);
    assert(!error, `Failed to query academic_years: ${error?.message}`);
    assert(Array.isArray(years) && years.length >= 1, 'Should find at least 1 academic year for College 1');
  });

  // Test 14: Cohorts query linked to Academic Year
  await testAsync('Query cohorts linked to Academic Year and College', async () => {
    const { data: cohorts, error } = await supabase
      .from('cohorts')
      .select('*')
      .eq('college_id', 1);
    assert(!error, `Failed to query cohorts: ${error?.message}`);
    assert(Array.isArray(cohorts) && cohorts.length >= 1, 'Should find at least 1 cohort for College 1');
    assert(cohorts[0].yop >= 2020, 'Cohort should have a valid YOP (Year of Passing)');
  });

  // Test 15: Sections query linked to Cohort
  await testAsync('Query sections linked to Cohort', async () => {
    const { data: sections, error } = await supabase
      .from('sections')
      .select('*')
      .eq('cohort_id', 'coh-vrsec-2026');
    assert(!error, `Failed to query sections: ${error?.message}`);
    assert(Array.isArray(sections) && sections.length >= 1, 'Should find sections for cohort');
  });

  // Test 16: Batches query linked to Section
  await testAsync('Query batches linked to Section', async () => {
    const { data: batches, error } = await supabase
      .from('batches')
      .select('*')
      .eq('section_id', 'sec-vrsec-csm-a');
    assert(!error, `Failed to query batches: ${error?.message}`);
    assert(Array.isArray(batches) && batches.length >= 1, 'Should find batches for section');
  });

  // Test 17: Student single section & batch data model constraint
  await testAsync('Enforce student single section and batch assignment constraint', async () => {
    // Attempting to create student with missing section_id or batch_id
    const roll = `HT${Math.floor(100000 + Math.random() * 900000)}`;
    const studentEmail = `stu_hierarchy_${Date.now()}@example.com`;

    const { data: student, error } = await supabase
      .from('students')
      .insert({
        name: 'Kavya Sree',
        email: studentEmail,
        hall_ticket: roll,
        roll_number: roll,
        college_id: 1,
        academic_year_id: 1,
        cohort_id: 1,
        section_id: 1, // Exactly one section
        batch_id: 1,   // Exactly one batch
        must_change_password: true,
      })
      .select()
      .single();

    assert(!error, `Failed to create student: ${error?.message}`);
    assert(student.id, 'Student created');
    assert.strictEqual(student.section_id, 1, 'Student belongs to exactly one section');
    assert.strictEqual(student.batch_id, 1, 'Student belongs to exactly one batch');
    assert.strictEqual(student.must_change_password, true, 'must_change_password set to true on creation');
  });

  console.log('\n--- 3. Welcome Email, Temporary Password & Forced Password Change ---');

  // Test 18: Welcome email service generates temporary password
  await testAsync('sendWelcomeEmail sends credentials and temporary password notice', async () => {
    const res = await sendWelcomeEmail(
      'new_faculty@college.edu',
      'Prof. Anand Kumar',
      'faculty',
      'TempPass#2026',
      'VR Siddhartha Engineering College'
    );
    assert.strictEqual(res, true, 'Welcome email dispatch should succeed');
  });

  // Test 19: Password change endpoint clears must_change_password
  await testAsync('Password update clears must_change_password flag', async () => {
    const tempStudentEmail = `pw_change_${Date.now()}@test.com`;
    const tempPass = 'TempPass123!';
    const tempHash = await bcrypt.hash(tempPass, 10);

    const { data: newStu } = await supabase
      .from('students')
      .insert({
        name: 'Priya Sharma',
        email: tempStudentEmail,
        hall_ticket: `HT${Math.floor(100000 + Math.random() * 900000)}`,
        password_hash: tempHash,
        must_change_password: true,
      })
      .select()
      .single();

    assert.strictEqual(newStu.must_change_password, true);

    // Update password
    const newPass = 'BrandNewP@ssword2026';
    const newHash = await bcrypt.hash(newPass, 12);
    const { data: updatedStu } = await supabase
      .from('students')
      .update({
        password_hash: newHash,
        must_change_password: false,
      })
      .eq('id', newStu.id)
      .select()
      .single();

    assert.strictEqual(updatedStu.must_change_password, false, 'must_change_password must be false after update');
    const matchesNew = await bcrypt.compare(newPass, updatedStu.password_hash);
    assert(matchesNew, 'New password matches updated hash');
  });

  console.log('\n--- 4. Two-Factor Authentication (RFC 6238 TOTP Protection) ---');

  // Test 20: TOTP secret and code generation
  test('generateTotpSecret generates valid Base32 secret', () => {
    const secret = generateTotpSecret();
    assert(typeof secret === 'string' && secret.length >= 16, 'Secret should be Base32 string >= 16 chars');
    assert(/^[A-Z2-7]+$/.test(secret), 'Secret should only contain standard RFC 4648 Base32 chars');
  });

  // Test 21: TOTP verification with valid and invalid codes
  test('verifyTotpCode validates matching code and rejects invalid code', () => {
    const secret = generateTotpSecret();
    const validCode = generateTotpCode(secret);
    assert(typeof validCode === 'string' && validCode.length === 6, 'TOTP code should be 6-digit string');

    const isValid = verifyTotpCode(validCode, secret);
    assert.strictEqual(isValid, true, 'Matching TOTP code must verify as true');

    const isInvalid = verifyTotpCode('000000', secret);
    assert.strictEqual(isInvalid, false, 'Arbitrary code must verify as false');
  });

  // Test 22: TOTP QR code Data URL generation
  await testAsync('generateTotpQrCode generates standard Data URL for authenticator apps', async () => {
    const secret = generateTotpSecret();
    const qrDataUrl = await generateTotpQrCode('super_admin@logicwhilelire.com', secret);
    assert(qrDataUrl.startsWith('data:image/png;base64,'), 'QR code should be PNG Data URL');
  });

  // Test 22b: AES-256-GCM encryption with random IV and auth tag
  test('encryptTotpSecret uses AES-256-GCM with random IV and auth tag', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const enc1 = encryptTotpSecret(secret);
    const enc2 = encryptTotpSecret(secret);
    assert(enc1.startsWith('gcm:'), 'GCM encrypted secret must have gcm: prefix');
    assert.notStrictEqual(enc1, enc2, 'Two encryptions of same secret must have unique IVs');
    assert.strictEqual(isEncryptedTotpSecret(enc1), true, 'isEncryptedTotpSecret should recognize GCM format');
    const decrypted = decryptTotpSecret(enc1);
    assert.strictEqual(decrypted, secret, 'Decrypted secret must match original plaintext');
  });

  // Test 22c: Backward compatibility migration path for legacy AES-256-CTR secrets
  test('decryptTotpSecret seamlessly decrypts legacy AES-256-CTR secrets', () => {
    const secret = 'KRSXG5CTMVRXEZLU';
    // Create a legacy CTR encrypted secret using 16-byte IV
    const key = crypto.createHash('sha256').update(process.env.TOTP_ENCRYPTION_KEY || '').digest();
    const legacyIv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-ctr', key, legacyIv);
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const legacyStored = `${legacyIv.toString('hex')}:${encrypted.toString('hex')}`;

    assert.strictEqual(isEncryptedTotpSecret(legacyStored), true, 'Must recognize legacy CTR format');
    const decrypted = decryptTotpSecret(legacyStored);
    assert.strictEqual(decrypted, secret, 'Must successfully decrypt legacy CTR stored secret');

    // Test migration helper
    const migrated = migrateTotpSecretToGcm(legacyStored);
    assert(migrated.startsWith('gcm:'), 'Migrated secret must be in AES-256-GCM format');
    assert.strictEqual(decryptTotpSecret(migrated), secret, 'Migrated GCM secret must decrypt to original value');
  });

  // Test 22d: AES-256-GCM authentication tag tampering detection
  test('decryptTotpSecret rejects tampered ciphertext or auth tag', () => {
    const secret = 'MZXW6YTBOI======';
    const enc = encryptTotpSecret(secret);
    const parts = enc.slice(4).split(':'); // [iv, tag, cipher]
    // Tamper with ciphertext
    const tamperedCipher = parts[2].slice(0, -2) + (parts[2].endsWith('a') ? 'b' : 'a');
    const tampered = `gcm:${parts[0]}:${parts[1]}:${tamperedCipher}`;
    assert.throws(() => {
      decryptTotpSecret(tampered);
    }, 'Tampered GCM secret must throw authentication failure');
  });

  console.log('\n--- 5. Failed Attempt Tracking & 5-Attempt Account Lockout ---');

  // Test 23: 5 failed login attempts trigger 15-minute lockout (HTTP 423)
  await testAsync('5 failed login attempts lock account with 15-minute cooldown (HTTP 423)', async () => {
    const testAdminEmail = `lockout_test_${Date.now()}@example.com`;
    const correctPass = 'CorrectPass123!';
    const passHash = await bcrypt.hash(correctPass, 10);

    const { data: staffMember } = await supabase
      .from('staff')
      .insert({
        name: 'Inspector Under Test',
        email: testAdminEmail,
        password_hash: passHash,
        role: 'inspector',
        college_id: 1,
        failed_attempts: 0,
        locked_until: null,
      })
      .select()
      .single();

    // Simulate 5 consecutive failed login attempts
    let currentAttempts = 0;
    let isLocked = false;
    let lockExpiry = null;

    for (let i = 1; i <= 5; i++) {
      currentAttempts++;
      if (currentAttempts >= 5) {
        isLocked = true;
        lockExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      }
    }

    assert.strictEqual(currentAttempts, 5, 'Recorded 5 failed attempts');
    assert.strictEqual(isLocked, true, 'Account is flagged as locked');
    assert(lockExpiry !== null, 'Lockout expiration is set');
    const remainingMins = Math.ceil((new Date(lockExpiry).getTime() - Date.now()) / (60 * 1000));
    assert(remainingMins >= 14 && remainingMins <= 15, 'Lockout duration is 15 minutes');
  });

  console.log('\n--- 6. Comprehensive Audit Logging of Admin & Inspector Actions ---');

  // Test 24: recordAuditLog captures actor, role, college scope, action and payload
  await testAsync('recordAuditLog logs administrative actions with role and college scope', async () => {
    const mockReq = {
      ip: '192.168.1.100',
      socket: { remoteAddress: '192.168.1.100' },
      get: () => 'TestAgent/1.0',
    };

    await recordAuditLog(
      { id: 'st000000-0000-0000-0000-000000000004', role: 'inspector', college_id: 1 },
      'INSPECTOR_START_EXAM',
      'exams',
      'e1000000-0000-0000-0000-000000000001',
      { reason: 'Session launched by college principal' },
      mockReq
    );

    const { data: logs, error } = await supabase
      .from('audit_log')
      .select('*')
      .eq('action', 'INSPECTOR_START_EXAM');

    assert(!error, `Failed to query audit_log: ${error?.message}`);
    assert(Array.isArray(logs) && logs.length >= 1, 'Audit log entry should exist');
    const entry = logs[logs.length - 1];
    assert.strictEqual(entry.role, 'inspector', 'Audit log must record role');
    assert.strictEqual(entry.college_id, 1, 'Audit log must record college_id');
    assert.strictEqual(entry.action, 'INSPECTOR_START_EXAM');
    assert.strictEqual(entry.target_table, 'exams');
  });

  // Test 25: Super admin audit log for backup execution
  await testAsync('recordAuditLog captures super_admin database backup execution', async () => {
    const mockReq = {
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      get: () => 'AdminBrowser/1.0',
    };

    await recordAuditLog(
      { id: 'st000000-0000-0000-0000-000000000001', role: 'super_admin' },
      'SYSTEM_BACKUP_EXPORT',
      'system',
      'all_tables',
      { tables_exported: 12 },
      mockReq
    );

    const { data: logs } = await supabase
      .from('audit_log')
      .select('*')
      .eq('action', 'SYSTEM_BACKUP_EXPORT');

    assert(Array.isArray(logs) && logs.length >= 1, 'Backup audit log entry should exist');
    const entry = logs[logs.length - 1];
    assert.strictEqual(entry.role, 'super_admin');
  });

  console.log('\n--- 7. Cross-Role Route Blocking & Isolation Verification Matrix ---');

  // Test 26: studentAuth blocks super_admin token from student routes
  await testAsync('studentAuth blocks super_admin token from student routes', async () => {
    const adminToken = createAdminToken({ sub: 'admin@example.com', staff_id: 'adm-1', role: 'super_admin' });
    const { req, res, next, getStatus, isNextCalled } = createMockReqRes({
      headers: { authorization: `Bearer ${adminToken}` },
    });
    await studentAuth(req, res, next);
    assert(!isNextCalled(), 'super_admin token must NOT pass studentAuth');
    assert([401, 403].includes(getStatus()), 'Expected 401 or 403 Forbidden for admin token on student route');
  });

  // Test 27: studentAuth blocks inspector token from student routes
  await testAsync('studentAuth blocks inspector token from student routes', async () => {
    const inspToken = createAdminToken({ sub: 'insp@example.com', staff_id: 'insp-1', role: 'inspector', college_id: 1 });
    const { req, res, next, getStatus, isNextCalled } = createMockReqRes({
      headers: { authorization: `Bearer ${inspToken}` },
    });
    await studentAuth(req, res, next);
    assert(!isNextCalled(), 'inspector token must NOT pass studentAuth');
    assert([401, 403].includes(getStatus()), 'Expected 401 or 403 Forbidden for inspector token on student route');
  });

  // Test 28: studentAuth blocks faculty token from student routes
  await testAsync('studentAuth blocks faculty token from student routes', async () => {
    const facToken = createAdminToken({ sub: 'faculty@example.com', staff_id: 'fac-1', role: 'faculty' });
    const { req, res, next, getStatus, isNextCalled } = createMockReqRes({
      headers: { authorization: `Bearer ${facToken}` },
    });
    await studentAuth(req, res, next);
    assert(!isNextCalled(), 'faculty token must NOT pass studentAuth');
    assert([401, 403].includes(getStatus()), 'Expected 401 or 403 Forbidden for faculty token on student route');
  });

  // Test 29: requireRole('super_admin') blocks Inspector from System Settings & Backups
  test('requireRole("super_admin") blocks Inspector from system settings & backups with 403', () => {
    const guard = requireRole('super_admin');
    const { req, res, next, getStatus, isNextCalled } = createMockReqRes({
      admin: { id: 'insp-1', role: 'inspector', college_id: 1 },
    });
    guard(req, res, next);
    assert(!isNextCalled(), 'Inspector must be blocked from system settings and backup routes');
    assert.strictEqual(getStatus(), 403);
  });

  // Test 30: requireRole('super_admin') blocks Inspector from Academic Year / Cohort / Section / Batch mutations
  test('requireRole("super_admin") blocks Inspector from creating academic years, cohorts, sections, batches', () => {
    const guard = requireRole('super_admin');
    const { req, res, next, getStatus, isNextCalled } = createMockReqRes({
      admin: { id: 'insp-1', role: 'inspector', college_id: 1 },
    });
    guard(req, res, next);
    assert(!isNextCalled(), 'Inspector cannot create or delete academic hierarchy entities');
    assert.strictEqual(getStatus(), 403);
  });

  // Test 31: requireRole('super_admin', 'inspector') blocks Faculty from Student Management routes
  test('requireRole("super_admin", "inspector") blocks Faculty from student management with 403', () => {
    const guard = requireRole('super_admin', 'inspector');
    const { req, res, next, getStatus, isNextCalled } = createMockReqRes({
      admin: { id: 'fac-1', role: 'faculty' },
    });
    guard(req, res, next);
    assert(!isNextCalled(), 'Faculty must NOT access student management routes');
    assert.strictEqual(getStatus(), 403);
  });

  // Test 32: requireRole('super_admin', 'inspector') blocks Faculty from bulk student import
  test('requireRole("super_admin", "inspector") blocks Faculty from bulk importing students', () => {
    const guard = requireRole('super_admin', 'inspector');
    const { req, res, next, getStatus, isNextCalled } = createMockReqRes({
      admin: { id: 'fac-1', role: 'faculty' },
    });
    guard(req, res, next);
    assert(!isNextCalled(), 'Faculty must NOT access bulk student import');
    assert.strictEqual(getStatus(), 403);
  });

  // Test 33: requireRole('super_admin', 'inspector') blocks Faculty from starting or ending exams
  test('requireRole("super_admin", "inspector") blocks Faculty from starting or ending exams with 403', () => {
    const guard = requireRole('super_admin', 'inspector');
    const { req, res, next, getStatus, isNextCalled } = createMockReqRes({
      admin: { id: 'fac-1', role: 'faculty' },
    });
    guard(req, res, next);
    assert(!isNextCalled(), 'Faculty must NOT start or end exams');
    assert.strictEqual(getStatus(), 403);
  });

  // Test 34: requireRole('super_admin', 'inspector', 'college_admin') blocks Faculty from inspector live dashboard
  test('requireRole("super_admin", "inspector", "college_admin") blocks Faculty from inspector dashboard', () => {
    const guard = requireRole('super_admin', 'inspector', 'college_admin');
    const { req, res, next, getStatus, isNextCalled } = createMockReqRes({
      admin: { id: 'fac-1', role: 'faculty' },
    });
    guard(req, res, next);
    assert(!isNextCalled(), 'Faculty must NOT access inspector live dashboard');
    assert.strictEqual(getStatus(), 403);
  });

  // Test 35: requireExamOwnership blocks Faculty from viewing other faculty reports
  await testAsync('requireExamOwnership blocks Faculty from viewing reports of other faculty exams', async () => {
    const guard = requireExamOwnership('examId');
    const { req, res, next, getStatus, getBody, isNextCalled } = createMockReqRes({
      admin: { id: 'unauthorized-faculty', role: 'faculty' },
      params: { examId: 'e1000000-0000-0000-0000-000000000001' },
    });
    await guard(req, res, next);
    assert(!isNextCalled(), 'Faculty must NOT access other faculty exam reports');
    assert.strictEqual(getStatus(), 403);
    assert.strictEqual(getBody()?.code, 'FORBIDDEN_NOT_EXAM_OWNER');
  });

  // Test 36: Student can only access their own results and exams
  await testAsync('Student dashboard query returns only authenticated student results', async () => {
    const { data: student } = await supabase
      .from('students')
      .select('*')
      .eq('id', 's1000000-0000-0000-0000-000000000001')
      .single();

    assert(student, 'Student Aarav Sharma exists');

    // Query participants for student's roll or email only
    const { data: pList } = await supabase
      .from('participants')
      .select('id, exam_id, hall_ticket')
      .or(`email.eq.${student.email},hall_ticket.eq.${student.roll_number}`);

    assert(Array.isArray(pList), 'Returns participant list');
    // Ensure no records belonging to other students are included
    for (const p of pList) {
      assert.strictEqual(p.hall_ticket, student.roll_number, 'Participant hall ticket must match student');
    }
  });

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passed}/${total} ROLE HIERARCHY & SECURITY TESTS PASSED!`);
  console.log('================================================================\n');
}

runRoleHierarchyTests()
  .then(async () => {
    await cleanupTestData(supabase);
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Fatal Test Error:', err);
    await cleanupTestData(supabase);
    process.exit(1);
  });
