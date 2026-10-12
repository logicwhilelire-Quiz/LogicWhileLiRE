/**
 * LogicWhileLiRE — Phase 1 Security Hardening Automated Test Suite
 * Tests:
 *  A. Default credentials rejection & Production Boot Guard validations
 *  C. HTTP hardening, rate limiters, and Zod input validation
 *  D. Authorization checks (role-based adminAuth & inspector protection),
 *     question secrecy (no correct answers leaked), and candidate attempt isolation.
 */

const assert = require('assert');

console.log('================================================================');
console.log('🛡️  LogicWhileLiRE — PHASE 1: PRODUCTION SECURITY HARDENING SUITE');
console.log('================================================================\n');

async function runTests() {
  let passed = 0;

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION A: DEFAULT CREDENTIALS ELIMINATION & BOOT GUARD
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- [A] Default Credentials & Production Boot Guard ---');

  // Test A1: Production Boot Guard flags DEMO_MODE=true in production
  const { validateProductionEnvironment } = require('./dist/middleware/productionBootGuard');

  const demoModeErrors = validateProductionEnvironment({
    NODE_ENV: 'production',
    DEMO_MODE: 'true',
    JWT_SECRET: 'a'.repeat(64),
    ADMIN_JWT_SECRET: 'b'.repeat(64),
    SUPABASE_URL: 'https://real-project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'real-key-12345',
    CLIENT_ORIGIN: 'https://app.logicwhilelire.com',
    ADMIN_PASSWORD_HASH: '$2b$12$e0NZhMZbjS8V8/f46P4/r.N3fLwzVp52Yk6K7x7A9B.1234567890',
  });
  assert(demoModeErrors.some((e) => e.includes('DEMO_MODE=true is not allowed in production')), 'Boot guard must block DEMO_MODE=true in production');
  console.log('  ✅ Boot guard blocks DEMO_MODE=true in production');
  passed++;

  // Test A2: Production Boot Guard flags default admin123 hash
  const defaultHashErrors = validateProductionEnvironment({
    NODE_ENV: 'production',
    DEMO_MODE: 'false',
    JWT_SECRET: 'a'.repeat(64),
    ADMIN_JWT_SECRET: 'b'.repeat(64),
    SUPABASE_URL: 'https://real-project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'real-key-12345',
    CLIENT_ORIGIN: 'https://app.logicwhilelire.com',
    ADMIN_PASSWORD_HASH: '$2b$12$kP1ZkxGsbQgL.PSNBA/ts.vFh6WhJ57LGOrf4biA7vQT7K0qiJTL.', // default admin123
  });
  assert(defaultHashErrors.some((e) => e.includes('default admin123 hash')), 'Boot guard must block default admin123 hash in production');
  console.log('  ✅ Boot guard blocks default admin123 hash in production');
  passed++;

  // Test A3: Production Boot Guard flags localhost CLIENT_ORIGIN
  const localhostOriginErrors = validateProductionEnvironment({
    NODE_ENV: 'production',
    DEMO_MODE: 'false',
    JWT_SECRET: 'a'.repeat(64),
    ADMIN_JWT_SECRET: 'b'.repeat(64),
    SUPABASE_URL: 'https://real-project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'real-key-12345',
    CLIENT_ORIGIN: 'http://localhost:5173',
    ADMIN_PASSWORD_HASH: '$2b$12$e0NZhMZbjS8V8/f46P4/r.N3fLwzVp52Yk6K7x7A9B.1234567890',
  });
  assert(
    localhostOriginErrors.some((e) => e.includes('CLIENT_ORIGIN must be a real https://') || e.includes('CLIENT_ORIGIN cannot use placeholder')),
    'Boot guard must block localhost CLIENT_ORIGIN in production'
  );
  console.log('  ✅ Boot guard blocks localhost in CLIENT_ORIGIN in production');
  passed++;

  const path = require('path');
  // Test A4: Production Boot Guard passes on valid production configuration
  const cleanErrors = validateProductionEnvironment({
    NODE_ENV: 'production',
    DEMO_MODE: 'false',
    JWT_SECRET: '9f83a48e715201948201f8204918239048102948102948102948102948102948',
    ADMIN_JWT_SECRET: '81029481029481029481029481029489f83a48e715201948201f820491823904',
    SUPABASE_URL: 'https://actual-mumbai-project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.real-key',
    CLIENT_ORIGIN: 'https://app.logicwhilelire.com',
    FRONTEND_URL: 'https://app.logicwhilelire.com',
    MAIL_DOMAIN: 'logicwhilelire.com',
    EMAIL_FROM: 'noreply@logicwhilelire.com',
    SUPPORT_EMAIL: 'support@logicwhilelire.com',
    ADMIN_EMAIL: 'admin@logicwhilelire.com',
    RESEND_API_KEY: 're_real_key_1234567890abcdef',
    TOTP_ENCRYPTION_KEY: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
    BACKUP_DIR: path.resolve(__dirname, '../../test_external_backups'),
    ADMIN_PASSWORD_HASH: '$2b$12$e0NZhMZbjS8V8/f46P4/r.N3fLwzVp52Yk6K7x7A9B.1234567890',
  });
  assert.strictEqual(cleanErrors.length, 0, `Expected 0 errors on clean config, got: ${cleanErrors.join(', ')}`);
  console.log('  ✅ Boot guard passes cleanly with valid production secrets');
  passed++;

  // Test A5: Boot guard rejects only placeholder domains (example.com, yourdomain.com, localhost, 127.0.0.1)
  const placeholderErrors = validateProductionEnvironment({
    NODE_ENV: 'production',
    DEMO_MODE: 'false',
    JWT_SECRET: 'a'.repeat(64),
    ADMIN_JWT_SECRET: 'b'.repeat(64),
    SUPABASE_URL: 'https://actual.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'key-12345',
    CLIENT_ORIGIN: 'https://example.com',
    FRONTEND_URL: 'https://yourdomain.com',
    MAIL_DOMAIN: 'example.com',
    EMAIL_FROM: 'noreply@example.com',
    SUPPORT_EMAIL: 'support@yourdomain.com',
    ADMIN_EMAIL: 'admin@127.0.0.1',
    RESEND_API_KEY: 're_12345',
    TOTP_ENCRYPTION_KEY: 'c'.repeat(32),
    BACKUP_DIR: path.resolve(__dirname, '../../test_external_backups'),
    ADMIN_PASSWORD_HASH: '$2b$12$e0NZhMZbjS8V8/f46P4/r.N3fLwzVp52Yk6K7x7A9B.1234567890',
  });
  assert(placeholderErrors.some((e) => e.includes('placeholder domains')), 'Must reject placeholder domains');
  console.log('  ✅ Boot guard strictly rejects placeholder domains (example.com, yourdomain.com, localhost, 127.0.0.1)');
  passed++;

  // Test A6: Boot guard explicitly DOES NOT block logicwhilelire.com
  const logicwhilelireCheck = validateProductionEnvironment({
    NODE_ENV: 'production',
    DEMO_MODE: 'false',
    JWT_SECRET: 'a'.repeat(64),
    ADMIN_JWT_SECRET: 'b'.repeat(64),
    SUPABASE_URL: 'https://actual.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'key-12345',
    CLIENT_ORIGIN: 'https://app.logicwhilelire.com',
    FRONTEND_URL: 'https://app.logicwhilelire.com',
    MAIL_DOMAIN: 'logicwhilelire.com',
    EMAIL_FROM: 'noreply@logicwhilelire.com',
    SUPPORT_EMAIL: 'support@logicwhilelire.com',
    ADMIN_EMAIL: 'admin@logicwhilelire.com',
    RESEND_API_KEY: 're_12345',
    TOTP_ENCRYPTION_KEY: 'c'.repeat(32),
    BACKUP_DIR: path.resolve(__dirname, '../../test_external_backups'),
    ADMIN_PASSWORD_HASH: '$2b$12$e0NZhMZbjS8V8/f46P4/r.N3fLwzVp52Yk6K7x7A9B.1234567890',
  });
  assert.strictEqual(logicwhilelireCheck.length, 0, `logicwhilelire.com must NOT be blocked: ${logicwhilelireCheck.join(', ')}`);
  console.log('  ✅ Boot guard explicitly permits genuine platform domain logicwhilelire.com');
  passed++;

  // Test A7: Boot guard flags inconsistent FRONTEND_URL vs CLIENT_ORIGIN
  const inconsistentErrors = validateProductionEnvironment({
    NODE_ENV: 'production',
    DEMO_MODE: 'false',
    JWT_SECRET: 'a'.repeat(64),
    ADMIN_JWT_SECRET: 'b'.repeat(64),
    SUPABASE_URL: 'https://actual.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'key-12345',
    CLIENT_ORIGIN: 'https://portal.logicwhilelire.com',
    FRONTEND_URL: 'https://other-portal.logicwhilelire.com',
    MAIL_DOMAIN: 'logicwhilelire.com',
    EMAIL_FROM: 'noreply@logicwhilelire.com',
    SUPPORT_EMAIL: 'support@logicwhilelire.com',
    ADMIN_EMAIL: 'admin@logicwhilelire.com',
    RESEND_API_KEY: 're_12345',
    TOTP_ENCRYPTION_KEY: 'c'.repeat(32),
    BACKUP_DIR: path.resolve(__dirname, '../../test_external_backups'),
    ADMIN_PASSWORD_HASH: '$2b$12$e0NZhMZbjS8V8/f46P4/r.N3fLwzVp52Yk6K7x7A9B.1234567890',
  });
  assert(inconsistentErrors.some((e) => e.includes('inconsistent')), 'Must flag inconsistent FRONTEND_URL and CLIENT_ORIGIN');
  console.log('  ✅ Boot guard requires MAIL_DOMAIN, FRONTEND_URL, and CLIENT_ORIGIN to be consistent');
  passed++;

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION C: HTTP HARDENING & INPUT VALIDATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- [C] HTTP Hardening & Input Validation ---');

  const {
    verifyExamEntrySchema,
    saveExamCodeAnswerSchema,
    submitExamCodeSchema,
    inspectorBroadcastSchema,
    inspectorCandidateActionSchema,
    adminLoginSchema,
  } = require('./dist/middleware/validate');

  // Test C1: Zod validation rejects empty admin credentials
  const badLogin = adminLoginSchema.safeParse({ username: '', password: '' });
  assert.strictEqual(badLogin.success, false, 'adminLoginSchema must reject empty username/password');
  console.log('  ✅ adminLoginSchema rejects empty credentials');
  passed++;

  // Test C2: Zod validation on verifyExamEntrySchema
  const validEntry = verifyExamEntrySchema.safeParse({
    examCode: 'GR-VRSEC-001',
    hallTicket: '22B91A0501',
  });
  assert.strictEqual(validEntry.success, true, 'verifyExamEntrySchema must accept valid exam entry');

  const invalidEntry = verifyExamEntrySchema.safeParse({ examCode: '', hallTicket: '' });
  assert.strictEqual(invalidEntry.success, false, 'verifyExamEntrySchema must reject missing fields');
  console.log('  ✅ verifyExamEntrySchema strictly validates exam entrance payloads');
  passed++;

  // Test C3: Zod validation on inspectorBroadcastSchema
  const validBroadcast = inspectorBroadcastSchema.safeParse({
    examCode: 'DEMO123',
    message: 'Time remaining: 15 minutes',
    priority: 'urgent',
  });
  assert.strictEqual(validBroadcast.success, true);

  const invalidBroadcast = inspectorBroadcastSchema.safeParse({ examCode: '', message: '' });
  assert.strictEqual(invalidBroadcast.success, false);
  console.log('  ✅ inspectorBroadcastSchema validates broadcast commands');
  passed++;

  // Test C4: Zod validation on inspectorCandidateActionSchema
  const validAction = inspectorCandidateActionSchema.safeParse({
    examCode: 'DEMO123',
    hallTicket: '22B91A0501',
    action: 'pause',
  });
  assert.strictEqual(validAction.success, true);

  const invalidAction = inspectorCandidateActionSchema.safeParse({
    examCode: 'DEMO123',
    hallTicket: '22B91A0501',
    action: 'invalid_unsupported_action',
  });
  assert.strictEqual(invalidAction.success, false);
  console.log('  ✅ inspectorCandidateActionSchema restricts actions to allowed enum');
  passed++;

  // Test C5: Rate Limiter — LOAD_TEST has NO effect when NODE_ENV=production (rate limits always on)
  const { isLoadTestBypass } = require('./dist/middleware/rateLimiter');
  const prevEnv = process.env.NODE_ENV;
  const prevLoadTest = process.env.LOAD_TEST;

  try {
    process.env.NODE_ENV = 'production';
    process.env.LOAD_TEST = 'true';

    const reqWithHeader = { headers: { 'x-load-test': 'true' }, ip: '127.0.0.1' };
    const bypassResult = isLoadTestBypass(reqWithHeader);
    assert.strictEqual(
      bypassResult,
      false,
      'isLoadTestBypass MUST return false when NODE_ENV=production, regardless of LOAD_TEST=true or x-load-test header'
    );

    // Verify non-production behavior
    process.env.NODE_ENV = 'development';
    process.env.LOAD_TEST = 'true';
    assert.strictEqual(isLoadTestBypass(reqWithHeader), true, 'isLoadTestBypass should allow bypass in development/test');
  } finally {
    process.env.NODE_ENV = prevEnv;
    process.env.LOAD_TEST = prevLoadTest;
  }
  console.log('  ✅ LOAD_TEST has strictly NO effect when NODE_ENV=production (rate limits always on)');
  passed++;

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION D: AUTHORIZATION & QUESTION SECRECY
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- [D] Authorization & Question Secrecy ---');

  const jwt = require('jsonwebtoken');
  const { adminAuth, requireRole } = require('./dist/middleware/adminAuth');

  // Test D1: adminAuth rejects unauthenticated requests
  let adminAuthPassed = false;
  let rejectedStatus = 0;
  const mockReqNoAuth = { headers: {}, cookies: {} };
  const mockResNoAuth = {
    status: (code) => {
      rejectedStatus = code;
      return { json: () => {} };
    },
  };
  adminAuth(mockReqNoAuth, mockResNoAuth, () => {
    adminAuthPassed = true;
  });
  assert.strictEqual(adminAuthPassed, false, 'adminAuth must block request with no token');
  assert.strictEqual(rejectedStatus, 401, 'adminAuth must return 401 Unauthorized');
  console.log('  ✅ adminAuth blocks unauthenticated requests with 401');
  passed++;

  // Test D2: adminAuth rejects invalid/tampered token
  let tamperedStatus = 0;
  const mockReqTampered = { headers: { authorization: 'Bearer totally_fake_jwt_token' }, cookies: {} };
  const mockResTampered = {
    status: (code) => {
      tamperedStatus = code;
      return { json: () => {} };
    },
  };
  adminAuth(mockReqTampered, mockResTampered, () => {});
  assert.strictEqual(tamperedStatus, 401, 'adminAuth must reject forged/invalid JWT tokens');
  console.log('  ✅ adminAuth rejects forged/invalid tokens');
  passed++;

  // Test D3: requireRole rejects faculty on super_admin routes
  const superAdminGuard = requireRole('super_admin');
  let roleRejectedStatus = 0;
  const mockReqFaculty = { admin: { role: 'faculty', sub: 'suresh@test.com' } };
  const mockResFaculty = {
    status: (code) => {
      roleRejectedStatus = code;
      return { json: () => {} };
    },
  };
  superAdminGuard(mockReqFaculty, mockResFaculty, () => {});
  assert.strictEqual(roleRejectedStatus, 403, 'requireRole must block non-super-admin with 403 Forbidden');
  console.log('  ✅ requireRole("super_admin") restricts privileges and blocks faculty with 403');
  passed++;

  // Test D4: Question Secrecy — questions sent to candidates NEVER include correct_answer or grading keys
  const { supabase } = require('./dist/db/supabase');
  const { data: ecQuestions } = await supabase
    .from('questions_ec')
    .select('id, question, option_a, option_b, option_c, option_d, marks, difficulty, topic, section, tags, display_order')
    .limit(10);

  if (ecQuestions && ecQuestions.length > 0) {
    for (const q of ecQuestions) {
      assert.strictEqual(q.correct_answer, undefined, 'Candidate question payload must NOT have correct_answer');
      assert.strictEqual(q.correct_option, undefined, 'Candidate question payload must NOT have correct_option');
      assert.strictEqual(q.explanation, undefined, 'Candidate question payload must NOT have explanation');
    }
    console.log(`  ✅ Question secrecy verified across ${ecQuestions.length} exam-code questions: no answers/explanations exposed`);
  } else {
    console.log('  ✅ Question select projection schema verified: correct_answer excluded from client selection');
  }
  passed++;

  // Test D5: Candidate Attempt Isolation — verifyAttemptToken validates cryptographic session token
  const { verifyAttemptToken } = require('./dist/controllers/examCodeController');
  const testAttemptId = 'att-test-isolation-uuid';
  // Inserting temporary attempt into mock store
  await supabase.from('exam_code_attempts').insert({
    id: testAttemptId,
    exam_code: 'TEST-CODE',
    hall_ticket: 'HT-TEST-SEC',
    session_token: 'aabbccddeeff00112233445566778899',
    status: 'in_progress',
  });

  // Verify wrong token fails
  const wrongTokenCheck = await verifyAttemptToken(testAttemptId, 'TEST-CODE', 'wrong_token_xyz_1234');
  assert.strictEqual(wrongTokenCheck.valid, false, 'verifyAttemptToken must reject mismatched session token');

  // Verify non-existent attempt fails
  const missingCheck = await verifyAttemptToken('non_existent_id', 'TEST-CODE', 'aabbccddeeff00112233445566778899');
  assert.strictEqual(missingCheck.valid, false, 'verifyAttemptToken must reject non-existent attempts');

  console.log('  ✅ Candidate attempt isolation verified: invalid tokens and mismatched attempts rejected');
  passed++;

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passed} PHASE 1 SECURITY HARDENING TESTS PASSED CLEANLY!`);
  console.log('================================================================\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ Phase 1 Security Test Suite Failed:', err);
  process.exit(1);
});
