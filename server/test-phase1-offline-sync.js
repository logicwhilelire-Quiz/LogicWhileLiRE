/**
 * LOGICWHILELIRE — Phase 1.4 Offline Resilience, IndexedDB Sync Queue & Answer Recovery Test Suite
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

async function runOfflineSyncTests() {
  console.log('================================================================');
  console.log('📡  LOGICWHILELIRE — PHASE 1.4 OFFLINE RESILIENCE & SYNC TEST SUITE');
  console.log(`Target: ${BASE_URL}`);
  console.log('================================================================\n');

  const testCode = 'DEMO100';
  const testCandidate = `HT_OFFLINE_${Date.now()}`;

  // Step 1: Start exam session to initialize attempt
  console.log('[1/5] Initializing active exam attempt for candidate...');
  const startRes = await request('GET', `/api/exam-code/${testCode}/start?hallTicket=${testCandidate}`);
  assert.strictEqual(startRes.status, 200, 'Failed to start exam session');
  const questions = startRes.body.questions || [];
  assert.ok(questions.length > 0, 'No questions returned for exam session');
  console.log(`  ✅ Exam session active with ${questions.length} questions for ${testCandidate}`);

  const q1 = questions[0].id;
  const q2 = questions.length > 1 ? questions[1].id : 'q-dummy-2';
  const q3 = questions.length > 2 ? questions[2].id : 'q-dummy-3';

  // Step 2: Test Single Answer Auto-Save
  console.log('\n[2/5] Testing single answer auto-save via candidateId lookup...');
  const save1 = await request('POST', `/api/exam-code/${testCode}/save-answer`, {
    examCode: testCode,
    candidateId: testCandidate,
    question_id: q1,
    answer: 0,
    current_question_index: 0,
  });
  assert.strictEqual(save1.status, 200, `Save 1 failed: ${JSON.stringify(save1.body)}`);
  assert.strictEqual(save1.body.success, true);
  assert.strictEqual(save1.body.total_saved >= 1, true);
  console.log(`  ✅ Single answer autosaved for question ${q1} (total saved: ${save1.body.total_saved})`);

  // Step 3: Test Batch Offline Buffer Flush (Sync Queue Simulation)
  console.log('\n[3/5] Testing batch offline buffer flush with multiple buffered answers...');
  const offlineBatch = [
    { question_id: q2, answer: 1, type: 'mcq' },
    { question_id: q3, answer: 2, type: 'mcq' },
  ];
  const saveBatch = await request('POST', `/api/exam-code/${testCode}/save-answer`, {
    examCode: testCode,
    candidateId: testCandidate,
    items: offlineBatch,
  });
  assert.strictEqual(saveBatch.status, 200, `Batch save failed: ${JSON.stringify(saveBatch.body)}`);
  assert.strictEqual(saveBatch.body.success, true);
  assert.strictEqual(saveBatch.body.total_saved >= 3, true);
  console.log(`  ✅ Batch buffer flush successful! Total saved on server: ${saveBatch.body.total_saved}`);

  // Step 4: Test Resume-State Recovery after tab reload / network reconnection
  console.log('\n[4/5] Testing /resume-state answer recovery on reconnection...');
  const resumeRes = await request('GET', `/api/exam-code/${testCode}/resume-state?candidateId=${testCandidate}`);
  assert.strictEqual(resumeRes.status, 200, `Resume state failed: ${JSON.stringify(resumeRes.body)}`);
  assert.strictEqual(resumeRes.body.success, true);
  const recoveredAnswers = resumeRes.body.partial_answers || {};
  assert.strictEqual(String(recoveredAnswers[q1]), '0', 'Answer for Q1 mismatch');
  assert.strictEqual(String(recoveredAnswers[q2]), '1', 'Answer for Q2 mismatch');
  assert.strictEqual(String(recoveredAnswers[q3]), '2', 'Answer for Q3 mismatch');
  console.log('  ✅ Recovered all 3 candidate answers from server state:');
  console.log('    ', recoveredAnswers);

  // Step 5: Test Resilient Final Exam Submission with All Answers
  console.log('\n[5/5] Testing final exam submission with synced answers...');
  const submitRes = await request('POST', `/api/exam-code/${testCode}/submit`, {
    examCode: testCode,
    hallTicket: testCandidate,
    answers: {
      [q1]: 0,
      [q2]: 1,
      [q3]: 2,
    },
    codeAnswers: {},
  });
  assert.strictEqual(submitRes.status, 200, `Submit failed: ${JSON.stringify(submitRes.body)}`);
  assert.strictEqual(submitRes.body.success, true);
  console.log(`  ✅ Final submission successful! Score: ${submitRes.body.result?.score}/${submitRes.body.result?.max_score}`);

  console.log('\n================================================================');
  console.log('🎉 ALL PHASE 1.4 OFFLINE RESILIENCE & SYNC TESTS PASSED (5/5)!');
  console.log('================================================================');
}

runOfflineSyncTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
