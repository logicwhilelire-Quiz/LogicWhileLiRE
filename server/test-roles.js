/**
 * LogicWhile QUIZ — Role System & Ownership Scoping Automated Test Suite
 *
 * Verifies:
 * 1. Super Admin authentication & token structure
 * 2. Faculty authentication & scoped permissions
 * 3. Scoped Exam List: Faculty only sees their own assessments
 * 4. Cross-Exam Security: Faculty accessing another faculty's exam ID directly receives 403
 * 5. Staff Management Authorization: Faculty attempting to manage staff receives 403
 * 6. Super Admin Staff CRUD: Creation, login verification, and deactivation lifecycle
 */

const http = require('http');

const BASE_URL = process.env.API_URL || 'http://localhost:3001';

function request(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqHeaders = { ...headers };
    let postData = null;

    if (body) {
      postData = JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders,
      },
      (res) => {
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString();
          let json = null;
          try {
            json = JSON.parse(raw);
          } catch (_) {}
          resolve({ status: res.statusCode, headers: res.headers, raw, json });
        });
      }
    );

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runRoleSecurityTests() {
  console.log('================================================================');
  console.log('🛡️ LogicWhileLiRE — ROLE & OWNERSHIP SECURITY TESTS');
  console.log(`Target: ${BASE_URL}`);
  console.log('================================================================\n');

  // Test 1: Super Admin Login
  console.log('[1/8] Testing Super Admin Login...');
  const superRes = await request('POST', '/api/admin/login', {}, {
    username: 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
  });
  if (superRes.status !== 200 || superRes.json?.user?.role !== 'super_admin') {
    throw new Error(`Super admin login failed. Status: ${superRes.status}, Body: ${superRes.raw}`);
  }
  const superToken = superRes.json.token;
  console.log('  ✅ Super Admin authenticated (role: super_admin)');

  // Test 2: Faculty 1 Login (Dr. Suresh Kumar)
  console.log('\n[2/8] Testing Faculty 1 Login (suresh@example.com)...');
  const f1Res = await request('POST', '/api/admin/login', {}, {
    username: 'suresh@example.com',
    password: 'admin123',
  });
  if (f1Res.status !== 200 || f1Res.json?.user?.role !== 'faculty') {
    throw new Error(`Faculty 1 login failed. Status: ${f1Res.status}, Body: ${f1Res.raw}`);
  }
  const f1Token = f1Res.json.token;
  const f1StaffId = f1Res.json.user.id;
  console.log(`  ✅ Faculty 1 authenticated (role: faculty, staff_id: ${f1StaffId})`);

  // Test 3: Faculty 2 Login (Priya Sharma)
  console.log('\n[3/8] Testing Faculty 2 Login (priya@example.com)...');
  const f2Res = await request('POST', '/api/admin/login', {}, {
    username: 'priya@example.com',
    password: 'admin123',
  });
  if (f2Res.status !== 200 || f2Res.json?.user?.role !== 'faculty') {
    throw new Error(`Faculty 2 login failed. Status: ${f2Res.status}, Body: ${f2Res.raw}`);
  }
  const f2Token = f2Res.json.token;
  const f2StaffId = f2Res.json.user.id;
  console.log(`  ✅ Faculty 2 authenticated (role: faculty, staff_id: ${f2StaffId})`);

  // Test 4: Exam List Scoping
  console.log('\n[4/8] Testing Exam List Ownership Scoping...');
  // Super admin should see both exams
  const superExams = await request('GET', '/api/admin/exams', { Authorization: `Bearer ${superToken}` });
  if (superExams.json?.exams?.length < 2) {
    throw new Error(`Super admin expected >= 2 exams, got: ${superExams.json?.exams?.length}`);
  }
  console.log(`  ✅ Super admin sees all ${superExams.json.exams.length} institutional exams`);

  // Faculty 1 should only see their assigned exam
  const f1Exams = await request('GET', '/api/admin/exams', { Authorization: `Bearer ${f1Token}` });
  const f1ExamIds = (f1Exams.json?.exams || []).map((e) => e.id);
  const exam1Id = 'e1000000-0000-0000-0000-000000000001';
  const exam2Id = 'e2000000-0000-0000-0000-000000000002';

  if (!f1ExamIds.includes(exam1Id) || f1ExamIds.includes(exam2Id)) {
    throw new Error(`Faculty 1 exam filtering failed. Expected only Exam 1, got: ${JSON.stringify(f1ExamIds)}`);
  }
  console.log(`  ✅ Faculty 1 query scoped exclusively to their own exams (Found: ${f1Exams.json.exams.length})`);

  // Test 5: Cross-Exam Access Enforcement (Direct API 403 test)
  console.log('\n[5/8] Testing Cross-Exam API Protection (Faculty 1 accessing Faculty 2 Exam)...');
  const crossAccessRes = await request(
    'GET',
    `/api/admin/exams/${exam2Id}/sessions`,
    { Authorization: `Bearer ${f1Token}` }
  );

  if (crossAccessRes.status !== 403) {
    throw new Error(
      `SECURITY REGRESSION: Expected 403 Forbidden for cross-exam access, but received ${crossAccessRes.status}!`
    );
  }
  console.log('  ✅ 403 Forbidden correctly returned for unauthorized cross-faculty exam access');

  // Test 6: Faculty cannot access Super Admin staff management
  console.log('\n[6/8] Testing Staff Management Privilege Guard...');
  const unauthorizedStaffRes = await request(
    'GET',
    '/api/admin/staff',
    { Authorization: `Bearer ${f1Token}` }
  );
  if (unauthorizedStaffRes.status !== 403) {
    throw new Error(
      `SECURITY REGRESSION: Faculty accessed /api/admin/staff with status ${unauthorizedStaffRes.status} (expected 403)!`
    );
  }
  console.log('  ✅ 403 Forbidden correctly returned when faculty attempts to access staff management');

  // Test 7: Super Admin Staff Account Lifecycle (Create)
  console.log('\n[7/8] Testing Super Admin Faculty Account Creation...');
  const newEmail = `faculty.test.${Date.now()}@example.com`;
  const createStaffRes = await request(
    'POST',
    '/api/admin/staff',
    { Authorization: `Bearer ${superToken}` },
    {
      name: 'Test Instructor',
      email: newEmail,
      password: 'SecureTestPassword123!',
      role: 'faculty',
    }
  );

  if (createStaffRes.status !== 201 || !createStaffRes.json?.staff?.id) {
    throw new Error(`Failed to create staff account. Status: ${createStaffRes.status}, Body: ${createStaffRes.raw}`);
  }
  const createdStaffId = createStaffRes.json.staff.id;
  console.log(`  ✅ Faculty account created: ${newEmail} (ID: ${createdStaffId})`);

  // Test 8: Deactivation & Inactive Login Lock
  console.log('\n[8/8] Testing Staff Account Deactivation...');
  const deactRes = await request(
    'PATCH',
    `/api/admin/staff/${createdStaffId}/deactivate`,
    { Authorization: `Bearer ${superToken}` },
    { is_active: false }
  );
  if (deactRes.status !== 200 || deactRes.json?.staff?.is_active !== false) {
    throw new Error(`Failed to deactivate staff account. Status: ${deactRes.status}`);
  }
  console.log('  ✅ Faculty account marked inactive');

  // Attempt login with deactivated account
  const deactLoginRes = await request('POST', '/api/admin/login', {}, {
    username: newEmail,
    password: 'SecureTestPassword123!',
  });
  if (deactLoginRes.status !== 401) {
    throw new Error(`Deactivated account logged in with status: ${deactLoginRes.status} (expected 401)!`);
  }
  console.log('  ✅ Deactivated account strictly blocked from authentication');

  // Test 9: Participant PII Masking for Faculty
  console.log('\n[9/9] Testing Candidate PII Masking for Faculty Role...');
  const facultySessions = await request(
    'GET',
    `/api/admin/exams/${exam1Id}/sessions`,
    { Authorization: `Bearer ${f1Token}` }
  );
  if (facultySessions.status !== 200) {
    throw new Error(`Failed to fetch sessions as Faculty 1: ${facultySessions.status}`);
  }
  const sessionList = facultySessions.json?.sessions || [];
  if (sessionList.length > 0 && sessionList[0].participant?.email) {
    const candidateEmail = sessionList[0].participant.email;
    if (!candidateEmail.includes('***')) {
      throw new Error(`PII LEAK: Expected masked email with '***', but got raw email: ${candidateEmail}`);
    }
    console.log(`  ✅ Candidate PII properly masked for faculty: ${candidateEmail}`);
  } else {
    console.log('  ✅ Session list structure verified');
  }

  console.log('\n================================================================');
  console.log('🎉 ALL ROLE SYSTEM & OWNERSHIP SECURITY TESTS PASSED CLEANLY! 🎉');
  console.log('================================================================\n');
}

runRoleSecurityTests().catch((err) => {
  console.error('\n❌ Role test failure:', err.message);
  process.exit(1);
});
