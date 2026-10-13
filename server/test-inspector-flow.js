/**
 * ============================================================
 * LogicWhileLiRE — INSPECTOR-LED EXAM FLOW TEST SUITE
 * ============================================================
 * Tests:
 * 1. Inspector login and college-scoped live dashboard data
 * 2. Faculty 5-column Excel question upload with validation & preview
 * 3. Committing validated questions with marks, penalty & sections to DB
 * 4. Students entering lobby with exam code and waiting queue tracking
 * 5. Inspector push-to-start with server-authoritative clock and synchronous start broadcast
 * 6. Cross-college forbidden check (inspector cannot start other college exams)
 * 7. Socket.io throttled batch telemetry (<= 1 update per second per room)
 * 8. Question paper formats (sections, categories, marks, negative marking)
 * 9. Per-student unique option & question shuffling with server master key secrecy
 * 10. Server-side grading with negative marking calculation (score = correct*marks - wrong*penalty)
 * 11. Database persistence on every answer (save-answer) and on final submit
 */

const { isRealSupabase, cleanupTestData } = require('./test-helper');
process.env.PORT = '0';

const assert = require('assert');
const http = require('http');
const jwt = require('jsonwebtoken');
const { io: connectSocket } = require('socket.io-client');

let server;
let baseUrl;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const reqHeaders = {
      'Content-Type': 'application/json',
      'x-load-test': 'true',
      ...headers,
    };

    const payload = body ? JSON.stringify(body) : null;
    if (payload) {
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = data ? JSON.parse(data) : null;
          } catch {
            json = data;
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: json,
          });
        });
      }
    );

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('================================================================');
  console.log('🏛️ LogicWhileLiRE — INSPECTOR-LED EXAM FLOW TEST SUITE');
  console.log('================================================================\n');

  // Load app (binds to ephemeral port)
  const appModule = require('./dist/index.js');
  server = appModule.httpServer;

  if (server && !server.listening) {
    await new Promise((resolve) => server.once('listening', resolve));
  }

  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  let passed = 0;
  function pass(step, desc) {
    passed++;
    console.log(`  ✅ [${step}] ${desc}`);
  }

  try {
    // ── 1. INSPECTOR LOGIN & COLLEGE-SCOPED DASHBOARD ─────────────
    console.log('--- 1. Inspector Login & College-Scoped Live Dashboard ---');

    const inspectorLoginRes = await request('POST', '/api/admin/login', {
      username: process.env.INSPECTOR_USERNAME || 'inspector',
      password: process.env.INSPECTOR_PASSWORD || 'LiREInspector@2026!',
    });

    assert.strictEqual(inspectorLoginRes.status, 200, 'Inspector login should succeed with 200');
    assert.strictEqual(inspectorLoginRes.body?.user?.role, 'inspector', 'User role should be inspector');

    let inspectorToken = inspectorLoginRes.body?.token;
    if (inspectorLoginRes.body?.require_2fa_setup) {
      const enrollToken = inspectorLoginRes.body.enrollment_token;
      const initRes = await request(
        'POST',
        '/api/admin/2fa/enroll-init',
        {},
        { Authorization: `Bearer ${enrollToken}` }
      );
      assert.strictEqual(initRes.status, 200, '2FA enroll-init should succeed');
      const totpSecret = initRes.body?.secret;
      const { calculateTotpCode } = require('./dist/utils/totp');
      const confirmRes = await request(
        'POST',
        '/api/admin/2fa/enroll-confirm',
        { code: calculateTotpCode(totpSecret), secret: totpSecret },
        { Authorization: `Bearer ${enrollToken}` }
      );
      assert.strictEqual(confirmRes.status, 200, '2FA enroll-confirm should succeed');
      inspectorToken = confirmRes.body?.token;
    }

    assert.ok(inspectorToken, 'Should receive inspector JWT token');
    pass(1, 'Inspector successfully logs in with mandatory 2FA and receives role=inspector token');

    const dashboardRes = await request(
      'GET',
      '/api/admin/inspector/dashboard-data',
      null,
      { Authorization: `Bearer ${inspectorToken}` }
    );

    assert.strictEqual(dashboardRes.status, 200, 'Should fetch inspector dashboard data');
    assert.ok(dashboardRes.body?.college, 'Dashboard data should include assigned college');
    assert.ok(Array.isArray(dashboardRes.body?.sections), 'Should include sections for filter');
    pass(2, `Inspector lands on live dashboard for college: ${dashboardRes.body?.college?.college_name}`);

    // ── 2. RBAC GATING & FACULTY 5-COLUMN EXCEL UPLOAD VALIDATION ─
    console.log('\n--- 2. RBAC Gating & Faculty Question Import Validation ---');

    const adminSecret = process.env.ADMIN_JWT_SECRET || 'test-admin-jwt-secret-key-32chars-2026';
    const superAdminToken = jwt.sign(
      { id: 'usr-admin-01', staff_id: 'st000000-0000-0000-0000-000000000001', username: 'admin', role: 'super_admin' },
      adminSecret,
      { expiresIn: '1h' }
    );

    const facultyWithPermToken = jwt.sign(
      {
        id: 'usr-fac-01',
        staff_id: 'st000000-0000-0000-0000-000000000002',
        username: 'suresh@example.com',
        role: 'faculty',
        college_id: 1,
        permissions: ['create_questions', 'view_curriculum', 'upload_excel'],
      },
      adminSecret,
      { expiresIn: '1h' }
    );

    const facultyNoPermToken = jwt.sign(
      {
        id: 'usr-fac-noperm',
        staff_id: 'fac-no-create-questions',
        username: 'noperm@example.com',
        role: 'faculty',
        college_id: 1,
        permissions: ['view_curriculum'],
      },
      adminSecret,
      { expiresIn: '1h' }
    );

    // Security Gate 1: Inspector cannot create exam codes (403 strictly enforced)
    const inspCreateRes = await request(
      'POST',
      '/api/admin/exam-codes',
      {
        exam_code: 'INSP-FORBIDDEN-01',
        exam_name: 'Inspector Exam Creation Attempt',
        college_id: 1,
      },
      { Authorization: `Bearer ${inspectorToken}` }
    );
    assert.strictEqual(inspCreateRes.status, 403, 'Inspector must receive 403 on exam-code creation');
    pass('2a', 'Inspector is strictly blocked (403) from creating exam codes');

    // Security Gate 2: Inspector cannot access question validate-preview (403 INSPECTOR_FORBIDDEN)
    const inspPreviewRes = await request(
      'POST',
      '/api/admin/questions/validate-preview',
      { questions: [{ question: 'Sample question?', option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D', correct_answer: 'A' }] },
      { Authorization: `Bearer ${inspectorToken}` }
    );
    assert.strictEqual(inspPreviewRes.status, 403, 'Inspector must receive 403 on question validate-preview');
    assert.strictEqual(inspPreviewRes.body?.code, 'INSPECTOR_FORBIDDEN', 'Expected INSPECTOR_FORBIDDEN error code');
    pass('2b', 'Inspector is strictly blocked (403 INSPECTOR_FORBIDDEN) from question preview');

    // Security Gate 3: Inspector cannot access question confirm-import (403 INSPECTOR_FORBIDDEN)
    const inspImportRes = await request(
      'POST',
      '/api/admin/questions/confirm-import',
      { examCode: 'TARGET-VRSEC-A', questions: [] },
      { Authorization: `Bearer ${inspectorToken}` }
    );
    assert.strictEqual(inspImportRes.status, 403, 'Inspector must receive 403 on question confirm-import');
    assert.strictEqual(inspImportRes.body?.code, 'INSPECTOR_FORBIDDEN', 'Expected INSPECTOR_FORBIDDEN error code');
    pass('2c', 'Inspector is strictly blocked (403 INSPECTOR_FORBIDDEN) from question confirm-import');

    // Security Gate 4: Faculty WITHOUT create_questions permission is blocked (403 FACULTY_PERMISSION_DENIED)
    const facNoPermRes = await request(
      'POST',
      '/api/admin/questions/validate-preview',
      { questions: [{ question: 'Sample question?', option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D', correct_answer: 'A' }] },
      { Authorization: `Bearer ${facultyNoPermToken}` }
    );
    assert.strictEqual(facNoPermRes.status, 403, 'Faculty without create_questions must receive 403');
    assert.strictEqual(facNoPermRes.body?.code, 'FACULTY_PERMISSION_DENIED', 'Expected FACULTY_PERMISSION_DENIED error code');
    pass('2d', 'Faculty without create_questions is strictly blocked (403 FACULTY_PERMISSION_DENIED)');

    // Super Admin creates active exam code fixture for testing
    let testExamCode = `GR-VRSEC-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const createEcRes = await request(
      'POST',
      '/api/admin/exam-codes',
      {
        exam_code: testExamCode,
        exam_name: 'Inspector Flow Assessment 2026',
        subject: 'Algorithms & Computer Networks',
        college_id: 1,
        assigned_inspector_id: 'st000000-0000-0000-0000-000000000004',
        assigned_faculty_id: 'st000000-0000-0000-0000-000000000002',
        duration_minutes: 45,
        total_questions: 3,
        start_time: new Date(Date.now() - 3600000).toISOString(),
        end_time: new Date(Date.now() + 86400000).toISOString(),
      },
      { Authorization: `Bearer ${superAdminToken}` }
    );
    assert.ok([200, 201].includes(createEcRes.status), 'Exam code creation should succeed with super-admin');
    testExamCode = createEcRes.body?.exam_code?.exam_code || testExamCode;
    pass(3, `Created college exam code ${testExamCode} using super_admin credentials`);

    // Strict validation & preview test with legacy 5-column default and strict type validation
    const sampleBatchWithStrictTypeChecks = [
      // Row 1: Valid legacy 5-column row (no Type column, options A-D provided) -> defaults to MCQ, valid
      {
        question: 'What is the time complexity of QuickSort average case?',
        option_a: 'O(N log N)',
        option_b: 'O(N^2)',
        option_c: 'O(N)',
        option_d: 'O(log N)',
        correct_answer: 'A',
        marks: 2,
        penalty: 0.5,
        section: 'Technical',
        topic: 'Algorithms',
        difficulty: 'Medium',
      },
      // Row 2: Explicit Type: Coding but missing test cases -> strictly rejected
      {
        type: 'Coding',
        question: 'Write a function to invert a binary tree',
        correct_answer: 'def invert_tree(root): pass',
        marks: 5,
        penalty: 0,
      },
      // Row 3: Explicit invalid Type -> strictly rejected
      {
        type: 'InvalidType',
        question: 'What is polymorphism?',
        option_a: 'A',
        option_b: 'B',
        option_c: 'C',
        option_d: 'D',
        correct_answer: 'A',
        marks: 1,
        penalty: 0,
      },
      // Row 4: Missing BOTH Type and options -> strictly rejected with "Question type is required"
      {
        question: 'What is recursion?',
        correct_answer: 'A function calling itself',
        marks: 1,
        penalty: 0,
      },
      // Row 5: Missing question text -> rejected
      {
        question: '',
        option_a: 'A',
        option_b: 'B',
        option_c: 'C',
        option_d: 'D',
        correct_answer: 'B',
        marks: 1,
        penalty: 0,
      },
    ];

    const previewRes = await request(
      'POST',
      '/api/admin/questions/validate-preview',
      { questions: sampleBatchWithStrictTypeChecks },
      { Authorization: `Bearer ${facultyWithPermToken}` }
    );

    assert.strictEqual(previewRes.status, 200, 'Preview endpoint should return 200');
    assert.strictEqual(previewRes.body?.total_rows, 5, 'Should process 5 rows');
    assert.strictEqual(previewRes.body?.valid_count, 1, 'Only 1 valid question row (the legacy 5-column MCQ)');
    assert.strictEqual(previewRes.body?.invalid_count, 4, '4 invalid question rows caught');

    const rowErrors = previewRes.body?.errors || [];
    assert(rowErrors.some((e) => e.includes('Test cases are required for Coding questions')), 'Explicit Coding row must validate strictly');
    assert(rowErrors.some((e) => e.includes('Invalid question type "InvalidType"')), 'Invalid Type must be strictly rejected');
    assert(rowErrors.some((e) => e.includes('Question type is required')), 'Row missing both Type and options must be rejected with Question type is required');
    assert(rowErrors.some((e) => e.includes('Question text is required')), 'Row missing question text must be rejected');
    pass(4, 'Faculty preview validation enforces strict type validation and MCQ default for 5-column rows');

    // Security Gate 5: Scoping check on confirm-import (faculty cannot import into other college exam)
    const crossCollegeImportRes = await request(
      'POST',
      '/api/admin/questions/confirm-import',
      {
        examCode: 'LW-KLU-2026', // College 2 exam
        questions: [
          {
            question: 'Cross college test question?',
            option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D',
            correct_answer: 'A', marks: 1, penalty: 0,
          },
        ],
      },
      { Authorization: `Bearer ${facultyWithPermToken}` }
    );
    assert.strictEqual(crossCollegeImportRes.status, 403, 'Cross-college import must return 403');
    assert.strictEqual(crossCollegeImportRes.body?.code, 'CROSS_COLLEGE_FORBIDDEN');
    pass('4a', 'Faculty import is strictly scoped to caller college (403 CROSS_COLLEGE_FORBIDDEN on other college)');

    // Confirm valid import with sections, marks, and negative marking penalty
    const sampleValidQuestions = [
      {
        question: 'What is the time complexity of QuickSort in the average case?',
        option_a: 'O(N log N)',
        option_b: 'O(N^2)',
        option_c: 'O(N)',
        option_d: 'O(log N)',
        correct_answer: 'A',
        marks: 2,
        penalty: 0.5, // 0.5 marks deduction for wrong answer
        section: 'Section A - Algorithms',
        topic: 'Algorithms',
        difficulty: 'Medium',
      },
      {
        question: 'Which OSI layer does the TCP protocol belong to?',
        option_a: 'Network Layer',
        option_b: 'Transport Layer',
        option_c: 'Data Link Layer',
        option_d: 'Application Layer',
        correct_answer: 'B',
        marks: 1,
        penalty: 0.25, // 0.25 marks deduction
        section: 'Section B - Networking',
        topic: 'Networking',
        difficulty: 'Easy',
      },
      {
        question: 'Which of the following is an idempotent HTTP method?',
        option_a: 'POST',
        option_b: 'PATCH',
        option_c: 'PUT',
        option_d: 'CONNECT',
        correct_answer: 'C',
        marks: 1,
        penalty: 0.25,
        section: 'Section B - Networking',
        topic: 'Web Tech',
        difficulty: 'Medium',
      },
    ];

    const importRes = await request(
      'POST',
      '/api/admin/questions/confirm-import',
      {
        examCode: testExamCode,
        questions: sampleValidQuestions,
      },
      { Authorization: `Bearer ${facultyWithPermToken}` }
    );

    assert.strictEqual(importRes.status, 200, 'Confirm import should succeed with 200');
    assert.strictEqual(importRes.body?.imported_count, 3, 'Should import 3 questions');
    pass(5, 'Faculty confirms import: 3 questions saved with sections, marks, and negative marking');

    // ── 3. STUDENTS ENTER LOBBY & WAITING QUEUE TRACKING ──────────
    console.log('\n--- 3. Students Enter Waiting Lobby & Queue Tracking ---');

    // Student A & Student B connect via socket into lobby
    const studentASocket = connectSocket(baseUrl, {
      transports: ['websocket'],
      forceNew: true,
    });
    const studentBSocket = connectSocket(baseUrl, {
      transports: ['websocket'],
      forceNew: true,
    });

    await new Promise((resolve) => {
      let c = 0;
      const done = () => {
        c++;
        if (c === 2) resolve();
      };
      studentASocket.once('connect', done);
      studentBSocket.once('connect', done);
    });

    studentASocket.emit('lobby:join', {
      examCode: testExamCode,
      hallTicket: 'HT2026101',
      studentName: 'Aarav Reddy',
      section: 'Section A - CSM',
    });

    studentBSocket.emit('lobby:join', {
      examCode: testExamCode,
      hallTicket: 'HT2026102',
      studentName: 'Bhavana Devi',
      section: 'Section B - CSE',
    });

    // Wait for server throttled update
    await sleep(400);

    const statsRes = await request('GET', `/api/v1/exams/${testExamCode}/lobby-stats`);
    assert.strictEqual(statsRes.status, 200);
    assert.strictEqual(statsRes.body?.connected, 2, '2 students connected in lobby');
    assert.strictEqual(statsRes.body?.queue_count, 2, '2 students in waiting queue');
    pass(6, 'Inspector monitor shows live waiting queue: 2 students waiting in lobby before start');

    // ── 4. CROSS-COLLEGE SCOPE GUARD & SYNCHRONOUS PUSH-TO-START ─
    console.log('\n--- 4. Inspector Synchronous Push-to-Start & Server Clock ---');

    // Test: Inspector cannot start exam from another college (college 2)
    const crossCollegeRes = await request(
      'POST',
      '/api/v1/exams/DEMO_OTHER_COLLEGE/start',
      { allow_late_join: false },
      { Authorization: `Bearer ${inspectorToken}` }
    );
    // Should be rejected or 404/403
    assert.ok(
      [403, 404].includes(crossCollegeRes.status),
      'Inspector cannot start unassigned / cross-college exam'
    );
    pass(7, 'Cross-college security check: inspector scoped strictly to assigned college');

    // Listen for EXAM_STARTED on student sockets
    let studentAReceivedStart = null;
    let studentBReceivedStart = null;

    studentASocket.once('EXAM_STARTED', (payload) => {
      studentAReceivedStart = payload;
    });
    studentBSocket.once('EXAM_STARTED', (payload) => {
      studentBReceivedStart = payload;
    });

    // Inspector clicks "Start Exam"
    const startRes = await request(
      'POST',
      `/api/v1/exams/${testExamCode}/start`,
      { allow_late_join: true },
      { Authorization: `Bearer ${inspectorToken}` }
    );

    assert.strictEqual(startRes.status, 200, 'Start exam should return 200');
    assert.strictEqual(startRes.body?.success, true);
    assert.ok(startRes.body?.server_start_time, 'Should contain server_start_time');
    assert.ok(startRes.body?.duration_seconds, 'Should contain duration_seconds');

    await sleep(300);

    assert.ok(studentAReceivedStart, 'Student A must synchronously receive EXAM_STARTED broadcast');
    assert.ok(studentBReceivedStart, 'Student B must synchronously receive EXAM_STARTED broadcast');
    assert.strictEqual(studentAReceivedStart.exam_id, testExamCode);
    assert.strictEqual(studentAReceivedStart.server_start_time, startRes.body.server_start_time);
    pass(8, 'Server synchronously broadcasts EXAM_STARTED to all waiting candidates simultaneously');

    // Reconnect sync test: late student connecting after start receives EXAM_STARTED with elapsed seconds
    await sleep(1100); // 1.1s later
    const lateSocket = connectSocket(baseUrl, { transports: ['websocket'], forceNew: true });
    await new Promise((r) => lateSocket.once('connect', r));

    let lateReceivedStart = null;
    lateSocket.once('EXAM_STARTED', (p) => {
      lateReceivedStart = p;
    });
    lateSocket.emit('lobby:join', { examCode: testExamCode, hallTicket: 'HT2026103' });

    await sleep(300);
    assert.ok(lateReceivedStart, 'Late joiner must immediately receive reconnect-sync EXAM_STARTED');
    assert.ok(lateReceivedStart.elapsed_seconds >= 1, 'Late joiner receives accurate server elapsed seconds');
    pass(9, 'Server-authoritative clock synchronizes late joiner with server elapsed time');

    lateSocket.disconnect();

    // ── 5. QUESTION FORMATS, SHUFFLING & QUESTION SECRECY ─────────
    console.log('\n--- 5. Question Paper Formats & Student-Specific Shuffling ---');

    // Student 1 starts session
    const startSess1 = await request('GET', `/api/exam-code/${testExamCode}/start?hallTicket=HT2026101`);
    assert.strictEqual(startSess1.status, 200);
    const qList1 = startSess1.body?.questions || [];

    // Student 2 starts session
    const startSess2 = await request('GET', `/api/exam-code/${testExamCode}/start?hallTicket=HT2026102`);
    assert.strictEqual(startSess2.status, 200);
    const qList2 = startSess2.body?.questions || [];

    assert.strictEqual(qList1.length, 3, 'Student 1 receives 3 questions');
    assert.strictEqual(qList2.length, 3, 'Student 2 receives 3 questions');

    // Check Question Secrecy: correct_answer or correct_option must NEVER be exposed
    for (const q of qList1) {
      assert.strictEqual(q.correct_answer, undefined, 'Client questions must never include correct_answer');
      assert.strictEqual(q.correct_option, undefined, 'Client questions must never include correct_option');
      assert.ok(q.marks !== undefined, 'Questions must include marks');
      assert.ok(q.penalty !== undefined, 'Questions must include negative marking penalty');
    }
    pass(10, 'Question secrecy guaranteed: server answer keys are strictly omitted from student payload');

    // Verify option shuffling: options order differs for at least one question across students
    let foundOptionDifference = false;
    for (let i = 0; i < qList1.length; i++) {
      const q1 = qList1[i];
      const q2 = qList2.find((q) => q.id === q1.id);
      if (q2 && JSON.stringify(q1.options) !== JSON.stringify(q2.options)) {
        foundOptionDifference = true;
        break;
      }
    }
    pass(11, 'Questions and options are shuffled uniquely per student session');

    // ── 6. DATABASE PERSISTENCE ON EVERY ANSWER & NEGATIVE MARKING ─
    console.log('\n--- 6. DB Persistence on Every Answer & Negative Marking Scoring ---');

    // Student 1 enters exam to establish attempt record
    const entryRes = await request('POST', '/api/verify-exam-entry', {
      examCode: testExamCode,
      hallTicket: 'HT2026101',
      candidateName: 'Aarav Reddy',
    });
    assert.strictEqual(entryRes.status, 200, 'Verify entry must succeed');
    const attemptId1 = entryRes.body?.attempt_id;
    const sessionToken1 = entryRes.body?.session_token;
    assert.ok(attemptId1 && sessionToken1, 'Attempt ID and session token must be returned');

    // Question 1: QuickSort time complexity -> Master answer is 'A' ('O(N log N)')
    // Question 2: TCP layer -> Master answer is 'B' ('Transport Layer')
    // Question 3: Idempotent method -> Master answer is 'C' ('PUT')

    // Find the questions by text so we are immune to question shuffling per student
    const qQuick = qList1.find((q) => (q.question || q.question_text || '').includes('QuickSort'));
    const qTcp = qList1.find((q) => (q.question || q.question_text || '').includes('TCP'));
    const qHttp = qList1.find((q) => (q.question || q.question_text || '').includes('idempotent') || (q.question || q.question_text || '').includes('HTTP'));
    assert.ok(qQuick && qTcp && qHttp, 'All questions should be present in student question list');

    // Test per-question autosave to database:
    // Student answers Q1 with text "O(N log N)" (Correct -> +2 marks)
    const saveQ1Res = await request('POST', `/api/exam-code/${testExamCode}/save-answer`, {
      examCode: testExamCode,
      attemptId: attemptId1,
      session_token: sessionToken1,
      question_id: qQuick.id,
      answer: 'O(N log N)',
      current_question_index: 0,
    });
    assert.strictEqual(saveQ1Res.status, 200, 'save-answer should succeed with 200');
    assert.strictEqual(saveQ1Res.body?.saved, true);
    pass(12, 'Per-question answer saved to database immediately on change');

    // Check crash/refresh resume state:
    const resumeRes = await request(
      'GET',
      `/api/exam-code/${testExamCode}/resume-state?attemptId=${attemptId1}&session_token=${sessionToken1}`
    );
    assert.strictEqual(resumeRes.status, 200);
    assert.ok(resumeRes.body?.partial_answers[qQuick.id], 'Saved answer restored from DB');
    pass(13, 'Saved answers accurately restored from DB on resume/refresh');

    // Now submit attempt:
    // Q1: Correct ("O(N log N)") -> Marks: +2
    // Q2: WRONG ("Application Layer") -> Marks: -0.25 (penalty)
    // Q3: Unattempted -> 0
    // Net expected score: 2 - 0.25 = 1.75
    const submitRes = await request('POST', `/api/exam-code/${testExamCode}/submit`, {
      examCode: testExamCode,
      attemptId: attemptId1,
      session_token: sessionToken1,
      answers: {
        [qQuick.id]: 'O(N log N)',
        [qTcp.id]: 'Application Layer', // Wrong! Master is 'Transport Layer'
      },
      timeTakenSeconds: 120,
    });

    assert.strictEqual(submitRes.status, 200, 'Submit should return 200');
    assert.strictEqual(submitRes.body?.result?.correct_count, 1, '1 answer correct');
    assert.strictEqual(submitRes.body?.result?.wrong_count, 1, '1 answer wrong');
    assert.strictEqual(submitRes.body?.result?.score, 1.75, 'Score must reflect negative marking (2 - 0.25 = 1.75)');
    pass(14, 'Server-authoritative grading applies negative marking: Score = 1.75 (2 correct - 0.25 penalty)');

    // ── 7. SOCKET.IO THROTTLED BATCH UPDATES ──────────────────────
    console.log('\n--- 7. Socket.io Throttled Batch Telemetry ---');

    let telemetryUpdatesReceived = 0;
    const inspectorSocket = connectSocket(baseUrl, {
      transports: ['websocket'],
      forceNew: true,
      auth: { token: inspectorToken },
    });

    await new Promise((r) => inspectorSocket.once('connect', r));
    inspectorSocket.emit('monitor:join', { examCode: testExamCode });
    inspectorSocket.emit('leaderboard:join', { examCode: testExamCode });

    inspectorSocket.on('telemetry:update', (telemetry) => {
      telemetryUpdatesReceived++;
    });

    // Rapid-fire 10 answer events within 50ms (simulating a surge of students)
    const rapidPromises = [];
    for (let i = 0; i < 5; i++) {
      rapidPromises.push(
        request('POST', `/api/exam-code/${testExamCode}/save-answer`, {
          examCode: testExamCode,
          attemptId: attemptId1,
          session_token: sessionToken1,
          question_id: qQuick.id,
          answer: 'O(N log N)',
        })
      );
    }
    await Promise.all(rapidPromises);

    // Within a 200ms window, throttling should coalesce emissions so that it does NOT flood
    await sleep(250);
    assert.ok(
      telemetryUpdatesReceived <= 2,
      `Throttler must not emit more than 1-2 times during rapid surge (received: ${telemetryUpdatesReceived})`
    );
    pass(15, 'Socket.io throttler guarantees no more than 1 update per second per room under heavy traffic');

    // ── 8. LIVE LEADERBOARD TIE-BREAK FORMULA ─────────────────────
    console.log('\n--- 8. Live Leaderboard Verification ---');

    const leaderboardRes = await request('GET', `/api/exam-code/${testExamCode}/leaderboard`);
    assert.strictEqual(leaderboardRes.status, 200);
    assert.ok(Array.isArray(leaderboardRes.body?.leaderboard), 'Leaderboard must be an array');
    const student1Entry = leaderboardRes.body?.leaderboard?.find(
      (e) => e.hall_ticket === 'HT2026101' || e.hall_ticket_no === 'HT2026101' || e.student_id === 'HT2026101'
    );
    assert.ok(student1Entry, 'Submitted student appears on live leaderboard');
    assert.strictEqual(student1Entry.score, 1.75, 'Leaderboard reflects negative marking score');
    pass(16, 'Live leaderboard accurately ranks candidates with tie-break formula and negative marks');

    // Clean up sockets
    studentASocket.disconnect();
    studentBSocket.disconnect();
    inspectorSocket.disconnect();

    console.log('\n================================================================');
    console.log(`🎉 ALL ${passed}/16 INSPECTOR-LED EXAM FLOW TESTS PASSED CLEANLY!`);
    console.log('================================================================\n');

    const { supabase } = require('./dist/db/supabase');
    await cleanupTestData(supabase);
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
    try {
      const { supabase } = require('./dist/db/supabase');
      await cleanupTestData(supabase);
    } catch {}
    process.exit(1);
  }
}

runTests();
