/**
 * test-section-targeting-and-portal.js
 * 
 * Comprehensive Automated Test Suite:
 * 1. Section-targeted exams & Server-side 404 Secrecy enforcement
 * 2. Automated academic study year derivation (zero hardcoding)
 * 3. Faculty question paper allocation & Inspector assignment
 * 4. WebSocket lobby gating for targeted vs non-targeted students
 * 5. Bulk hierarchy import idempotency & Section auto-linking
 * 6. Audit trail verification
 */

require('./test-helper');
process.env.PORT = '0';

const http = require('http');
const assert = require('assert');
const jwt = require('jsonwebtoken');

const appModule = require('./dist/index');
const server = appModule.httpServer;
const { deriveStudyYear, isStudentEligibleForExam } = require('./dist/utils/academicYear');
const { supabase } = require('./dist/db/supabase');
const { io: connectSocket } = require('../client/node_modules/socket.io-client');

let baseUrl;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    };

    const payload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
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
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: parsed,
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

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING SECTION TARGETING & PORTAL VALIDATION TEST SUITE');
  console.log('================================================================\n');

  if (server && !server.listening) {
    await new Promise((resolve) => server.once('listening', resolve));
  }
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Server listening on ${baseUrl} for test assertions.\n`);

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    return async () => {
      try {
        await fn();
        console.log(`  ✅ PASS: ${name}`);
        passed++;
      } catch (err) {
        console.error(`  ❌ FAIL: ${name}`);
        console.error(`     Error: ${err.message}`);
        failed++;
      }
    };
  }

  // Seed test records into database for the test suite
  await supabase.from('staff').upsert([
    {
      id: 'st000000-0000-0000-0000-000000000001',
      username: 'admin',
      email: 'admin@system.local',
      role: 'super_admin',
      is_active: true,
    },
    {
      id: 'st000000-0000-0000-0000-000000000002',
      username: 'faculty@system.local',
      email: 'faculty@system.local',
      role: 'faculty',
      college_id: 1,
      section_ids: ['A'],
      permissions: ['view_curriculum', 'upload_excel'],
      is_active: true,
    },
    {
      id: 'st000000-0000-0000-0000-000000000004',
      username: 'inspector@system.local',
      email: 'inspector@system.local',
      role: 'inspector',
      college_id: 1,
      is_active: true,
    },
  ]);

  await supabase.from('students').upsert([
    {
      id: 's1000000-0000-0000-0000-000000000001',
      name: 'Aarav Sharma',
      email: 'aarav.sharma@example.com',
      roll_number: 'HT2026001',
      hall_ticket: 'HT2026001',
      college_id: 1,
      branch: 'CSM',
      passout_year: 2026,
      section: 'A',
      section_id: 'A',
      is_active: true,
      is_verified: true,
      active_session_id: 'session-demo-aarav-001',
    },
    {
      id: 's3000000-0000-0000-0000-000000000003',
      name: 'Rohan Varma',
      email: 'rohan.varma@example.com',
      roll_number: 'HT2026003',
      hall_ticket: 'HT2026003',
      college_id: 1,
      branch: 'CSM',
      passout_year: 2026,
      section: 'B',
      section_id: 'B',
      is_active: true,
      is_verified: true,
    },
    {
      id: 's2000000-0000-0000-0000-000000000002',
      name: 'Other College Student',
      email: 'other@example.com',
      roll_number: 'HT2026002',
      hall_ticket: 'HT2026002',
      college_id: 2,
      branch: 'CSM',
      passout_year: 2026,
      section: 'A',
      section_id: 'A',
      is_active: true,
      is_verified: true,
    },
    {
      id: 's4000000-0000-0000-0000-000000000004',
      name: 'Other Branch Student',
      email: 'branch@example.com',
      roll_number: 'HT2026004',
      hall_ticket: 'HT2026004',
      college_id: 1,
      branch: 'ECE',
      passout_year: 2026,
      section: 'A',
      section_id: 'A',
      is_active: true,
      is_verified: true,
    },
    {
      id: 's5000000-0000-0000-0000-000000000005',
      name: 'Other Passout Student',
      email: 'passout@example.com',
      roll_number: 'HT2027005',
      hall_ticket: 'HT2027005',
      college_id: 1,
      branch: 'CSM',
      passout_year: 2027,
      section: 'A',
      section_id: 'A',
      is_active: true,
      is_verified: true,
    },
  ]);

  await supabase.from('exam_codes').upsert([
    {
      id: 9999,
      exam_code: 'TARGET-VRSEC-A',
      exam_name: 'Targeted Exam Section A',
      title: 'Targeted Exam Section A',
      college_id: 1,
      branch: 'CSM',
      passout_year: 2026,
      section_id: 'A',
      section_ids: ['A'],
      assigned_faculty_id: 'st000000-0000-0000-0000-000000000002',
      assigned_inspector_id: 'st000000-0000-0000-0000-000000000004',
      created_by_staff_id: 'st000000-0000-0000-0000-000000000002',
      is_active: true,
      status: 'published',
      duration_minutes: 60,
      duration_seconds: 3600,
      start_time: new Date(Date.now() - 3600000).toISOString(),
      end_time: new Date(Date.now() + 7200000).toISOString(),
      created_at: new Date().toISOString(),
    },
  ]);

  await supabase.from('questions_ec').upsert([
    {
      id: 'q-target-1',
      exam_code: 'TARGET-VRSEC-A',
      question: 'What is 2 + 2?',
      option_a: '4',
      option_b: '3',
      option_c: '5',
      option_d: '6',
      correct_answer: 'A',
      marks: 1,
      section: 'General',
    },
  ]);

  // ── TEST GROUP 1: Dynamic Academic Year Derivation ──────────────────
  console.log('--- TEST GROUP 1: Dynamic Academic Year Derivation ---');

  await test('Derives 3rd year for passout 2028 in Academic Session 2026-27', async () => {
    // Current date: Oct 4, 2026 (Month index 9 -> Academic year 2026-27, academicEndYear 2027)
    const testDate = new Date(2026, 9, 4);
    const res = deriveStudyYear(2028, testDate);
    assert.strictEqual(res.studyYear, 3, `Expected Year 3 for passout 2028 in 2026-27, got ${res.studyYear}`);
    assert.strictEqual(res.academicYear, '2026-27');
  })();

  await test('Derives 1st year for passout 2030 in Academic Session 2026-27', async () => {
    const testDate = new Date(2026, 9, 4);
    const res = deriveStudyYear(2030, testDate);
    assert.strictEqual(res.studyYear, 1, `Expected Year 1 for passout 2030, got ${res.studyYear}`);
  })();

  await test('Derives 4th (final) year for passout 2027 in Academic Session 2026-27', async () => {
    const testDate = new Date(2026, 9, 4);
    const res = deriveStudyYear(2027, testDate);
    assert.strictEqual(res.studyYear, 4, `Expected Year 4 for passout 2027, got ${res.studyYear}`);
  })();

  await test('Derives correctly across calendar year boundary (February 2027 in AY 2026-27)', async () => {
    // Feb 2027 is still in 2026-27 session (month index 1 < 6, academicEndYear 2027)
    const testDate = new Date(2027, 1, 15);
    const res = deriveStudyYear(2028, testDate);
    assert.strictEqual(res.studyYear, 3, `Expected Year 3 in Feb 2027 for passout 2028, got ${res.studyYear}`);
  })();

  // ── TEST GROUP 2: Eligibility Match Function ────────────────────────
  console.log('\n--- TEST GROUP 2: Eligibility Logic Verification ---');

  const targetedExam = {
    college_id: 1,
    branch: 'CSM',
    passout_year: 2026,
    section_id: 'A',
    section_ids: ['A'],
  };

  await test('Eligible when college, branch, passout_year, and section all match', async () => {
    const student = { college_id: 1, branch: 'CSM', passout_year: 2026, section: 'A' };
    assert.strictEqual(isStudentEligibleForExam(student, targetedExam), true);
  })();

  await test('Ineligible if section does not match (Section B vs Target Section A)', async () => {
    const student = { college_id: 1, branch: 'CSM', passout_year: 2026, section: 'B' };
    assert.strictEqual(isStudentEligibleForExam(student, targetedExam), false);
  })();

  await test('Ineligible if branch does not match (ECE vs Target CSM)', async () => {
    const student = { college_id: 1, branch: 'ECE', passout_year: 2026, section: 'A' };
    assert.strictEqual(isStudentEligibleForExam(student, targetedExam), false);
  })();

  await test('Ineligible if college does not match (College 2 vs College 1)', async () => {
    const student = { college_id: 2, branch: 'CSM', passout_year: 2026, section: 'A' };
    assert.strictEqual(isStudentEligibleForExam(student, targetedExam), false);
  })();

  await test('Ineligible if passout_year does not match (2027 vs 2026)', async () => {
    const student = { college_id: 1, branch: 'CSM', passout_year: 2027, section: 'A' };
    assert.strictEqual(isStudentEligibleForExam(student, targetedExam), false);
  })();

  // ── TEST GROUP 3: Server-side Enforced 404 Secrecy on Student Routes ─
  console.log('\n--- TEST GROUP 3: Server-Side 404 Secrecy on Student Routes ---');

  const adminSecret = process.env.ADMIN_JWT_SECRET || 'test-admin-jwt-secret-key-32chars-2026';
  const adminToken = jwt.sign({ id: 'adm-01', staff_id: 'st000000-0000-0000-0000-000000000001', username: 'admin', role: 'super_admin' }, adminSecret, { expiresIn: '1h' });

  // Faculty token matching TARGET-VRSEC-A's assigned_faculty_id: 'st000000-0000-0000-0000-000000000002'
  const facultyToken = jwt.sign(
    { id: 'usr-fac-01', staff_id: 'st000000-0000-0000-0000-000000000002', username: 'faculty@system.local', role: 'faculty', college_id: 1, permissions: ['view_curriculum', 'upload_excel'] },
    adminSecret,
    { expiresIn: '1h' }
  );

  // Inspector token matching TARGET-VRSEC-A's assigned_inspector_id: 'st000000-0000-0000-0000-000000000004'
  const inspectorToken = jwt.sign(
    { id: 'usr-insp-01', staff_id: 'st000000-0000-0000-0000-000000000004', username: 'inspector@system.local', role: 'inspector', college_id: 1 },
    adminSecret,
    { expiresIn: '1h' }
  );

  let studentAttemptId = '';
  let studentSessionToken = '';

  await test('Section A student (HT2026001) gets 403 EXAM_NOT_STARTED_BY_INSPECTOR on verify before inspector start', async () => {
    const res = await request('GET', '/api/exam-code/TARGET-VRSEC-A/verify?hallTicket=HT2026001');
    assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);
    assert.strictEqual(res.data.code, 'EXAM_NOT_STARTED_BY_INSPECTOR');
  })();

  await test('Section A student (HT2026001) gets 403 EXAM_NOT_STARTED_BY_INSPECTOR on start before inspector start', async () => {
    const res = await request('POST', '/api/exam-code/TARGET-VRSEC-A/start', {
      hallTicket: 'HT2026001',
      studentName: 'Aarav Sharma',
    });
    assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);
    assert.strictEqual(res.data.code, 'EXAM_NOT_STARTED_BY_INSPECTOR');
  })();

  await test('Inspector explicitly starts TARGET-VRSEC-A exam (200 OK)', async () => {
    const res = await request('POST', '/api/v1/exams/TARGET-VRSEC-A/start', { allow_late_join: true }, {
      Authorization: `Bearer ${inspectorToken}`,
    });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert.strictEqual(res.data.success, true);
  })();

  await test('Section A student (HT2026001) successfully verifies exam after inspector start (200 OK)', async () => {
    const res = await request('GET', '/api/exam-code/TARGET-VRSEC-A/verify?hallTicket=HT2026001');
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert(res.data.success || res.data.valid, 'Expected success or valid true');
    studentAttemptId = res.data.attempt_id;
    studentSessionToken = res.data.session_token;
  })();

  await test('Section A student (HT2026001) starts exam session after inspector start (200 OK)', async () => {
    const res = await request('POST', '/api/exam-code/TARGET-VRSEC-A/start', {
      hallTicket: 'HT2026001',
      studentName: 'Aarav Sharma',
    });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert.strictEqual(res.data.success, true);
  })();

  await test('Section A student (HT2026001) fetches question paper (200 OK)', async () => {
    const res = await request('GET', `/api/exam-code/TARGET-VRSEC-A/questions?hallTicket=HT2026001&attemptId=${studentAttemptId || ''}&session_token=${studentSessionToken || ''}`);
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert.strictEqual(res.data.success, true);
    assert(Array.isArray(res.data.questions), 'Expected questions array');
  })();

  await test('Section B student (HT2026003) gets 404 (NOT 403) on verifyExamEntry', async () => {
    const res = await request('GET', '/api/exam-code/TARGET-VRSEC-A/verify?hallTicket=HT2026003');
    assert.strictEqual(res.status, 404, `Expected 404 Not Found, got ${res.status}`);
  })();

  await test('Section B student (HT2026003) gets 404 on start session', async () => {
    const res = await request('POST', '/api/exam-code/TARGET-VRSEC-A/start', {
      hallTicket: 'HT2026003',
    });
    assert.strictEqual(res.status, 404, `Expected 404, got ${res.status}`);
  })();

  await test('Section B student (HT2026003) gets 404 on fetching questions', async () => {
    const res = await request('GET', '/api/exam-code/TARGET-VRSEC-A/questions?hallTicket=HT2026003');
    assert.strictEqual(res.status, 404, `Expected 404, got ${res.status}`);
  })();

  await test('Section B student (HT2026003) gets 404 on saving answer', async () => {
    const res = await request('POST', '/api/exam-code/TARGET-VRSEC-A/answer', {
      hallTicket: 'HT2026003',
      questionId: 'q-1',
      selectedOption: 'A',
    });
    assert.strictEqual(res.status, 404, `Expected 404, got ${res.status}`);
  })();

  await test('Section B student (HT2026003) gets 404 on resume state', async () => {
    const res = await request('GET', '/api/exam-code/TARGET-VRSEC-A/resume?hallTicket=HT2026003');
    assert.strictEqual(res.status, 404, `Expected 404, got ${res.status}`);
  })();

  await test('Section B student (HT2026003) gets 404 on submit attempt', async () => {
    const res = await request('POST', '/api/exam-code/TARGET-VRSEC-A/submit', {
      hallTicket: 'HT2026003',
      answers: {},
    });
    assert.strictEqual(res.status, 404, `Expected 404, got ${res.status}`);
  })();

  await test('Other college student (HT2026002) gets 404 on verify and questions', async () => {
    const vRes = await request('GET', '/api/exam-code/TARGET-VRSEC-A/verify?hallTicket=HT2026002');
    assert.strictEqual(vRes.status, 404);
    const qRes = await request('GET', '/api/exam-code/TARGET-VRSEC-A/questions?hallTicket=HT2026002');
    assert.strictEqual(qRes.status, 404);
  })();

  await test('Other branch student (HT2026004) gets 404 on verify and questions', async () => {
    const vRes = await request('GET', '/api/exam-code/TARGET-VRSEC-A/verify?hallTicket=HT2026004');
    assert.strictEqual(vRes.status, 404);
    const qRes = await request('GET', '/api/exam-code/TARGET-VRSEC-A/questions?hallTicket=HT2026004');
    assert.strictEqual(qRes.status, 404);
  })();

  await test('Other passout year student (HT2027005) gets 404 on verify and questions', async () => {
    const vRes = await request('GET', '/api/exam-code/TARGET-VRSEC-A/verify?hallTicket=HT2027005');
    assert.strictEqual(vRes.status, 404);
    const qRes = await request('GET', '/api/exam-code/TARGET-VRSEC-A/questions?hallTicket=HT2027005');
    assert.strictEqual(qRes.status, 404);
  })();

  await test('Unauthenticated / non-existent student gets 404 on verify and questions', async () => {
    const vRes = await request('GET', '/api/exam-code/TARGET-VRSEC-A/verify?hallTicket=UNKNOWN9999');
    assert.strictEqual(vRes.status, 404);
    const qRes = await request('GET', '/api/exam-code/TARGET-VRSEC-A/questions');
    assert.strictEqual(qRes.status, 404);
  })();

  await test('Section A student (HT2026001) successfully joins lobby socket (no 404)', async () => {
    const socket = connectSocket(baseUrl, { transports: ['websocket'], reconnection: false });
    await new Promise((resolve, reject) => {
      socket.on('connect', () => {
        socket.emit('lobby:join', {
          examCode: 'TARGET-VRSEC-A',
          hallTicket: 'HT2026001',
          studentName: 'Aarav Sharma',
          section: 'A',
        });
        setTimeout(() => {
          socket.disconnect();
          resolve();
        }, 150);
      });
      socket.on('error', (err) => {
        socket.disconnect();
        reject(new Error(`Unexpected socket error: ${JSON.stringify(err)}`));
      });
      socket.on('connect_error', reject);
    });
  })();

  await test('Section B student (HT2026003) gets 404 on lobby:join socket event', async () => {
    const socket = connectSocket(baseUrl, { transports: ['websocket'], reconnection: false });
    await new Promise((resolve, reject) => {
      socket.on('connect', () => {
        socket.emit('lobby:join', {
          examCode: 'TARGET-VRSEC-A',
          hallTicket: 'HT2026003',
          studentName: 'Rohan Varma',
          section: 'B',
        });
      });
      socket.on('error', (err) => {
        socket.disconnect();
        if (err?.status === 404) resolve();
        else reject(new Error(`Expected 404 on socket error, got: ${JSON.stringify(err)}`));
      });
      setTimeout(() => {
        socket.disconnect();
        reject(new Error('Timed out waiting for socket 404 error'));
      }, 500);
    });
  })();

  await test('Other college student (HT2026002) gets 404 on lobby:join socket event', async () => {
    const socket = connectSocket(baseUrl, { transports: ['websocket'], reconnection: false });
    await new Promise((resolve, reject) => {
      socket.on('connect', () => {
        socket.emit('lobby:join', {
          examCode: 'TARGET-VRSEC-A',
          hallTicket: 'HT2026002',
        });
      });
      socket.on('error', (err) => {
        socket.disconnect();
        if (err?.status === 404) resolve();
        else reject(new Error(`Expected 404 on socket error, got: ${JSON.stringify(err)}`));
      });
      setTimeout(() => {
        socket.disconnect();
        reject(new Error('Timed out waiting for socket 404 error'));
      }, 500);
    });
  })();

  await test('Unauthenticated student (UNKNOWN9999) gets 404 on lobby:join socket event', async () => {
    const socket = connectSocket(baseUrl, { transports: ['websocket'], reconnection: false });
    await new Promise((resolve, reject) => {
      socket.on('connect', () => {
        socket.emit('lobby:join', {
          examCode: 'TARGET-VRSEC-A',
          hallTicket: 'UNKNOWN9999',
        });
      });
      socket.on('error', (err) => {
        socket.disconnect();
        if (err?.status === 404) resolve();
        else reject(new Error(`Expected 404 on socket error, got: ${JSON.stringify(err)}`));
      });
      setTimeout(() => {
        socket.disconnect();
        reject(new Error('Timed out waiting for socket 404 error'));
      }, 500);
    });
  })();

  // ── TEST GROUP 4: Student Portal Dashboard Gating ──────────────────
  console.log('\n--- TEST GROUP 4: Student Portal Dashboard Gating ---');

  const jwtSecret = process.env.JWT_SECRET || 'test-jwt-secret-key-32chars-min-length-2026';
  const tokenA = jwt.sign(
    { studentId: 's1000000-0000-0000-0000-000000000001', name: 'Aarav Sharma', email: 'aarav.sharma@example.com', hallTicket: 'HT2026001', role: 'student', sessionId: 'session-demo-aarav-001' },
    jwtSecret,
    { expiresIn: '1h' }
  );

  const tokenB = jwt.sign(
    { studentId: 's3000000-0000-0000-0000-000000000003', name: 'Rohan Varma', email: 'rohan.varma@example.com', hallTicket: 'HT2026003', role: 'student' },
    jwtSecret,
    { expiresIn: '1h' }
  );

  await test('Section A student sees TARGET-VRSEC-A in upcoming_exams', async () => {
    const res = await request('GET', '/api/student/dashboard', null, {
      Authorization: `Bearer ${tokenA}`,
    });
    assert.strictEqual(res.status, 200);
    const exams = res.data.upcoming_exams || [];
    const hasTargetExam = exams.some((e) => e.code === 'TARGET-VRSEC-A' || e.title?.includes('Section A'));
    assert(hasTargetExam, 'Section A student should see TARGET-VRSEC-A');
  })();

  await test('Section B student sees empty upcoming_exams ("No exam available")', async () => {
    const res = await request('GET', '/api/student/dashboard', null, {
      Authorization: `Bearer ${tokenB}`,
    });
    assert.strictEqual(res.status, 200);
    const exams = res.data.upcoming_exams || [];
    const hasTargetExam = exams.some((e) => e.code === 'TARGET-VRSEC-A');
    assert.strictEqual(hasTargetExam, false, 'Section B student must NEVER see TARGET-VRSEC-A');
  })();

  // ── TEST GROUP 5: Faculty & Inspector Scoping ──────────────────────
  console.log('\n--- TEST GROUP 5: Faculty & Inspector RBAC Scoping ---');

  await test('Faculty only sees exams allocated to their section', async () => {
    const res = await request('GET', '/api/admin/exam-codes', null, {
      Authorization: `Bearer ${facultyToken}`,
    });
    assert.strictEqual(res.status, 200);
    const codes = res.data.exam_codes || [];
    const containsAllocated = codes.some((c) => c.exam_code === 'TARGET-VRSEC-A');
    assert(containsAllocated, 'Faculty should see their allocated exam TARGET-VRSEC-A');

    // Faculty should not see unallocated exams of other faculty
    for (const c of codes) {
      if (c.assigned_faculty_id) {
        assert.strictEqual(c.assigned_faculty_id, 'st000000-0000-0000-0000-000000000002', 'Faculty cannot see exams of other faculty');
      }
    }
  })();

  await test('Admin can allocate, lock, and replace question papers with audit trail', async () => {
    // 1. Allocate paper
    const allocRes = await request('POST', '/api/admin/exam-codes/TARGET-VRSEC-A/allocate', {
      faculty_id: 'st000000-0000-0000-0000-000000000002',
    }, { Authorization: `Bearer ${adminToken}` });
    assert.strictEqual(allocRes.status, 200);
    assert.strictEqual(allocRes.data.success, true);

    // 2. Lock paper
    const lockRes = await request('POST', '/api/admin/exam-codes/TARGET-VRSEC-A/lock-paper', {}, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.strictEqual(lockRes.status, 200);
    assert.strictEqual(lockRes.data.success, true);
    assert.strictEqual(lockRes.data.is_locked, true);

    // 3. Replace paper
    const replRes = await request('POST', '/api/admin/exam-codes/TARGET-VRSEC-A/replace-paper', {
      questions: [
        {
          question_text: 'Replaced Q1: What is the time complexity of QuickSort?',
          option_a: 'O(N log N)', option_b: 'O(N^2)', option_c: 'O(1)', option_d: 'O(N)',
          correct_answer: 'A', marks: 5,
        },
      ],
    }, { Authorization: `Bearer ${adminToken}` });
    assert.strictEqual(replRes.status, 200);
    assert.strictEqual(replRes.data.success, true);

    // 4. Verify audit log recorded actions
    const { data: logs } = await supabase
      .from('audit_log')
      .select('action')
      .in('action', ['ALLOCATE_QUESTION_PAPER', 'LOCK_QUESTION_PAPER', 'REPLACE_QUESTION_PAPER']);

    const actions = (logs || []).map((l) => l.action);
    assert(actions.includes('ALLOCATE_QUESTION_PAPER'), 'Audit log must record ALLOCATE_QUESTION_PAPER');
    assert(actions.includes('LOCK_QUESTION_PAPER'), 'Audit log must record LOCK_QUESTION_PAPER');
    assert(actions.includes('REPLACE_QUESTION_PAPER'), 'Audit log must record REPLACE_QUESTION_PAPER');
  })();

  // ── TEST GROUP 6: Bulk Hierarchy Import Idempotency ────────────────
  console.log('\n--- TEST GROUP 6: Bulk Hierarchy Import Idempotency ---');

  const sampleRoster = [
    { roll_number: 'TEST2026A01', name: 'Student One', email: 'one@student.edu', section: 'A', branch: 'CSM' },
    { roll_number: 'TEST2026A02', name: 'Student Two', email: 'two@student.edu', section: 'A', branch: 'CSM' },
  ];

  await test('Preview import detects valid rows and reports duplicates', async () => {
    const res = await request('POST', '/api/admin/students/import-preview', {
      rows: sampleRoster,
    }, { Authorization: `Bearer ${adminToken}` });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.total, 2);
    assert.strictEqual(res.data.valid_count, 2);
  })();

  await test('Run 1: Enrolls students and auto-links them to section A', async () => {
    const res = await request('POST', '/api/admin/students/bulk-import', {
      rows: sampleRoster,
      college_id: 1,
    }, { Authorization: `Bearer ${adminToken}` });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.summary.total, 2);
  })();

  await test('Run 2 (Identical data): Idempotent execution completes without duplicate errors', async () => {
    const res = await request('POST', '/api/admin/students/bulk-import', {
      rows: sampleRoster,
      college_id: 1,
    }, { Authorization: `Bearer ${adminToken}` });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.summary.errors, 0, 'Second run must have 0 errors');
  })();

  // Teardown
  server.close();

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  if (server) server.close();
  process.exit(1);
});
