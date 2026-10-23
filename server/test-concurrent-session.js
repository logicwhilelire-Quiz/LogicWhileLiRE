/**
 * test-concurrent-session.js
 * Phase 1a: Concurrent-session block + Phase 1b: Autosave and resume
 */
const BASE = process.env.API_URL || 'http://localhost:3001';
const EXAM_CODE = 'LW-VRSEC-2026';
let passed = 0; let failed = 0;

function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); passed++; }
  else { console.error(`  ❌ FAIL: ${message}`); failed++; }
}

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json', 'Connection': 'close' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function run() {
  console.log('================================================================');
  console.log('🔒 Phase 1a/1b — Concurrent-Session Block & Autosave Tests');
  console.log(`   Target: ${BASE}`);
  console.log('================================================================\n');

  const ht = `CONC_${Date.now()}`;

  console.log('[1/7] First device: verifyExamEntry ...');
  const r1 = await api('POST', '/api/verify-exam-entry', { hallTicket: ht, examCode: EXAM_CODE, studentName: 'Test Student' });
  assert(r1.status === 200, `Status 200 (got ${r1.status})`);
  assert(r1.data.success === true, 'success: true');
  assert(typeof r1.data.attempt_id === 'string', `attempt_id returned: ${r1.data.attempt_id}`);
  assert(typeof r1.data.session_token === 'string', `session_token returned: ${r1.data.session_token}`);
  assert(r1.data.resumed === false, 'resumed: false for new attempt');
  const attemptId = r1.data.attempt_id; const token1 = r1.data.session_token;
  console.log(`   attempt_id=${attemptId}\n`);

  console.log('[2/7] First device: save-answer (should succeed) ...');
  const r2 = await api('POST', `/api/exam-code/${EXAM_CODE}/save-answer`, { attemptId, question_id: 'qec-01', answer: 'b', current_question_index: 0, session_token: token1 });
  assert(r2.status === 200, `Status 200 (got ${r2.status})`);
  assert(r2.data.saved === true, 'saved: true');
  console.log('');

  console.log('[3/7] Second device: verifyExamEntry (should evict first) ...');
  const r3 = await api('POST', '/api/verify-exam-entry', { hallTicket: ht, examCode: EXAM_CODE, studentName: 'Test Student' });
  assert(r3.status === 200, `Status 200 (got ${r3.status})`);
  assert(r3.data.resumed === true, 'resumed: true (same attempt)');
  assert(typeof r3.data.session_token === 'string', 'new session_token returned');
  const token2 = r3.data.session_token;
  assert(token2 !== token1, 'token2 differs from token1 (eviction occurred)');
  console.log(`   token2=${token2}\n`);

  console.log('[4/7] First device: save-answer with old token (should be SESSION_EVICTED) ...');
  const r4 = await api('POST', `/api/exam-code/${EXAM_CODE}/save-answer`, { attemptId, question_id: 'qec-02', answer: 'c', current_question_index: 1, session_token: token1 });
  assert(r4.status === 409, `Status 409 SESSION_EVICTED (got ${r4.status})`);
  assert(r4.data.code === 'SESSION_EVICTED', `code: SESSION_EVICTED (got ${r4.data.code})`);
  console.log('');

  console.log('[5/7] Second device: save multiple answers ...');
  for (let i = 0; i < 3; i++) {
    const rs = await api('POST', `/api/exam-code/${EXAM_CODE}/save-answer`, { attemptId, question_id: `qec-0${i+1}`, answer: ['a','b','c'][i], current_question_index: i, session_token: token2 });
    assert(rs.status === 200 && rs.data.saved, `Saved answer ${i+1}`);
  }
  console.log('');

  console.log('[6/7] Second device: resume-state (should return saved answers) ...');
  const r6 = await api('GET', `/api/exam-code/${EXAM_CODE}/resume-state?attemptId=${attemptId}&session_token=${token2}`, null);
  assert(r6.status === 200, `Status 200 (got ${r6.status})`);
  assert(r6.data.success === true, 'success: true');
  const savedCount = Object.keys(r6.data.partial_answers || {}).length;
  assert(savedCount >= 3, `partial_answers has ${savedCount} entries (expected >= 3)`);
  assert(r6.data.last_question_index === 2, `last_question_index=2 (got ${r6.data.last_question_index})`);
  console.log('');

  console.log('[7/7] First device: resume-state with stale token (should be SESSION_EVICTED) ...');
  const r7 = await api('GET', `/api/exam-code/${EXAM_CODE}/resume-state?attemptId=${attemptId}&session_token=${token1}`, null);
  assert(r7.status === 409, `Status 409 (got ${r7.status})`);
  assert(r7.data.code === 'SESSION_EVICTED', `code: SESSION_EVICTED (got ${r7.data.code})`);
  console.log('');

  console.log('================================================================');
  const total = passed + failed;
  if (failed === 0) {
    console.log(`🎉 ALL ${total} CONCURRENT SESSION & AUTOSAVE TESTS PASSED!`);
    console.log('   Phase 1a — Concurrent-session eviction: ACTIVE');
    console.log('   Phase 1b — Per-question autosave + resume-state: ACTIVE');
  } else { console.error(`❌ ${failed}/${total} TESTS FAILED`); }
  console.log('================================================================');
  process.exitCode = failed > 0 ? 1 : 0;
}

run().catch(err => { console.error('Fatal:', err); process.exitCode = 1; });
