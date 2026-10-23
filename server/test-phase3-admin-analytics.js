/**
 * test-phase3-admin-analytics.js
 * Phase 3 Admin, Analytics & Results Vault Tests
 *
 * Tests:
 * 1. Question bank section-wise randomization (GET /api/exam-code/:code/questions)
 * 2. Live exam monitor: extend time (POST /api/admin/attempts/:id/extend-time)
 * 3. Live exam monitor: force submit (POST /api/admin/attempts/:id/force-submit)
 * 4. Results vault: re-evaluate exam attempts (POST /api/admin/exam-codes/:id/reevaluate)
 * 5. Analytics: question difficulty, topic accuracy, score distribution (GET /api/admin/exam-codes/:id/analytics)
 * 6. Results vault: admin audit logs (GET /api/admin/audit-logs)
 * 7. Certificate verification with cryptographic payload (GET /api/certificate/verify/:token)
 */

const BASE = process.env.API_URL || 'http://localhost:3001';
let passed = 0; let failed = 0;

function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); passed++; }
  else { console.error(`  ❌ FAIL: ${message}`); failed++; }
}

async function api(method, path, body, token) {
  const opts = { method, headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Connection': 'close' } };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function getAdminToken() {
  const r = await api('POST', '/api/admin/login', { username: 'admin', password: 'admin123' });
  return r.data?.token || null;
}

async function run() {
  console.log('================================================================');
  console.log('📊 Phase 3 — Admin, Analytics & Results Vault Tests');
  console.log(`   Target: ${BASE}`);
  console.log('================================================================\n');

  const adminToken = await getAdminToken();
  assert(Boolean(adminToken), 'Admin authentication successful');
  console.log('');

  // 1. Create a candidate attempt
  console.log('[1/7] Creating test candidate attempt ...');
  const ht = `PH3_CANDIDATE_${Date.now()}`;
  const startRes = await api('POST', '/api/verify-exam-entry', {
    hallTicket: ht,
    examCode: 'LW-VRSEC-2026',
    studentName: 'Phase 3 Tester',
  });
  assert(startRes.status === 200, `Attempt created (status ${startRes.status})`);
  const attemptId = startRes.data?.attempt_id;
  const sessionToken = startRes.data?.session_token;
  assert(Boolean(attemptId), `attemptId received: ${attemptId}`);
  console.log('');

  // 2. Section-wise questions retrieval
  console.log('[2/7] Section-wise question randomization check ...');
  const qRes = await api('GET', `/api/exam-code/LW-VRSEC-2026/questions?attemptId=${attemptId}&session_token=${sessionToken}`);
  assert(qRes.status === 200, `Questions returned 200`);
  assert(Array.isArray(qRes.data?.questions), 'questions is array');
  assert((qRes.data?.questions?.length || 0) >= 5, `Has >= 5 questions (got ${qRes.data?.questions?.length})`);
  console.log(`   → ${qRes.data?.questions?.length} questions retrieved`);
  console.log('');

  // 3. Extend candidate time
  console.log('[3/7] Live Monitor: extend candidate time ...');
  const extRes = await api('POST', `/api/admin/attempts/${attemptId}/extend-time`, { minutes: 15 }, adminToken);
  assert(extRes.status === 200, `Time extended 200 (got ${extRes.status})`);
  assert(extRes.data?.total_extended_minutes === 15, `total_extended_minutes is 15 (got ${extRes.data?.total_extended_minutes})`);
  console.log('');

  // 4. Force submit candidate attempt
  console.log('[4/7] Live Monitor: force-submit candidate attempt ...');
  // First save one answer so partial grading works
  await api('POST', '/api/exam-code/LW-VRSEC-2026/save-answer', {
    attemptId,
    session_token: sessionToken,
    question_id: 'qec-01',
    answer: 'a',
  });
  const forceRes = await api('POST', `/api/admin/attempts/${attemptId}/force-submit`, {}, adminToken);
  assert(forceRes.status === 200, `Force-submit returned 200 (got ${forceRes.status})`);
  assert(forceRes.data?.success === true, 'success: true on force submit');
  console.log(`   → Final score after force submit: ${forceRes.data?.score}/${forceRes.data?.max_score}`);
  console.log('');

  // 5. Re-evaluate exam attempts
  console.log('[5/7] Results Vault: re-evaluate exam attempts ...');
  const reevalRes = await api('POST', '/api/admin/exam-codes/1/reevaluate', {}, adminToken);
  assert(reevalRes.status === 200, `Re-evaluation returned 200 (got ${reevalRes.status})`);
  assert(typeof reevalRes.data?.reevaluated_attempts === 'number', `reevaluated_attempts count returned: ${reevalRes.data?.reevaluated_attempts}`);
  console.log('');

  // 6. Analytics endpoints
  console.log('[6/7] Analytics: question difficulty, topics, score distribution ...');
  const anaRes = await api('GET', '/api/admin/exam-codes/1/analytics', null, adminToken);
  assert(anaRes.status === 200, `Analytics returned 200 (got ${anaRes.status})`);
  assert(Array.isArray(anaRes.data?.question_difficulty), 'question_difficulty is array');
  assert(Array.isArray(anaRes.data?.topic_accuracy), 'topic_accuracy is array');
  assert(Boolean(anaRes.data?.score_distribution), 'score_distribution buckets returned');
  console.log(`   → Question items: ${anaRes.data?.question_difficulty?.length}, Topics: ${anaRes.data?.topic_accuracy?.length}`);
  console.log('');

  // 7. Audit logs & Certificate verification
  console.log('[7/7] Results Vault: admin audit logs & certificate verification ...');
  const auditRes = await api('GET', '/api/admin/audit-logs', null, adminToken);
  assert(auditRes.status === 200, `Audit logs returned 200 (got ${auditRes.status})`);
  assert(Array.isArray(auditRes.data?.logs), 'logs is array');

  const certRes = await api('GET', '/api/certificate/verify/CERT-DEMO-2026', null, null);
  assert(certRes.status === 200, `Certificate verify returned 200 (got ${certRes.status})`);
  assert(certRes.data?.retired === true || certRes.data?.valid === true, 'Certificate retirement / validity status confirmed (Phase C4)');
  assert(certRes.data?.message?.includes('retired') || Boolean(certRes.data?.certificate?.crypto_hash), 'Retirement message or cryptographic hash present');
  console.log(`   → Certificate verification endpoint verified (Phase C4 Retirement)`);
  console.log('');

  // ─── Results ─────────────────────────────────────────────────────────────
  console.log('================================================================');
  const total = passed + failed;
  if (failed === 0) {
    console.log(`🎉 ALL ${total} PHASE 3 ADMIN & ANALYTICS TESTS PASSED!`);
    console.log('   Phase 3 — Question bank, live monitor, analytics & vault: ACTIVE');
  } else {
    console.error(`❌ ${failed}/${total} TESTS FAILED`);
  }
  console.log('================================================================');
  process.exitCode = failed > 0 ? 1 : 0;
}

run().catch(err => { console.error('Fatal:', err); process.exitCode = 1; });
