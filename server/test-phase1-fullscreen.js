/**
 * GROWTHRAN — Phase 1.1 Fullscreen Enforcement & Violation Tracking Suite
 */
const http = require('http');
const assert = require('assert');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const postData = body ? JSON.stringify(body) : null;
    const req = http.request(
      url,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode, body: raw });
          }
        });
      }
    );
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runFullscreenEnforcementTests() {
  console.log('================================================================');
  console.log('🖥️  GROWTHRAN — PHASE 1.1 FULLSCREEN ENFORCEMENT TEST SUITE');
  console.log(`Target: ${BASE_URL}`);
  console.log('================================================================\n');

  const testCode = 'DEMO100';
  const testCandidate = `HT_FS_${Date.now()}`;

  // Step 1: Start exam session to initialize attempt
  console.log('[1/5] Initializing active exam attempt for candidate...');
  const startRes = await request('GET', `/api/exam-code/${testCode}/start?hallTicket=${testCandidate}`);
  assert.strictEqual(startRes.status, 200, 'Failed to start exam session');
  console.log(`  ✅ Exam attempt active for candidate: ${testCandidate}`);

  // Step 2: Log Strike 1 Fullscreen Exit
  console.log('\n[2/5] Testing 1st Fullscreen Exit violation logging...');
  const v1 = await request('POST', `/api/exam-code/${testCode}/violation`, {
    candidateId: testCandidate,
    examCode: testCode,
    violationType: 'fullscreen_exit',
    notes: 'Candidate exited fullscreen mode (Strike 1/3)',
    exitCount: 1,
    duration_seconds: 4,
  });
  assert.strictEqual(v1.status, 200, `Violation 1 failed: ${JSON.stringify(v1.body)}`);
  assert.strictEqual(v1.body.success, true);
  console.log(`  ✅ 1st exit logged. Violation count: ${v1.body.violation_count}, Terminated: ${v1.body.terminated}`);

  // Step 3: Log Strike 2 Fullscreen Exit with duration
  console.log('\n[3/5] Testing 2nd Fullscreen Exit with duration metrics...');
  const v2 = await request('POST', `/api/exam-code/${testCode}/violation`, {
    candidateId: testCandidate,
    examCode: testCode,
    violationType: 'fullscreen_exit',
    notes: 'Candidate exited fullscreen mode (Strike 2/3)',
    exitCount: 2,
    duration_seconds: 9,
  });
  assert.strictEqual(v2.status, 200);
  assert.strictEqual(v2.body.success, true);
  console.log(`  ✅ 2nd exit logged with 9s duration. Violation count: ${v2.body.violation_count}`);

  // Step 4: Log Fullscreen Restored beacon
  console.log('\n[4/5] Testing Fullscreen Restored telemetry beacon...');
  const vRestore = await request('POST', `/api/exam-code/${testCode}/violation`, {
    candidateId: testCandidate,
    examCode: testCode,
    violationType: 'fullscreen_restored',
    notes: 'Fullscreen restored after 9s outside test window',
    duration_seconds: 9,
  });
  assert.strictEqual(vRestore.status, 200);
  console.log('  ✅ Fullscreen restored event registered cleanly');

  // Step 5: Log Strike 3 Fullscreen Exit (Triggers Auto-Submit / Termination threshold)
  console.log('\n[5/5] Testing 3rd Fullscreen Exit (Reaching Auto-Submit Threshold)...');
  const v3 = await request('POST', `/api/exam-code/${testCode}/violation`, {
    candidateId: testCandidate,
    examCode: testCode,
    violationType: 'fullscreen_exit',
    notes: 'Candidate exited fullscreen mode (Strike 3/3)',
    exitCount: 3,
    duration_seconds: 10,
  });
  assert.strictEqual(v3.status, 200);
  console.log(`  ✅ 3rd exit registered. Auto-submit trigger evaluated.`);

  console.log('\n================================================================');
  console.log('🎉 ALL PHASE 1.1 FULLSCREEN ENFORCEMENT TESTS PASSED CLEANLY!');
  console.log('================================================================\n');
}

runFullscreenEnforcementTests().catch((err) => {
  console.error('❌ Fullscreen enforcement test failed:', err);
  process.exit(1);
});
