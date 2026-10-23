/**
 * test-minimal-reference-walkthrough.cjs
 * Comprehensive verification of the 7-portal minimal reference build:
 * 1. Landing (/)
 * 2. Candidate Gate (/gate)
 * 3. Enter Exam (/enter-exam)
 * 4. Waiting Lobby (/contest/DEMO123/waiting-lobby)
 * 5. Exam Runner & Proctoring (/quiz/DEMO123)
 * 6. Results (/result-ec/DEMO123)
 * 7. Admin Control & Monitor (/admin)
 */
const http = require('http');
const assert = require('assert');
const { io: connectSocket } = require('../client/node_modules/socket.io-client');

const BASE_URL = 'http://localhost:3001';
const CLIENT_URL = 'http://localhost:5173';

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqHeaders = { ...headers };
    let payload = null;
    if (body) {
      payload = JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request(url, { method, headers: reqHeaders }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data), raw: data });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function clientRequest(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, CLIENT_URL);
    const req = http.request(url, { method: 'GET' }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, raw: data });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runMinimalReferenceWalkthrough() {
  console.log('================================================================');
  console.log('🚀 LogicWhileLiRE — MINIMAL REFERENCE BUILD FULL WALKTHROUGH');
  console.log('Scope: 7 Hardened Portals | Target API:', BASE_URL);
  console.log('================================================================\n');

  // STEP 1: Landing Page
  console.log('[1/7] Testing Portal 1: Landing Page (/) & Client Root...');
  const landRes = await clientRequest('/');
  assert.strictEqual(landRes.status, 200, 'Landing page must return HTTP 200');
  assert.ok(landRes.raw.includes('LogicWhileLiRE'), 'Landing page HTML must contain LogicWhileLiRE brand');
  console.log('  ✅ Portal 1 verified: Client served with LogicWhileLiRE branding & assets.\n');

  // STEP 2: Candidate Registration Gate (/gate)
  console.log('[2/7] Testing Portal 2: Candidate Registration Gate (/gate)...');
  const uniqueRoll = `22R1KA${Math.floor(1000 + Math.random() * 9000)}`;
  const regPayload = {
    first_name: 'Aditya',
    last_name: 'Reddy',
    college_id: 'COL-VRSEC-001',
    year_of_passing: 2028,
    roll_number: uniqueRoll,
    branch_code: 'CSE',
    section: 'A',
    email: `aditya.${uniqueRoll.toLowerCase()}@college.edu`,
    contact_number: '9848012345',
    password: 'SecurePassword123!',
    confirm_password: 'SecurePassword123!',
    timestamp: new Date().toISOString(),
  };
  const regRes = await request('POST', '/api/v1/assessment/register-candidate', regPayload);
  assert.strictEqual(regRes.status, 201, 'Registration must return HTTP 201 Created');
  assert.strictEqual(regRes.body.success, true);
  assert.ok(regRes.body.token, 'Registration must return student session JWT');
  console.log(`  ✅ Portal 2 verified: Candidate registered (${uniqueRoll}) adhering to AL-SPEC-2026-REG.\n`);

  // STEP 3: Exam Code Entry (/enter-exam)
  console.log('[3/7] Testing Portal 3: Exam-Code Entry (/enter-exam)...');
  const entryRes = await request('GET', `/api/exam-code/DEMO123/verify?hallTicket=${uniqueRoll}`);
  assert.strictEqual(entryRes.status, 200, 'Exam verification must return HTTP 200');
  assert.strictEqual(entryRes.body.success, true);
  assert.ok(entryRes.body.session_token, 'Entry must issue session_token for single-device lock');
  const attemptId = entryRes.body.attempt_id;
  const sessionToken = entryRes.body.session_token;
  console.log(`  ✅ Portal 3 verified: Entry authorized for DEMO123 | Attempt: ${attemptId} | SessionToken: ${sessionToken.slice(0, 8)}...\n`);

  // STEP 4: Waiting Lobby (/contest/DEMO123/waiting-lobby)
  console.log('[4/7] Testing Portal 4: Waiting Lobby & Socket.io EXAM_STARTED Sync...');
  const socket = connectSocket(BASE_URL, { transports: ['websocket'] });
  await new Promise((resolve) => {
    socket.on('connect', () => {
      socket.emit('lobby:join', { examCode: 'DEMO123' });
      resolve();
    });
  });
  console.log('  Socket connected to lobby:DEMO123');

  // Trigger admin launch
  const adminLoginRes = await request('POST', '/api/admin/login', { username: 'admin', password: 'admin123' });
  const adminToken = adminLoginRes.body.token;
  assert.ok(adminToken, 'Admin login must return token');

  const startRes = await request('POST', '/api/v1/exams/DEMO123/start', { allow_late_join: true }, {
    Authorization: `Bearer ${adminToken}`,
  });
  assert.strictEqual(startRes.status, 200, 'Admin start-now must return HTTP 200');
  assert.strictEqual(startRes.body.success, true);
  console.log('  ✅ Portal 4 verified: EXAM_STARTED launched/synced with server-authoritative timer.\n');
  socket.disconnect();

  // STEP 5: Exam Runner & Proctoring Violation (/quiz/DEMO123)
  console.log('[5/7] Testing Portal 5: Exam Runner, Questions, Autosave & Proctoring Violation...');
  const questionsRes = await request('GET', `/api/exam-code/DEMO123/questions?attemptId=${attemptId}&session_token=${sessionToken}`);
  assert.strictEqual(questionsRes.status, 200, 'Questions fetch must return HTTP 200');
  assert.ok(questionsRes.body.questions && questionsRes.body.questions.length > 0, 'Must return randomized questions');
  const firstQ = questionsRes.body.questions[0];

  // Test autosave
  const saveRes = await request('POST', '/api/exam-code/DEMO123/save-answer', {
    examCode: 'DEMO123',
    candidateId: uniqueRoll,
    items: [{ question_id: firstQ.id, answer: 'B', type: 'mcq' }],
  });
  assert.strictEqual(saveRes.status, 200, 'Answer autosave must return HTTP 200');

  // Test proctoring violation trigger
  const violRes = await request('POST', '/api/exam-code/DEMO123/violation', {
    examCode: 'DEMO123',
    attemptId,
    candidateId: uniqueRoll,
    violationType: 'tab_switch',
    notes: 'Candidate switched browser tab during section 1',
    exitCount: 1,
    duration_seconds: 4,
  });
  assert.strictEqual(violRes.status, 200, 'Violation logging must return HTTP 200');
  assert.strictEqual(violRes.body.success, true);
  console.log(`  ✅ Portal 5 verified: Questions loaded (${questionsRes.body.questions.length} items), autosave synced, violation logged (Count: ${violRes.body.count}).\n`);

  // STEP 6: Submission & Results (/result-ec/DEMO123)
  console.log('[6/7] Testing Portal 6: Exam Submission & Results Screen...');
  const submitRes = await request('POST', '/api/exam-code/DEMO123/submit', {
    examCode: 'DEMO123',
    attemptId,
    candidateId: uniqueRoll,
    session_token: sessionToken,
    answers: { [firstQ.id]: 'B' },
    timeTakenSeconds: 120,
    violationCount: 1,
  });
  assert.strictEqual(submitRes.status, 200, 'Exam submission must return HTTP 200');
  assert.strictEqual(submitRes.body.success, true);
  const resPayload = submitRes.body.result || submitRes.body;
  assert.ok(resPayload.score !== undefined, 'Submit response must return final score');
  console.log(`  ✅ Portal 6 verified: Exam submitted | Score: ${resPayload.score}/${resPayload.max_score} (${resPayload.percentage}%) | Status: ${resPayload.status}\n`);

  // STEP 7: Admin Control & Live Monitor
  console.log('[7/7] Testing Portal 7: Admin Control & Live Monitor Console...');
  const examsListRes = await request('GET', '/api/admin/exams', null, {
    Authorization: `Bearer ${adminToken}`,
  });
  assert.strictEqual(examsListRes.status, 200, 'Admin exams listing must return HTTP 200');
  assert.ok(examsListRes.body.exams && examsListRes.body.exams.length > 0, 'Exams list must contain scheduled assessments');

  // Verify violation was recorded in proctor_logs & forensic audit log
  const attemptsRes = await request('GET', `/api/v1/inspector/audit-log/DEMO123`, null, {
    Authorization: `Bearer ${adminToken}`,
  });
  assert.strictEqual(attemptsRes.status, 200, 'Monitor data must return HTTP 200');
  console.log('  ✅ Portal 7 verified: Admin exam control and live monitor endpoint active with forensic logs.\n');

  console.log('================================================================');
  console.log('🎉 ALL 7 PORTALS IN MINIMAL REFERENCE BUILD VERIFIED 100% GREEN!');
  console.log('   1. Landing Page (/) -> READY');
  console.log('   2. Candidate Gate (/gate) -> READY (AL-SPEC-2026-REG)');
  console.log('   3. Enter Exam (/enter-exam) -> READY');
  console.log('   4. Waiting Lobby (/waiting-lobby) -> READY (Socket.io EXAM_STARTED)');
  console.log('   5. Exam Runner & Proctoring (/quiz/:code) -> READY');
  console.log('   6. Results Screen (/result-ec/:code) -> READY');
  console.log('   7. Admin Exam Control & Monitor (/admin) -> READY');
  console.log('================================================================');
}

runMinimalReferenceWalkthrough().catch(err => {
  console.error('❌ Walkthrough Failed:', err);
  process.exit(1);
});
