/**
 * LOGICWHILELIRE — Phase 1.2 Dual-Camera / Screen Share Proctoring Test Suite
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

async function runScreenShareTests() {
  console.log('================================================================');
  console.log('🖥️  LOGICWHILELIRE — PHASE 1.2 DUAL-CAMERA & SCREEN SHARE SUITE');
  console.log(`Target: ${BASE_URL}`);
  console.log('================================================================\n');

  const testCode = 'DEMO100';
  const testCandidate = `HT_SS_${Date.now()}`;

  // Step 1: Start exam session
  console.log('[1/4] Starting exam session for candidate...');
  const startRes = await request('GET', `/api/exam-code/${testCode}/start?hallTicket=${testCandidate}`);
  assert.strictEqual(startRes.status, 200);
  console.log(`  ✅ Session started for candidate: ${testCandidate}`);

  // Step 2: Post 30s screen capture thumbnail
  console.log('\n[2/4] Testing periodic 30-second screen capture dispatch...');
  const dummyThumb = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...';
  const thumbRes = await request('POST', `/api/exam-code/${testCode}/screen-thumbnail`, {
    examCode: testCode,
    candidateId: testCandidate,
    thumbnail: dummyThumb,
  });
  assert.strictEqual(thumbRes.status, 200);
  assert.strictEqual(thumbRes.body.success, true);
  console.log('  ✅ Screen capture thumbnail stored successfully');

  // Step 3: Test screen capture validation error
  console.log('\n[3/4] Testing validation error on missing thumbnail data...');
  const badThumb = await request('POST', `/api/exam-code/${testCode}/screen-thumbnail`, {
    examCode: testCode,
    candidateId: testCandidate,
    // missing thumbnail
  });
  assert.strictEqual(badThumb.status, 400);
  console.log('  ✅ Malformed thumbnail payload rejected cleanly (400)');

  // Step 4: Test screen_share_stopped violation logging
  console.log('\n[4/4] Testing screen_share_stopped violation trigger...');
  const stopRes = await request('POST', `/api/exam-code/${testCode}/violation`, {
    candidateId: testCandidate,
    examCode: testCode,
    violationType: 'screen_share_stopped',
    notes: 'Candidate disconnected screen sharing stream',
  });
  assert.strictEqual(stopRes.status, 200);
  assert.strictEqual(stopRes.body.success, true);
  console.log(`  ✅ screen_share_stopped logged. Violation count: ${stopRes.body.violation_count}`);

  console.log('\n================================================================');
  console.log('🎉 ALL PHASE 1.2 DUAL-CAMERA & SCREEN SHARE TESTS PASSED CLEANLY!');
  console.log('================================================================\n');
}

runScreenShareTests().catch((err) => {
  console.error('❌ Screen share test failed:', err);
  process.exit(1);
});
