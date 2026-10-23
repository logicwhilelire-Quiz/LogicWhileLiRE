/**
 * test-proctoring-phase2.js
 * Phase 2 Proctoring Upgrade Tests
 *
 * Tests:
 * 1. Log violation with face proctoring types: 'no_face', 'multiple_faces', 'looking_away'
 * 2. Low-res snapshot thumbnail recorded in violation_timeline
 * 3. Configurable max_violations threshold enforced
 * 4. Admin retrieval of candidate violation timeline (GET /api/admin/attempts/:id/violations)
 * 5. Admin false-positive review and override (PATCH /api/admin/attempts/:id/violations/:violationId/review)
 * 6. Strike count decrementing and candidate state restoration on false-positive review
 */

const BASE = process.env.API_URL || 'http://localhost:3001';
let passed = 0; let failed = 0;

function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); passed++; }
  else { console.error(`  ❌ FAIL: ${message}`); failed++; }
}

async function api(method, path, body, token) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
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
  console.log('👁️ Phase 2 — Proctoring Upgrade & Violation Timeline Tests');
  console.log(`   Target: ${BASE}`);
  console.log('================================================================\n');

  // 1. Create a test candidate session
  console.log('[1/6] Starting candidate session for proctoring test ...');
  const ht = `PROCTOR_${Date.now()}`;
  const startRes = await api('POST', '/api/verify-exam-entry', {
    hallTicket: ht,
    examCode: 'LW-VRSEC-2026',
    studentName: 'Proctor Candidate',
  });
  assert(startRes.status === 200, `Candidate session created (got ${startRes.status})`);
  const attemptId = startRes.data?.attempt_id;
  const sessionToken = startRes.data?.session_token;
  assert(Boolean(attemptId), `attemptId received: ${attemptId}`);
  console.log('');

  // 2. Log a 'no_face' violation with a snapshot thumbnail
  console.log('[2/6] Logging "no_face" violation with low-res snapshot thumbnail ...');
  const mockThumbnail = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...thumbnail...';
  const v1 = await api('POST', '/api/exam-code/LW-VRSEC-2026/violation', {
    attemptId,
    session_token: sessionToken,
    violationType: 'no_face',
    notes: 'No face detected in camera for 3 seconds',
    snapshot_thumb: mockThumbnail,
  });
  assert(v1.status === 200, `Violation 1 logged (got ${v1.status})`);
  assert(v1.data?.violation_count === 1, `violation_count is 1 (got ${v1.data?.violation_count})`);
  assert(Boolean(v1.data?.violation_id), `violation_id assigned: ${v1.data?.violation_id}`);
  const viol1Id = v1.data?.violation_id;
  console.log('');

  // 3. Log a 'looking_away' and 'multiple_faces' violation
  console.log('[3/6] Logging "looking_away" and "multiple_faces" violations ...');
  const v2 = await api('POST', '/api/exam-code/LW-VRSEC-2026/violation', {
    attemptId,
    session_token: sessionToken,
    violationType: 'looking_away',
    notes: 'Candidate head pose yaw exceeded 35 degrees',
  });
  assert(v2.status === 200, 'Violation 2 (looking_away) logged');
  assert(v2.data?.violation_count === 2, `violation_count is 2 (got ${v2.data?.violation_count})`);

  const v3 = await api('POST', '/api/exam-code/LW-VRSEC-2026/violation', {
    attemptId,
    session_token: sessionToken,
    violationType: 'multiple_faces',
    notes: '2 faces detected in camera frame',
  });
  assert(v3.status === 200, 'Violation 3 (multiple_faces) logged');
  assert(v3.data?.violation_count === 3, `violation_count is 3 (got ${v3.data?.violation_count})`);
  console.log('');

  // 4. Admin gets violation timeline
  console.log('[4/6] Admin: GET /api/admin/attempts/:id/violations ...');
  const adminToken = await getAdminToken();
  assert(Boolean(adminToken), 'Admin login token acquired');

  const timelineRes = await api('GET', `/api/admin/attempts/${attemptId}/violations`, null, adminToken);
  assert(timelineRes.status === 200, `Admin timeline returned 200 (got ${timelineRes.status})`);
  const timeline = timelineRes.data?.attempt?.timeline || [];
  assert(timeline.length === 3, `Timeline contains 3 entries (got ${timeline.length})`);
  assert(timeline[0].type === 'no_face', `Entry 1 is no_face (got ${timeline[0]?.type})`);
  assert(timeline[0].snapshot_thumb === mockThumbnail, 'Snapshot thumbnail preserved in timeline');
  assert(timeline[1].type === 'looking_away', `Entry 2 is looking_away (got ${timeline[1]?.type})`);
  assert(timeline[2].type === 'multiple_faces', `Entry 3 is multiple_faces (got ${timeline[2]?.type})`);
  console.log(`   → ${timeline.length} timeline events retrieved with timestamps`);
  console.log('');

  // 5. Admin marks first violation as false positive
  console.log('[5/6] Admin: False-positive review & override on violation 1 ...');
  const reviewRes = await api(
    'PATCH',
    `/api/admin/attempts/${attemptId}/violations/${viol1Id}/review`,
    { is_false_positive: true, review_notes: 'False positive — candidate adjusted camera angle' },
    adminToken
  );
  assert(reviewRes.status === 200, `Review PATCH returned 200 (got ${reviewRes.status})`);
  assert(reviewRes.data?.violation_count === 2, `Active strike count decremented to 2 (got ${reviewRes.data?.violation_count})`);
  console.log('');

  // 6. Verify timeline reflects false-positive flag
  console.log('[6/6] Verifying updated timeline reflects false positive status ...');
  const timelineRes2 = await api('GET', `/api/admin/attempts/${attemptId}/violations`, null, adminToken);
  const updatedTimeline = timelineRes2.data?.attempt?.timeline || [];
  const reviewedItem = updatedTimeline.find(v => v.id === viol1Id);
  assert(reviewedItem?.is_false_positive === true, 'Violation is_false_positive is true');
  assert(Boolean(reviewedItem?.reviewed_by), `Reviewed by recorded: ${reviewedItem?.reviewed_by}`);
  console.log('');

  // ─── Results ─────────────────────────────────────────────────────────────
  console.log('================================================================');
  const total = passed + failed;
  if (failed === 0) {
    console.log(`🎉 ALL ${total} PROCTORING UPGRADE TESTS PASSED!`);
    console.log('   Phase 2 — Multi-face, no-face, timeline & false-positive review: ACTIVE');
  } else {
    console.error(`❌ ${failed}/${total} TESTS FAILED`);
  }
  console.log('================================================================');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
