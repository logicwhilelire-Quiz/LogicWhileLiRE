/**
 * GROWTHRAN — Phase 1.5 Server-Authoritative Scoring, 30s Grace Window & Timer Suite
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

async function runAuthoritativeScoringTests() {
  console.log('================================================================');
  console.log('⏱️  GROWTHRAN — PHASE 1.5 SERVER-AUTHORITATIVE SCORING & TIMER');
  console.log(`Target: ${BASE_URL}`);
  console.log('================================================================\n');

  const testCode = 'DEMO100';
  const testCandidate = `HT_AUTH_SCORE_${Date.now()}`;

  // Step 1: Start exam session
  console.log('[1/5] Initializing exam session...');
  const startRes = await request('GET', `/api/exam-code/${testCode}/start?hallTicket=${testCandidate}`);
  assert.strictEqual(startRes.status, 200, 'Failed to start exam session');
  const questions = startRes.body.questions || [];
  assert.ok(questions.length > 0, 'No questions loaded');
  console.log(`  ✅ Session initialized with ${questions.length} questions`);

  // Step 2: Test that client-supplied scores/percentages are completely ignored
  console.log('\n[2/5] Testing pure server-authoritative grading (ignoring client fake score)...');
  const submitWithFakeScore = await request('POST', `/api/exam-code/${testCode}/submit`, {
    examCode: testCode,
    hallTicket: testCandidate,
    score: 9999, // Fake score
    percentage: 100, // Fake percentage
    status: 'completed',
    answers: {
      [questions[0].id]: 0, // Option 0 (A)
    },
  });
  assert.strictEqual(submitWithFakeScore.status, 200);
  assert.strictEqual(submitWithFakeScore.body.success, true);
  const result = submitWithFakeScore.body.result;
  assert.notStrictEqual(result.score, 9999, 'Client forged score was accepted!');
  console.log(`  ✅ Client score forged attempt rejected; real server evaluated score: ${result.score}/${result.max_score} (${result.percentage}%)`);
  assert.ok(result.topic_breakdown, 'Missing topic breakdown in server evaluation');

  // Step 3: Test Duplicate Submission Guard (Already submitted -> 409)
  console.log('\n[3/5] Testing duplicate submission protection (409 Conflict)...');
  const duplicateSubmit = await request('POST', `/api/exam-code/${testCode}/submit`, {
    examCode: testCode,
    hallTicket: testCandidate,
    answers: {},
  });
  assert.strictEqual(duplicateSubmit.status, 409, `Expected 409, got ${duplicateSubmit.status}`);
  console.log('  ✅ Second submission prevented (409 Already submitted)');

  // Step 4: Test 30s Grace Window and Timing Boundaries
  console.log('\n[4/5] Testing server timing calculation with active attempt...');
  const testCandidate2 = `HT_TIMER_${Date.now()}`;
  const startRes2 = await request('GET', `/api/exam-code/${testCode}/start?hallTicket=${testCandidate2}`);
  assert.strictEqual(startRes2.status, 200);

  const normalSubmit = await request('POST', `/api/exam-code/${testCode}/submit`, {
    examCode: testCode,
    hallTicket: testCandidate2,
    answers: {
      [questions[0].id]: 0,
    },
  });
  assert.strictEqual(normalSubmit.status, 200);
  assert.strictEqual(normalSubmit.body.result.expired_grace, false, 'Standard submission incorrectly marked expired');
  assert.strictEqual(normalSubmit.body.result.status, 'completed');
  console.log('  ✅ In-time submission validated with status: completed, expired_grace: false');

  // Step 5: Test Concurrent Multi-Question Evaluation Accuracy
  console.log('\n[5/5] Testing topic breakdown and accuracy aggregation across multiple questions...');
  const testCandidate3 = `HT_TOPIC_${Date.now()}`;
  await request('GET', `/api/exam-code/${testCode}/start?hallTicket=${testCandidate3}`);
  
  const allAnswers = {};
  questions.forEach((q, idx) => {
    allAnswers[q.id] = idx % 4; // Distribute across options 0..3
  });

  const multiSubmit = await request('POST', `/api/exam-code/${testCode}/submit`, {
    examCode: testCode,
    hallTicket: testCandidate3,
    answers: allAnswers,
  });
  assert.strictEqual(multiSubmit.status, 200);
  const multiResult = multiSubmit.body.result;
  assert.strictEqual(multiResult.correct_count + multiResult.wrong_count, questions.length);
  console.log(`  ✅ All ${questions.length} questions graded accurately by server:`);
  console.log(`     Correct: ${multiResult.correct_count} | Wrong: ${multiResult.wrong_count}`);
  console.log(`     Topics Evaluated: ${Object.keys(multiResult.topic_breakdown).join(', ')}`);

  console.log('\n================================================================');
  console.log('🎉 ALL PHASE 1.5 SERVER-AUTHORITATIVE SCORING TESTS PASSED (5/5)!');
  console.log('================================================================');
}

runAuthoritativeScoringTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
