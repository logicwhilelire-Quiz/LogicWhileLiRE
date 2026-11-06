/**
 * LogicWhileLiRE — 2FA & Authenticator Enforcement Test Suite
 *
 * Requirements:
 * 1. Staff account with `is_2fa_enabled: true` MUST fail full login without a TOTP code (must return require_2fa: true, NO auth token).
 * 2. Staff account with `is_2fa_enabled: true` MUST reject invalid TOTP codes (401 Unauthorized, NO auth token).
 * 3. Staff account with `is_2fa_enabled: true` MUST reject invalid recovery codes (401 Unauthorized, NO auth token).
 * 4. Staff account with `is_2fa_enabled: true` MUST succeed with a valid TOTP code.
 * 5. Staff account with `is_2fa_enabled: true` MUST succeed with a valid backup recovery code.
 * 6. Staff account with `is_2fa_enabled: false` logs in directly without requiring 2FA code.
 *
 * Constraint: Zero database writes. Runs using self-contained express pipeline.
 */

const assert = require('assert');
const http = require('http');
const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DEMO_MODE = 'false';
process.env.ADMIN_JWT_SECRET = 'test-admin-jwt-secret-key-32chars-min-length-2026';
process.env.TOTP_ENCRYPTION_KEY = 'c46153758e5927f0516f2eb1cf60e62fe006b19ee7ba35a1918ec66f37ceb9ff';

const { encryptTotpSecret, generateTotpSecret, generateBackupCodes } = require('./dist/utils/totp');
const { adminLogin } = require('./dist/controllers/adminController');
const { supabase } = require('./dist/db/supabase');

// Generate an RFC 6238 TOTP code for testing valid code submission
function getTotpCode(secretBase32, timeStepOffset = 0) {
  const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (let i = 0; i < secretBase32.length; i++) {
    const val = BASE32_ALPHABET.indexOf(secretBase32[i].toUpperCase());
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  const key = Buffer.from(bytes);
  const epoch = Math.floor(Date.now() / 1000);
  const timeStep = Math.floor(epoch / 30) + timeStepOffset;

  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigInt64BE(BigInt(timeStep), 0);

  const hmac = crypto.createHmac('sha1', key).update(timeBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

function sendLoginRequest(serverPort, payload) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/admin/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data || '{}');
          } catch {
            parsed = { raw: data };
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

async function run2faEnforcementTests() {
  console.log('================================================================');
  console.log('🛡️  LogicWhileLiRE — 2FA & AUTHENTICATOR ENFORCEMENT TEST SUITE');
  console.log('================================================================\n');

  const testPassword = 'SecureAdminPassword2026!';
  const testPasswordHash = await bcrypt.hash(testPassword, 10);

  const plainTotpSecret = generateTotpSecret();
  const encryptedTotp = encryptTotpSecret(plainTotpSecret);
  const backupCodes = generateBackupCodes(4);

  // In-memory staff fixture with is_2fa_enabled: true
  const staff2faActive = {
    id: 'st-test-2fa-enabled-001',
    name: '2FA Protected Super Admin',
    email: 'admin.2fa@logicwhilelire.com',
    password_hash: testPasswordHash,
    role: 'super_admin',
    is_active: true,
    is_2fa_enabled: true, // Key flag under test
    totp_secret: encryptedTotp,
    two_factor_backup_codes: backupCodes.hashed,
    failed_attempts: 0,
    locked_until: null,
  };

  // In-memory staff fixture with is_2fa_enabled: false
  const staff2faInactive = {
    id: 'st-test-2fa-disabled-002',
    name: 'Standard Staff Admin',
    email: 'admin.no2fa@logicwhilelire.com',
    password_hash: testPasswordHash,
    role: 'faculty',
    is_active: true,
    is_2fa_enabled: false, // 2FA disabled
    totp_secret: null,
    two_factor_backup_codes: [],
    failed_attempts: 0,
    locked_until: null,
  };

  // Create an isolated Express application mounting adminLogin
  const app = express();
  app.use(express.json());
  app.post('/api/admin/login', adminLogin);

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = server.address().port;

  // Intercept supabase.from('staff') SELECT queries to return mock fixtures without writing to DB
  const originalFrom = supabase.from.bind(supabase);
  supabase.from = function (table) {
    if (table === 'staff') {
      return {
        select: function () {
          return {
            eq: function (field, value) {
              return {
                maybeSingle: async function () {
                  if (field === 'role' && value === 'super_admin') {
                    return { data: staff2faActive, error: null };
                  }
                  if (field === 'email' && value === 'admin.2fa@logicwhilelire.com') {
                    return { data: staff2faActive, error: null };
                  }
                  if (field === 'email' && value === 'admin.no2fa@logicwhilelire.com') {
                    return { data: staff2faInactive, error: null };
                  }
                  return { data: null, error: null };
                },
                single: async function () {
                  return { data: staff2faActive, error: null };
                },
              };
            },
            maybeSingle: async function () {
              return { data: staff2faActive, error: null };
            },
          };
        },
        update: function (updateData) {
          return {
            eq: function () {
              return Promise.resolve({ data: updateData, error: null });
            },
          };
        },
      };
    }
    if (table === 'audit_log') {
      return {
        insert: function () {
          return Promise.resolve({ error: null });
        },
      };
    }
    return originalFrom(table);
  };

  let passed = 0;

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // TEST 1: Missing TOTP Code Rejection when is_2fa_enabled = true
    // ──────────────────────────────────────────────────────────────────────────
    console.log('[TEST 1] Testing login with valid password but NO 2FA code (is_2fa_enabled = true)...');
    const res1 = await sendLoginRequest(port, {
      username: 'admin.2fa@logicwhilelire.com',
      password: testPassword,
    });

    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res1.body.success, true);
    assert.strictEqual(res1.body.require_2fa, true, 'Response MUST indicate require_2fa: true');
    assert.strictEqual(res1.body.token, undefined, 'Access token MUST NOT be issued without 2FA code');
    console.log('  ✅ Access token withheld. System prompted: "Two-Factor Authentication code required".');
    passed++;

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 2: Invalid TOTP Code Rejection when is_2fa_enabled = true
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[TEST 2] Testing login with valid password but INVALID 2FA code ("000000")...');
    const res2 = await sendLoginRequest(port, {
      username: 'admin.2fa@logicwhilelire.com',
      password: testPassword,
      totp_code: '000000',
    });

    assert.strictEqual(res2.status, 401, 'Invalid TOTP code MUST return HTTP 401 Unauthorized');
    assert.strictEqual(res2.body.success, false);
    assert.strictEqual(res2.body.token, undefined, 'Access token MUST NOT be issued with invalid 2FA code');
    assert(res2.body.error.includes('Invalid credentials'), 'Error message must reflect invalid credentials');
    console.log('  ✅ HTTP 401 returned. Invalid 2FA code successfully rejected.');
    passed++;

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 3: Invalid Recovery Backup Code Rejection
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[TEST 3] Testing login with valid password but INVALID recovery backup code ("INVALID-CODE")...');
    const res3 = await sendLoginRequest(port, {
      username: 'admin.2fa@logicwhilelire.com',
      password: testPassword,
      totp_code: 'INVALID-CODE',
    });

    assert.strictEqual(res3.status, 401, 'Invalid recovery backup code MUST return HTTP 401 Unauthorized');
    assert.strictEqual(res3.body.token, undefined);
    console.log('  ✅ HTTP 401 returned. Invalid backup code rejected.');
    passed++;

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 4: Valid TOTP Authenticator Code Acceptance
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[TEST 4] Testing login with valid password and VALID RFC 6238 TOTP code...');
    const validTotp = getTotpCode(plainTotpSecret);
    const res4 = await sendLoginRequest(port, {
      username: 'admin.2fa@logicwhilelire.com',
      password: testPassword,
      totp_code: validTotp,
    });

    assert.strictEqual(res4.status, 200, 'Valid TOTP code MUST return HTTP 200 OK');
    assert.strictEqual(res4.body.success, true);
    assert.ok(res4.body.token, 'Valid 2FA login MUST issue a signed admin session JWT');
    assert.strictEqual(res4.body.user.is_2fa_enabled, true, 'User payload must confirm is_2fa_enabled: true');
    console.log('  ✅ HTTP 200 returned. Signed JWT issued. Authenticator verification passed.');
    passed++;

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 5: Valid Recovery Backup Code Acceptance
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[TEST 5] Testing login with valid password and VALID single-use emergency backup code...');
    const validBackupCode = backupCodes.plain[0];
    const res5 = await sendLoginRequest(port, {
      username: 'admin.2fa@logicwhilelire.com',
      password: testPassword,
      totp_code: validBackupCode,
    });

    assert.strictEqual(res5.status, 200, 'Valid backup recovery code MUST return HTTP 200 OK');
    assert.strictEqual(res5.body.success, true);
    assert.ok(res5.body.token, 'Emergency backup login MUST issue a signed admin session JWT');
    console.log('  ✅ HTTP 200 returned. Emergency recovery code accepted and consumed.');
    passed++;

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 6: Direct Login for Account with is_2fa_enabled = false
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[TEST 6] Testing login for standard account with is_2fa_enabled = false...');
    const res6 = await sendLoginRequest(port, {
      username: 'admin.no2fa@logicwhilelire.com',
      password: testPassword,
    });

    assert.strictEqual(res6.status, 200);
    assert.strictEqual(res6.body.success, true);
    assert.ok(res6.body.token, 'Direct login MUST issue token immediately when 2FA is not enabled');
    assert.strictEqual(res6.body.user.is_2fa_enabled, false);
    console.log('  ✅ HTTP 200 returned. Direct login granted without 2FA challenge.');
    passed++;

    console.log('\n================================================================');
    console.log(`🎉 ALL ${passed}/6 2FA ENFORCEMENT & SECURITY TESTS PASSED!`);
    console.log('================================================================');
  } finally {
    // Restore original supabase.from and close server
    supabase.from = originalFrom;
    server.close();
  }
}

run2faEnforcementTests().catch((err) => {
  console.error('\n❌ Test suite failed with error:', err);
  process.exit(1);
});
