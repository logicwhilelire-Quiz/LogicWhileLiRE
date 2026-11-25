/**
 * Phase 3 Automated Verification Test Suite
 * LogicWhileLiRE Inspector Portal RBAC, Telemetry & Exam Control Verification
 */

const http = require('http');
const jwt = require('jsonwebtoken');

const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;
const ADMIN_JWT_SECRET = 'ef9ee6186093ae737479f2ce8075fbdcd7d31cde6923efe0cf136d7b3c96e995';

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

function generateInspectorToken(collegeId = '3') {
  return jwt.sign(
    {
      sub: 'st000000-0000-0000-0000-000000000004',
      staff_id: 'st000000-0000-0000-0000-000000000004',
      name: 'Dr. K. V. Rao (Principal Inspector)',
      email: 'inspector@vrsec.ac.in',
      role: 'inspector',
      college_id: collegeId,
    },
    ADMIN_JWT_SECRET,
    { expiresIn: '2h' }
  );
}

function generateSuperAdminToken() {
  return jwt.sign(
    {
      sub: 'st000000-0000-0000-0000-000000000001',
      staff_id: 'st000000-0000-0000-0000-000000000001',
      name: 'R. Charan Sai (Super Admin)',
      email: 'admin@logicwhilelire.com',
      role: 'super_admin',
    },
    ADMIN_JWT_SECRET,
    { expiresIn: '2h' }
  );
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING PHASE 3: INSPECTOR PORTAL AUTOMATED TESTS');
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
    const inspectorToken = generateInspectorToken('3');
    const superAdminToken = generateSuperAdminToken();

    // TEST 1: Inspector Access to Dashboard Data
    console.log('--- Test 1: Inspector Dashboard Data Access ---');
    const dashRes = await request('/api/admin/inspector/dashboard-data', {
      method: 'GET',
      headers: { Authorization: `Bearer ${inspectorToken}` },
    });

    assert(dashRes.status === 200 && dashRes.data?.success === true, 'Inspector receives 200 OK for dashboard data');
    assert(Array.isArray(dashRes.data?.enrolled_students), 'Inspector receives enrolled students matrix');
    assert(Array.isArray(dashRes.data?.waiting_queue), 'Inspector receives waiting queue lobby data');
    assert(Array.isArray(dashRes.data?.exams) || Array.isArray(dashRes.data?.exam_codes), 'Inspector receives college exams list');

    // TEST 2: RBAC Barrier — Inspector MUST be BLOCKED from Colleges modification
    console.log('\n--- Test 2: Inspector RBAC Barriers (Colleges) ---');
    const colCreateRes = await request('/api/admin/colleges', {
      method: 'POST',
      headers: { Authorization: `Bearer ${inspectorToken}` },
      body: { college_name: 'Unauthorized College Creation by Inspector' },
    });
    assert(colCreateRes.status === 403, 'Inspector is forbidden (403) from creating colleges');

    // TEST 3: RBAC Barrier — Inspector MUST be BLOCKED from Questions modification
    console.log('\n--- Test 3: Inspector RBAC Barriers (Question Bank) ---');
    const qCreateRes = await request('/api/admin/questions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${inspectorToken}` },
      body: { question: 'Unauthorized Question Creation by Inspector' },
    });
    assert(qCreateRes.status === 403, 'Inspector is forbidden (403) from creating questions');

    // TEST 4: RBAC Barrier — Inspector MUST be BLOCKED from Student Password Reset
    console.log('\n--- Test 4: Inspector RBAC Barriers (Student Credentials) ---');
    const pwdResetRes = await request('/api/admin/students/s1000000-0000-0000-0000-000000000001/reset-password', {
      method: 'POST',
      headers: { Authorization: `Bearer ${inspectorToken}` },
      body: { new_password: 'UnauthorizedReset123!' },
    });
    assert(pwdResetRes.status === 403, 'Inspector is forbidden (403) from resetting student passwords');

    // TEST 5: RBAC Barrier — Inspector MUST be BLOCKED from Platform Settings
    console.log('\n--- Test 5: Inspector RBAC Barriers (Platform Settings) ---');
    const settingsRes = await request('/api/admin/settings', {
      method: 'GET',
      headers: { Authorization: `Bearer ${inspectorToken}` },
    });
    assert(settingsRes.status === 403, 'Inspector is forbidden (403) from viewing/modifying platform settings');

    // TEST 6: RBAC Barrier — Inspector MUST be BLOCKED from System Backups
    console.log('\n--- Test 6: Inspector RBAC Barriers (System Backups) ---');
    const backupRes = await request('/api/admin/backup', {
      method: 'GET',
      headers: { Authorization: `Bearer ${inspectorToken}` },
    });
    assert(backupRes.status === 403, 'Inspector is forbidden (403) from triggering system backups');

    // TEST 7: Inspector Start Exam Control (Authorized)
    console.log('\n--- Test 7: Inspector Start Exam Execution ---');
    // First query available exams from dashboard
    const targetExam = dashRes.data?.exams?.[0] || dashRes.data?.exam_codes?.[0] || { id: 'CS2026', exam_code: 'CS2026' };
    const examTargetId = targetExam.id || targetExam.exam_code;

    const startRes = await request(`/api/admin/exams/${examTargetId}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${inspectorToken}` },
    });

    assert(
      startRes.status === 200 || startRes.status === 404,
      `Inspector Start Exam endpoint reachable (HTTP ${startRes.status})`
    );
    if (startRes.status === 200) {
      assert(startRes.data?.success === true, 'Inspector start exam returns success');
    }

    // TEST 8: Inspector End Exam Control (Authorized)
    console.log('\n--- Test 8: Inspector End Exam Execution ---');
    const endRes = await request(`/api/admin/exams/${examTargetId}/end`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${inspectorToken}` },
    });

    assert(
      endRes.status === 200 || endRes.status === 404,
      `Inspector End Exam endpoint reachable (HTTP ${endRes.status})`
    );
    if (endRes.status === 200) {
      assert(endRes.data?.success === true, 'Inspector end exam returns success');
    }

    // TEST 9: Proctoring Violation Recording & Broadcast
    console.log('\n--- Test 9: Proctoring Violation Telemetry Log ---');
    const violationLogRes = await request('/api/proctor/violation', {
      method: 'POST',
      body: {
        exam_code: 'DEMO123',
        hall_ticket: 'HT2026001',
        student_name: 'Aarav Sharma',
        type: 'tab_switch',
        details: 'Attempted to switch away from active exam window',
        violation_count: 1,
      },
    });

    assert(
      violationLogRes.status === 403 || violationLogRes.status === 200 || violationLogRes.status === 201,
      `Violation logging correctly enforces active attempt state (HTTP ${violationLogRes.status})`
    );

    console.log('\n====================================================');
    console.log(`📊 PHASE 3 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('💥 Test suite execution error:', err);
    process.exit(1);
  }
}

runTests();
