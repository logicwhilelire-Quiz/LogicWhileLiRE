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
];

console.log('================================================================');
console.log(`🚀 RUNNING FULL TEST SUITE (${testFiles.length} SUITES)`);
console.log('================================================================\n');

let passedCount = 0;
const failures = [];

for (const file of testFiles) {
  console.log(`\n▶️ Executing ${file}...`);
  try {
    execSync(`node ${file}`, {
      stdio: 'inherit',
      cwd: __dirname,
      env: {
        ...process.env,
        TEST_MOCK_ONLY: 'true',
        NODE_ENV: 'test',
        PORT: '0',
      },
    });
    passedCount++;
  } catch (err) {
    console.error(`❌ ${file} failed with exit code ${err.status}`);
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
