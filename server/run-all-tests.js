/**
 * run-all-tests.js
 * Cross-platform runner for LogicWhileLiRE backend test suite.
 * Executes all 21 test files sequentially with mock store isolation.
 */
const { execSync } = require('child_process');
const path = require('path');

process.env.TEST_MOCK_ONLY = 'true';
process.env.NODE_ENV = 'test';

const testFiles = [
  'test-phase1-rbac.js',
  'test-phase2-audit.js',
  'test-phase3-backups.js',
  'test-phase4-security-hardening.js',
  'test-phase6-boundaries.js',
  'test-registration-specification.js',
  'test-auth-module.js',
  'test-auth.js',
  'test-parser.js',
  'test-proctoring-sets.js',
  'test-communication.js',
  'test-rebrand-exam-codes.js',
  'test-rebrand-certificates.js',
  'test-phase1-security.js',
  'test-phase2-database.js',
  'test-role-hierarchy.js',
  'test-student-auth.js',
  'test-inspector-flow.js',
  'test-mail-layer.js',
  'test-backup.js',
  'test-section-targeting-and-portal.js',
  'test-admin-is-only-controller.js',
];

console.log('================================================================');
console.log(`🚀 RUNNING FULL TEST SUITE (${testFiles.length} SUITES)`);
console.log('================================================================\n');

let passedCount = 0;
const failures = [];

for (const file of testFiles) {
  console.log(`\n▶️ Executing ${file}...`);
  const validAdminHash =
    process.env.ADMIN_PASSWORD_HASH && process.env.ADMIN_PASSWORD_HASH.startsWith('$2b$')
      ? process.env.ADMIN_PASSWORD_HASH
      : '$2b$12$Y65kU/s0HBji1KPpvVjjh.fXc1.p4T.B35JH3xj82W7Udi6PDGPeu';

  try {
    const output = execSync(`node ${file}`, {
      stdio: 'pipe',
      cwd: __dirname,
      env: {
        ...process.env,
        TEST_MOCK_ONLY: 'true',
        NODE_ENV: 'test',
        PORT: '0',
        ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',
        ADMIN_PASSWORD_HASH: validAdminHash,
        INSPECTOR_USERNAME: process.env.INSPECTOR_USERNAME || 'inspector',
        INSPECTOR_PASSWORD: process.env.INSPECTOR_PASSWORD || '',
        TOTP_ENCRYPTION_KEY: process.env.TOTP_ENCRYPTION_KEY || 'c46153758e5927f0516f2eb1cf60e62fe006b19ee7ba35a1918ec66f37ceb9ff',
        JWT_SECRET: process.env.JWT_SECRET || 'test-secret-mock-jwt-key-2026-xyz',
        ADMIN_JWT_SECRET: process.env.ADMIN_JWT_SECRET || 'test-admin-jwt-key-2026-abc',
        SUPABASE_URL: process.env.SUPABASE_URL || 'https://mock.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-key',
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'mock-anon-key',
      },
    });
    process.stdout.write(output);
    passedCount++;
  } catch (err) {
    const stdout = err.stdout ? err.stdout.toString() : '';
    const stderr = err.stderr ? err.stderr.toString() : '';
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
    console.error(`❌ ${file} failed with exit code ${err.status || 1}: ${err.message || ''}`);
    const lastLines = (stdout + '\n' + stderr)
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.includes('injected env'))
      .slice(-5)
      .join(' | ')
      .replace(/[\r\n]/g, ' ');
    console.log(`::error file=${file},title=Test Failure (${file})::${lastLines || err.message}`);
    failures.push(file);
    break;
  }
}

console.log('\n================================================================');
if (failures.length === 0) {
  console.log(`🎉 ALL ${passedCount}/${testFiles.length} TEST SUITES PASSED CLEANLY!`);
  console.log('================================================================\n');
  process.exit(0);
} else {
  console.error(`❌ ${failures.length} TEST SUITE(S) FAILED: ${failures.join(', ')}`);
  console.log('================================================================\n');
  process.exit(1);
}
