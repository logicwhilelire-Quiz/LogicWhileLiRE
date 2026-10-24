/**
 * Phase 2 Automated Verification Test Suite
 * LogicWhileLiRE Admin Portal Full Control & Security Verification
 */

const http = require('http');

const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed,
        });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING PHASE 2: ADMIN PORTAL AUTOMATED TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // TEST 1: Admin Login with Authoritative Credentials
    console.log('--- Test 1: Admin Authentication ---');
    const adminPassword = process.env.ADMIN_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD;
    if (!adminPassword) throw new Error('ADMIN_PASSWORD required in environment');
    const loginRes = await request('/api/admin/login', {
      method: 'POST',
      body: {
        username: process.env.ADMIN_USERNAME || 'admin',
        password: adminPassword,
      },
    });

    assert(loginRes.status === 200 && loginRes.data?.success === true, 'Admin login succeeds');
    assert(!!loginRes.data?.token, 'Admin receives JWT authorization token');
    const adminToken = loginRes.data?.token;

    // TEST 2: Trigger Auth Failure for System Alerting Agent Verification
    console.log('\n--- Test 2: System Alerting Agent on Auth Failure ---');
    const badLoginRes = await request('/api/admin/login', {
      method: 'POST',
      body: {
        username: 'intruder_admin',
        password: 'WrongPassword999!',
      },
    });
    assert(badLoginRes.status === 401 || badLoginRes.status === 423, 'Unauthorized login blocked');

    // TEST 3: System Alert Feed Query
    console.log('\n--- Test 3: System Alert Feed API ---');
    const alertsRes = await request('/api/admin/system-alerts', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert(alertsRes.status === 200 && alertsRes.data?.success === true, 'GET /api/admin/system-alerts returns 200');
    assert(Array.isArray(alertsRes.data?.alerts), 'System alerts returned as array');
    const hasAuthFailureAlert = alertsRes.data?.alerts?.some(
      (a) => a.type === 'AUTH_FAILURE' && (a.message.includes('intruder_admin') || a.details?.targetUser === 'intruder_admin')
    );
    assert(hasAuthFailureAlert, 'System Alerting Agent recorded auth failure in real-time alert buffer');

    // TEST 4: Add Student / Candidate with College, Section, Batch & Auto Gate Passes
    console.log('\n--- Test 4: Admin Student Creation with Auto Gate Passes ---');
    const testRoll = `P2TEST${Math.floor(1000 + Math.random() * 9000)}`;
    const studentCreateRes = await request('/api/admin/students', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: 'Phase 2 Candidate Test',
        email: `p2test_${Date.now()}@example.com`,
        roll_number: testRoll,
        college_id: 'col-001',
        college_name: 'CMR Institute of Technology',
        department: 'CSE',
        branch: 'CSE',
        year: 3,
        section: 'A',
        batch: 'Batch Alpha (2023-2027)',
      },
    });

    console.log('studentCreateRes:', studentCreateRes.status, studentCreateRes.data);
    assert(
      studentCreateRes.status === 201 || studentCreateRes.status === 200,
      `Student creation response status: ${studentCreateRes.status}`
    );
    const createdStudent = studentCreateRes.data?.student || studentCreateRes.data;
    assert(createdStudent && createdStudent.roll_number === testRoll, 'Student record created successfully');
    assert(
      typeof createdStudent.student_gate_pass === 'string' && createdStudent.student_gate_pass.startsWith('GP-STU-'),
      `Student Gate Pass generated with GP-STU prefix: ${createdStudent.student_gate_pass}`
    );
    assert(
      typeof createdStudent.candidate_gate_pass === 'string' && createdStudent.candidate_gate_pass.startsWith('GP-CAND-'),
      `Candidate Gate Pass generated with GP-CAND prefix: ${createdStudent.candidate_gate_pass}`
    );

    // TEST 5: Verify Student Listing includes Gate Passes & Section/Batch
    console.log('\n--- Test 5: Admin Student Roster Listing ---');
    const listStudentsRes = await request('/api/admin/students', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    console.log('listStudentsRes:', listStudentsRes.status, listStudentsRes.data);

    assert(listStudentsRes.status === 200, 'GET /api/admin/students returns 200');
    const studentsList = listStudentsRes.data?.students || listStudentsRes.data || [];
    const foundStudent = studentsList.find((s) => s.roll_number === testRoll);
    assert(!!foundStudent, 'Newly created student retrieved in administrative roster');
    assert(
      foundStudent?.student_gate_pass && foundStudent?.candidate_gate_pass,
      'Student record in roster maintains both Gate Passes'
    );

    // TEST 6: Pre-Exam Inspector Dashboard Data (Authoritative Enrolled Roster vs Live Lobby Queue)
    console.log('\n--- Test 6: Pre-Exam Dual Roster & Lobby Queue ---');
    const dashboardRes = await request('/api/admin/inspector/dashboard-data', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert(dashboardRes.status === 200, 'GET /api/admin/inspector/dashboard-data returns 200');
    assert(Array.isArray(dashboardRes.data?.enrolled_students), 'Enrolled students roster returned in inspector data');
    assert(dashboardRes.data?.enrolled_students.length > 0, 'Enrolled students count > 0');
    assert(Array.isArray(dashboardRes.data?.waiting_queue), 'Waiting queue returned in inspector data');
    const sampleEnrolled = dashboardRes.data?.enrolled_students[0];
    assert(
      sampleEnrolled && (sampleEnrolled.student_gate_pass || sampleEnrolled.candidate_gate_pass || sampleEnrolled.roll_number),
      'Enrolled roster includes roll number and gate pass credentials'
    );

    console.log('\n====================================================');
    console.log(`📊 PHASE 2 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('💥 Test suite execution error:', err);
    process.exit(1);
  }
}

runTests();
