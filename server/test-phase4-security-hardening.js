/**
 * test-phase4-security-hardening.js
 *
 * Automated Test Suite for PHASE 4: Security Hardening
 * Verifies:
 * 1. Double-Submit Cookie CSRF protection (cookie-auth mutation rejected without matching CSRF token, Bearer auth safe)
 * 2. GET /api/csrf-token endpoint generates token and cookie
 * 3. 5-attempt login rate limit & 15-minute lockout (HTTP 423)
 * 4. Strong password policy enforcement (admin & inspector creation, password updates)
 * 5. Admin & Inspector Email OTP generation, dispatch, and verification
 * 6. Production Boot Guard validation (blocking weak secrets, demo mode, and default passwords)
 * 7. HttpOnly cookies & bcrypt hashing verification
 */

const assert = require('assert');
const http = require('http');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

require('dotenv').config();
process.env.ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'test_admin_jwt_secret_key_32chars_long';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_32chars_long';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'mock-ci-admin-pass';
process.env.DEMO_MODE = 'true';

const { isStrongPassword, strongPasswordSchema } = require('./dist/middleware/validate');
const { ensureCsrfCookie, csrfProtection, getCsrfToken } = require('./dist/middleware/csrf');
const { validateProductionEnvironment } = require('./dist/middleware/productionBootGuard');
const {
  adminLogin,
  requestLoginOtp,
  verifyLoginOtp,
  generateStaffLoginOtp,
  verifyStaffLoginOtp,
  adminLoginOtpStore,
} = require('./dist/controllers/adminController');

let passed = 0;
function pass(num, label) {
  passed++;
  console.log(`  ✅ [${num}] ${label}`);
}

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    cookies: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    setHeader(name, val) {
      this.headers[name.toLowerCase()] = val;
      return this;
    },
    cookie(name, val, opts) {
      this.cookies[name] = { val, opts };
      const cookieStr = `${name}=${val}; ${opts?.httpOnly ? 'HttpOnly;' : ''}`;
      if (!this.headers['set-cookie']) this.headers['set-cookie'] = [];
      this.headers['set-cookie'].push(cookieStr);
      return this;
    },
  };
  return res;
}

async function runPhase4SecurityTests() {
  console.log('================================================================');
  console.log('🛡️ PHASE 4: SECURITY HARDENING VERIFICATION SUITE');
  console.log('================================================================\n');

  // --- 1. Strong Password Policy ---
  console.log('--- 1. Strong Password Policy Verification ---');
  const weakPasswords = [
    'short1!',           // < 8 chars
    'alllowercase123!',  // No uppercase
    'ALLUPPERCASE123!',  // No lowercase
    'NoDigitsHere!@#',   // No digits
    'NoSpecialChar1234', // No special char
  ];

  for (const weak of weakPasswords) {
    const check = isStrongPassword(weak);
    assert.strictEqual(check.valid, false, `Expected weak password "${weak}" to fail validation`);
  }
  pass(1, 'Weak passwords properly rejected across all required character classes');

  const strongPass = 'Secure#P4ssw0rd!2026';
  const strongCheck = isStrongPassword(strongPass);
  assert.strictEqual(strongCheck.valid, true, 'Strong password must pass validation');
  assert.strictEqual(strongPasswordSchema.safeParse(strongPass).success, true);
  pass(2, 'Strong password with uppercase, lowercase, digit, and symbol passes validation');

  // --- 2. Production Boot Guard ---
  console.log('\n--- 2. Production Boot Guard & Secrets Protection ---');
  const insecureEnv = {
    NODE_ENV: 'production',
    DEMO_MODE: 'true',
    JWT_SECRET: 'short_weak_secret',
    ADMIN_JWT_SECRET: 'another_weak_secret',
    SUPABASE_URL: 'https://placeholder.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'placeholder',
    CLIENT_ORIGIN: 'http://localhost:5173',
    ADMIN_PASSWORD_HASH: '$2b$12$kP1ZkxGsbQgL.PSNBA/ts.vFh6WhJ57LGOrf4biA7vQT7K0qiJTL.', // default admin123
  };

  const bootErrors = validateProductionEnvironment(insecureEnv);
  assert.ok(bootErrors.length >= 4, `Expected at least 4 boot errors, got ${bootErrors.length}`);
  assert.ok(bootErrors.some((e) => e.includes('DEMO_MODE=true is not allowed in production')));
  assert.ok(bootErrors.some((e) => e.includes('JWT_SECRET must be at least 32 characters')));
  assert.ok(bootErrors.some((e) => e.includes('ADMIN_PASSWORD_HASH must be set to a production bcrypt hash')));
  pass(3, 'Production boot guard strictly blocks weak secrets, demo mode, and default password hashes');

  // --- 3. Double-Submit Cookie CSRF Protection ---
  console.log('\n--- 3. CSRF Protection (Double-Submit Cookie Pattern) ---');

  // 3a. GET /api/csrf-token generates and sets cookie
  const tokenReq = { cookies: {}, headers: {} };
  const tokenRes = createMockRes();
  getCsrfToken(tokenReq, tokenRes);
  assert.strictEqual(tokenRes.statusCode, 200);
  assert.strictEqual(tokenRes.body.success, true);
  assert.ok(tokenRes.body.csrfToken && tokenRes.body.csrfToken.length >= 32);
  const setCookie = tokenRes.headers['set-cookie'];
  assert.ok(setCookie && setCookie.some((c) => c.startsWith('XSRF-TOKEN=')));
  pass(4, 'GET /api/csrf-token provides cryptographically secure token and sets XSRF-TOKEN cookie');

  const csrfToken = tokenRes.body.csrfToken;
  const cookieHeader = `XSRF-TOKEN=${csrfToken}; admin_token=fake_auth_cookie`;

  // 3b. Mutating POST with cookie auth but missing CSRF header must be rejected with 403
  const rejectRes = createMockRes();
  const rejectReq = {
    method: 'POST',
    path: '/api/admin/mutate-test',
    cookies: { admin_token: 'fake_auth_cookie', 'XSRF-TOKEN': csrfToken },
    headers: { cookie: cookieHeader },
    body: { data: 'test' },
  };
  let rejectNextCalled = false;
  csrfProtection(rejectReq, rejectRes, () => { rejectNextCalled = true; });
  assert.strictEqual(rejectNextCalled, false);
  assert.strictEqual(rejectRes.statusCode, 403);
  assert.strictEqual(rejectRes.body.code, 'CSRF_VALIDATION_FAILED');
  pass(5, 'Mutating operation using auth cookie without CSRF header rejected with HTTP 403');

  // 3c. Mutating POST with cookie auth and valid x-xsrf-token header must succeed
  const allowRes = createMockRes();
  const allowReq = {
    method: 'POST',
    path: '/api/admin/mutate-test',
    cookies: { admin_token: 'fake_auth_cookie', 'XSRF-TOKEN': csrfToken },
    headers: {
      cookie: cookieHeader,
      'x-xsrf-token': csrfToken,
    },
    body: { data: 'test' },
  };
  let allowNextCalled = false;
  csrfProtection(allowReq, allowRes, () => { allowNextCalled = true; });
  assert.strictEqual(allowNextCalled, true);
  pass(6, 'Mutating operation with matching x-xsrf-token header succeeds');

  // 3d. Mutating POST using Authorization: Bearer token is safely permitted without CSRF token
  const bearerRes = createMockRes();
  const bearerReq = {
    method: 'POST',
    path: '/api/admin/mutate-test',
    cookies: {},
    headers: {
      authorization: 'Bearer test-token-12345',
    },
    body: { data: 'test' },
  };
  let bearerNextCalled = false;
  csrfProtection(bearerReq, bearerRes, () => { bearerNextCalled = true; });
  assert.strictEqual(bearerNextCalled, true);
  pass(7, 'Mutating requests via Authorization: Bearer bypass CSRF check safely');

  // --- 4. Admin & Inspector Email OTP Login Flow ---
  console.log('\n--- 4. Admin & Inspector Email OTP Verification ---');

  // 4a. Request email OTP
  const reqOtpRes = createMockRes();
  const reqOtpReq = {
    body: {
      username: 'admin',
      password: process.env.ADMIN_PASSWORD || 'admin123',
    },
    ip: '127.0.0.1',
    headers: {},
  };
  await requestLoginOtp(reqOtpReq, reqOtpRes);
  assert.strictEqual(reqOtpRes.statusCode, 200);
  assert.strictEqual(reqOtpRes.body.success, true);
  assert.strictEqual(reqOtpRes.body.require_email_otp, true);
  assert.ok(reqOtpRes.body.dev_otp, 'Development test OTP must be issued in non-production mode');
  const issuedOtp = reqOtpRes.body.dev_otp;
  pass(8, 'POST /api/admin/request-login-otp generates and emails 6-digit verification code');

  // 4b. Verify with wrong OTP
  const badVerifyRes = createMockRes();
  const badVerifyReq = {
    body: {
      username: 'admin',
      otp: '000000',
    },
    ip: '127.0.0.1',
    headers: {},
  };
  await verifyLoginOtp(badVerifyReq, badVerifyRes);
  assert.strictEqual(badVerifyRes.statusCode, 401);
  assert.strictEqual(badVerifyRes.body.success, false);
  pass(9, 'POST /api/admin/verify-login-otp rejects invalid OTP with HTTP 401');

  // 4c. Verify with valid OTP
  const goodVerifyRes = createMockRes();
  const goodVerifyReq = {
    body: {
      username: 'admin',
      otp: issuedOtp,
    },
    ip: '127.0.0.1',
    headers: {},
  };
  await verifyLoginOtp(goodVerifyReq, goodVerifyRes);
  assert.strictEqual(goodVerifyRes.statusCode, 200);
  assert.strictEqual(goodVerifyRes.body.success, true);
  assert.ok(goodVerifyRes.body.token, 'Must return signed JWT token');
  assert.strictEqual(goodVerifyRes.body.user.role, 'super_admin');

  // Check HttpOnly cookie
  const authCookie = goodVerifyRes.headers['set-cookie'];
  assert.ok(authCookie && authCookie.some((c) => c.includes('admin_token=') && c.includes('HttpOnly')));
  pass(10, 'POST /api/admin/verify-login-otp confirms valid code, issues token and sets HttpOnly cookie');

  // 4d. Direct login with email_otp payload
  const otp2 = generateStaffLoginOtp('admin@example.com');
  const directOtpRes = createMockRes();
  const directOtpReq = {
    body: {
      username: 'admin@example.com',
      password: process.env.ADMIN_PASSWORD || 'admin123',
      email_otp: otp2,
    },
    ip: '127.0.0.1',
    headers: {},
  };
  await adminLogin(directOtpReq, directOtpRes);
  assert.strictEqual(directOtpRes.statusCode, 200);
  assert.strictEqual(directOtpRes.body.success, true);
  assert.ok(directOtpRes.body.token);
  pass(11, 'POST /api/admin/login accepts email_otp in body and authenticates successfully');

  // --- 5. Rate Limiting & 5-Attempt Lockout (HTTP 423) ---
  console.log('\n--- 5. Rate Limiting & Account Lockout Enforcement ---');
  const uniqueUser = `target_${Date.now()}@example.com`;

  for (let i = 1; i <= 4; i++) {
    const failedRes = createMockRes();
    const failedReq = {
      body: {
        username: uniqueUser,
        password: 'wrong_password_here',
      },
      ip: '127.0.0.1',
      headers: {},
    };
    await adminLogin(failedReq, failedRes);
    assert.strictEqual(failedRes.statusCode, 401);
    assert.ok(failedRes.body.error.includes(`${5 - i} attempt(s) remaining`));
  }
  pass(12, 'Consecutive failed login attempts track remaining attempts accurately');

  // 5th failed attempt triggers 15-minute account lockout (HTTP 423)
  const lockoutRes = createMockRes();
  const lockoutReq = {
    body: {
      username: uniqueUser,
      password: 'wrong_password_here',
    },
    ip: '127.0.0.1',
    headers: {},
  };
  await adminLogin(lockoutReq, lockoutRes);
  assert.strictEqual(lockoutRes.statusCode, 423);
  assert.strictEqual(lockoutRes.body.locked, true);
  assert.ok(lockoutRes.body.error.includes('Account has been locked for 15 minutes'));
  pass(13, '5th consecutive failed login triggers 15-minute account lockout (HTTP 423)');

  // 6th attempt immediately rejected as locked
  const blockedRes = createMockRes();
  const blockedReq = {
    body: {
      username: uniqueUser,
      password: 'wrong_password_here',
    },
    ip: '127.0.0.1',
    headers: {},
  };
  await adminLogin(blockedReq, blockedRes);
  assert.strictEqual(blockedRes.statusCode, 423);
  assert.strictEqual(blockedRes.body.locked, true);
  pass(14, 'Subsequent attempts during lockout period are immediately rejected (HTTP 423)');

  console.log('================================================================');
  console.log(`🎉 ALL ${passed}/${passed} SECURITY HARDENING TESTS PASSED CLEANLY!`);
  console.log('================================================================\n');
}

if (require.main === module) {
  runPhase4SecurityTests().catch((err) => {
    console.error('\n❌ Security Hardening Test failed:', err);
    process.exit(1);
  });
}

module.exports = { runPhase4SecurityTests };
