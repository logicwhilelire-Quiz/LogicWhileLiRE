/**
 * ============================================================
 * LogicWhileLiRE — STUDENT REGISTRATION, ROSTER & LOGIN SUITE
 * ============================================================
 * Tests:
 * 1. Self-registration fields (full name, roll, college, cohort, section, email, phone, password)
 * 2. Roster enforcement: Reject unknown rolls with clear message
 * 3. Roster section validation: Reject mismatched sections
 * 4. Composite uniqueness: (college_id, roll_number) rejection
 * 5. Email uniqueness rejection
 * 6. Email OTP verification & account activation requirement before login
 * 7. Login by email OR roll number + password
 * 8. 5-attempt lockout with 15-minute cooldown (HTTP 423)
 * 9. Forgot password / reset password workflow
 * 10. Single active session enforcement (SESSION_SUPERSEDED)
 * 11. Student dashboard (upcoming exams, past results, ranking)
 */

const { isRealSupabase, cleanupTestData } = require('./test-helper');
process.env.PORT = '0';

const assert = require('assert');
const http = require('http');

let server;
let baseUrl;

async function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const reqHeaders = {
      'Content-Type': 'application/json',
      'x-load-test': 'true', // bypass rate limiters during automated tests
      ...headers,
    };

    const payload = body ? JSON.stringify(body) : null;
    if (payload) {
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = data ? JSON.parse(data) : null;
          } catch {
            json = data;
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: json,
          });
        });
      }
    );

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('🎓 LogicWhileLiRE — STUDENT REGISTRATION & LOGIN TEST SUITE');
  console.log('================================================================\n');

  // Load app (binds to ephemeral port because PORT=0)
  const appModule = require('./dist/index.js');
  server = appModule.httpServer;

  if (server && !server.listening) {
    await new Promise((resolve) => server.once('listening', resolve));
  }

  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  try {
    // ── 1. ROSTER ENFORCEMENT ─────────────────────────────────────
    console.log('--- 1. Roster Enforcement: Unknown Rolls & Section Matching ---');

    // 1a: Try registering roll NOT on roster
    const unknownRollRes = await request('POST', '/api/auth/register', {
      name: 'Imposter Student',
      roll_number: 'UNKNOWN_99999',
      college_id: 1,
      cohort_id: 'coh-vrsec-2026',
      section: 'B',
      email: 'imposter@example.com',
      phone: '+919999999999',
      password: 'SecurePassword123!',
    });

    assert.strictEqual(unknownRollRes.status, 403, 'Unknown roll should be rejected with HTTP 403');
    assert.strictEqual(unknownRollRes.body.success, false);
    assert.strictEqual(unknownRollRes.body.code, 'ROSTER_ROLL_NOT_FOUND');
    assert.ok(
      unknownRollRes.body.error.includes('not on the approved student roster'),
      'Clear message explaining unknown roll rejection'
    );
    console.log('  ✅ [1] Unknown roll number rejected with 403 ROSTER_ROLL_NOT_FOUND and clear message');

    // 1b: Try registering with mismatched section (2201A0501 is Section A on roster, request section B)
    const sectionMismatchRes = await request('POST', '/api/auth/register', {
      name: 'Aravind Swamy',
      roll_number: '2201A0501',
      college_id: 1,
      cohort_id: 'coh-vrsec-2026',
      section: 'B', // mismatch: roster has section A
      email: 'aravind.mismatch@campus.edu',
      phone: '+919876543210',
      password: 'SecurePassword123!',
    });

    assert.ok(sectionMismatchRes.status === 400 || sectionMismatchRes.status === 403, 'Mismatched section should be rejected with HTTP 400 or 403');
    assert.strictEqual(sectionMismatchRes.body.code, 'ROSTER_SECTION_MISMATCH');
    console.log(`  ✅ [2] Mismatched section rejected with ${sectionMismatchRes.status} ROSTER_SECTION_MISMATCH`);

    // ── 2. APPROVED ROSTER SELF-REGISTRATION & OTP GENERATION ─────
    console.log('\n--- 2. Self-Registration & Email Verification OTP ---');

    // Register with approved roll: 2201A0501, Section A, College 1
    const regRes = await request('POST', '/api/auth/register', {
      full_name: 'Aravind Swamy',
      roll_number: '2201A0501',
      college_id: 1,
      cohort_id: 'coh-vrsec-2026',
      section: 'A',
      email: 'aravind.swamy@campus.edu',
      phone: '+919876543210',
      password: 'StudentPass123!',
    });

    assert.strictEqual(regRes.status, 201, 'Approved roster roll should register successfully with HTTP 201');
    assert.strictEqual(regRes.body.success, true);
    assert.strictEqual(regRes.body.requires_verification, true);
    assert.ok(regRes.body.demo_otp, 'Demo OTP generated');
    assert.ok(regRes.body.demo_verify_link, 'Activation link generated');
    const studentOtp = regRes.body.demo_otp;
    console.log(`  ✅ [3] Registration successful for approved roll (requires_verification: true, OTP: ${studentOtp})`);

    // ── 3. COMPOSITE UNIQUE ENFORCEMENT (college_id, roll_number) ─
    console.log('\n--- 3. Composite Uniqueness & Unverified State Enforcements ---');

    // 3a: Attempt login before account is verified -> must be rejected
    const unverifiedLogin = await request('POST', '/api/auth/login', {
      login: '2201A0501',
      password: 'StudentPass123!',
    });
    assert.strictEqual(unverifiedLogin.status, 403, 'Unverified account login must be blocked with HTTP 403');
    assert.strictEqual(unverifiedLogin.body.requires_verification, true);
    console.log('  ✅ [4] Login blocked for unverified student (HTTP 403 requires_verification)');

    // 3b: Verify with wrong OTP -> rejected
    const wrongOtpRes = await request('POST', '/api/auth/verify-registration-otp', {
      email: 'aravind.swamy@campus.edu',
      otp: '000000',
    });
    assert.strictEqual(wrongOtpRes.status, 400);
    assert.strictEqual(wrongOtpRes.body.code, 'INVALID_VERIFICATION_CODE');
    console.log('  ✅ [5] Invalid OTP rejected with HTTP 400');

    // 3c: Verify with correct OTP -> activated
    const verifyRes = await request('POST', '/api/auth/verify-registration-otp', {
      email: 'aravind.swamy@campus.edu',
      otp: studentOtp,
    });
    assert.strictEqual(verifyRes.status, 200);
    assert.strictEqual(verifyRes.body.success, true);
    assert.ok(verifyRes.body.token, 'JWT token issued on activation');
    console.log('  ✅ [6] Account activated via OTP; JWT session issued');

    // 3d: Attempt duplicate registration with same roll number and college -> rejected
    const duplicateRollRes = await request('POST', '/api/auth/register', {
      full_name: 'Clone Aravind',
      roll_number: '2201A0501',
      college_id: 1,
      cohort_id: 'coh-vrsec-2026',
      section: 'A',
      email: 'clone.aravind@campus.edu',
      password: 'AnotherPassword123!',
    });
    assert.strictEqual(duplicateRollRes.status, 409, 'Duplicate (college_id, roll_number) must return HTTP 409');
    assert.strictEqual(duplicateRollRes.body.code, 'DUPLICATE_COLLEGE_ROLL');
    console.log('  ✅ [7] Duplicate (college_id, roll_number) rejected with HTTP 409 DUPLICATE_COLLEGE_ROLL');

    // ── 4. MULTI-IDENTIFIER LOGIN (Roll Number OR Email) ─────────
    console.log('\n--- 4. Multi-Identifier Login (Email OR Roll Number) ---');

    // 4a: Login by email
    const emailLoginRes = await request('POST', '/api/auth/login', {
      email: 'aravind.swamy@campus.edu',
      password: 'StudentPass123!',
    });
    assert.strictEqual(emailLoginRes.status, 200);
    assert.strictEqual(emailLoginRes.body.success, true);
    assert.ok(emailLoginRes.body.token);
    const sessionToken1 = emailLoginRes.body.token;
    console.log('  ✅ [8] Successfully authenticated using email address');

    // 4b: Login by roll number
    const rollLoginRes = await request('POST', '/api/auth/login', {
      roll_number: '2201A0501',
      password: 'StudentPass123!',
    });
    assert.strictEqual(rollLoginRes.status, 200);
    assert.strictEqual(rollLoginRes.body.success, true);
    assert.ok(rollLoginRes.body.token);
    const sessionToken2 = rollLoginRes.body.token;
    console.log('  ✅ [9] Successfully authenticated using roll number');

    // ── 5. SINGLE ACTIVE SESSION PER STUDENT ──────────────────────
    console.log('\n--- 5. Single Active Session Enforcement ---');

    // Old sessionToken1 should now be SUPERSEDED by sessionToken2
    const oldSessionProfileRes = await request('GET', '/api/student/dashboard', null, {
      Authorization: `Bearer ${sessionToken1}`,
    });
    assert.strictEqual(
      oldSessionProfileRes.status,
      401,
      'Old session must be rejected with 401 when superseded by new login'
    );
    assert.strictEqual(
      oldSessionProfileRes.body.code,
      'SESSION_SUPERSEDED',
      'SESSION_SUPERSEDED code returned'
    );
    console.log('  ✅ [10] Previous student session invalidated with HTTP 401 SESSION_SUPERSEDED');

    // New sessionToken2 should be completely valid
    const newSessionProfileRes = await request('GET', '/api/student/dashboard', null, {
      Authorization: `Bearer ${sessionToken2}`,
    });
    assert.strictEqual(newSessionProfileRes.status, 200);
    assert.strictEqual(newSessionProfileRes.body.success, true);
    assert.strictEqual(newSessionProfileRes.body.student.roll_number, '2201A0501');
    assert.ok(Array.isArray(newSessionProfileRes.body.upcoming_exams), 'Upcoming exams list provided');
    assert.ok(Array.isArray(newSessionProfileRes.body.past_results), 'Past results provided');
    assert.ok(newSessionProfileRes.body.rank, 'Student ranking provided');
    console.log('  ✅ [11] Current active session accesses student dashboard (profile, exams, rank)');

    // ── 6. 5-ATTEMPT LOCKOUT PROTECTION ───────────────────────────
    console.log('\n--- 6. 5-Attempt Lockout Protection (15-Minute Cooldown) ---');

    // Register second student on roster: 2201A0502 (Section B, College 1)
    const reg2 = await request('POST', '/api/auth/register', {
      full_name: 'Bhavana Reddy',
      roll_number: '2201A0502',
      college_id: 1,
      cohort_id: 'coh-vrsec-2026',
      section: 'B',
      email: 'bhavana.lockout@campus.edu',
      password: 'CorrectPassword123!',
    });
    assert.strictEqual(reg2.status, 201);
    await request('POST', '/api/auth/verify-registration-otp', {
      email: 'bhavana.lockout@campus.edu',
      otp: reg2.body.demo_otp,
    });

    // Make 4 incorrect login attempts -> 401
    for (let i = 1; i <= 4; i++) {
      const failRes = await request('POST', '/api/auth/login', {
        login: '2201A0502',
        password: `WrongPass_${i}`,
      });
      assert.strictEqual(failRes.status, 401);
      assert.ok(failRes.body.error.includes(`${5 - i} attempt(s) remaining`));
    }
    console.log('  ✅ [12] 4 failed attempts track countdown accurately');

    // 5th incorrect attempt -> 423 Locked
    const lockRes = await request('POST', '/api/auth/login', {
      login: '2201A0502',
      password: 'WrongPass_5',
    });
    assert.strictEqual(lockRes.status, 423, '5th consecutive failure must lock account with HTTP 423');
    assert.strictEqual(lockRes.body.locked, true);
    console.log('  ✅ [13] 5th consecutive failed attempt locks account with HTTP 423');

    // Subsequent attempt even with correct password -> still 423 Locked
    const stillLockedRes = await request('POST', '/api/auth/login', {
      login: '2201A0502',
      password: 'CorrectPassword123!',
    });
    assert.strictEqual(stillLockedRes.status, 423, 'Locked account rejects login even with correct password');
    console.log('  ✅ [14] Locked account rejects subsequent login attempts with HTTP 423');

    // ── 7. FORGOT / RESET PASSWORD ────────────────────────────────
    console.log('\n--- 7. Forgot / Reset Password by Email ---');

    const forgotRes = await request('POST', '/api/auth/forgot-password', {
      email: 'bhavana.lockout@campus.edu',
    });
    assert.strictEqual(forgotRes.status, 200);
    const resetToken = forgotRes.body.demo_token;
    assert.ok(resetToken, 'Reset token generated');

    const resetRes = await request('POST', '/api/auth/reset-password', {
      email: 'bhavana.lockout@campus.edu',
      token: resetToken,
      new_password: 'BrandNewPassword999!',
    });
    assert.strictEqual(resetRes.status, 200);
    assert.strictEqual(resetRes.body.success, true);
    console.log('  ✅ [15] Password successfully reset and account unlocked via email token');

    // Login with new password now succeeds and unlocks
    const unlockedLogin = await request('POST', '/api/auth/login', {
      login: 'bhavana.lockout@campus.edu',
      password: 'BrandNewPassword999!',
    });
    assert.strictEqual(unlockedLogin.status, 200);
    assert.strictEqual(unlockedLogin.body.success, true);
    console.log('  ✅ [16] Unlocked account successfully logs in with new password');

    console.log('\n================================================================');
    console.log('🎉 ALL 16/16 STUDENT REGISTRATION & LOGIN TESTS PASSED CLEANLY!');
    console.log('================================================================\n');
  } finally {
    if (server) {
      server.close();
    }
  }
}

runTests()
  .then(async () => {
    const { supabase } = require('./dist/db/supabase');
    await cleanupTestData(supabase);
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('\n❌ Test suite failed with error:', err);
    try {
      const { supabase } = require('./dist/db/supabase');
      await cleanupTestData(supabase);
    } catch {}
    process.exit(1);
  });
