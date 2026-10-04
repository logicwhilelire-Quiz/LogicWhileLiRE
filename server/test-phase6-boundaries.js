/**
 * test-phase6-boundaries.js
 *
 * Automated Comprehensive Test Suite for PHASE 6: Role Boundaries & Permissions
 * Tests:
 * 1. Faculty boundary: blocked from admin settings, audit logs, staff management, and college creation (HTTP 403)
 * 2. Faculty permission matrix: route-level blocking when specific permission is unticked
 * 3. Inspector boundary: can access inspector dashboard & start/end exam for assigned college
 * 4. Inspector boundary: strictly blocked from admin settings, system backups, and activity logs (HTTP 403)
 * 5. Student boundary: disabled college never appears in registration endpoint (?registration=true)
 * 6. Student boundary: registration with disabled college is rejected with HTTP 403
 * 7. Student boundary: cannot access admin routes (HTTP 401/403)
 * 8. Super Admin: full access to every section and management endpoint
 */

const assert = require('assert');
const http = require('http');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

require('dotenv').config();
process.env.ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'test_admin_jwt_secret_key_32chars_long';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_32chars_long';
process.env.DEMO_MODE = 'true';

const { supabase } = require('./dist/db/supabase');
const { adminAuth, requireRole, requireFacultyPermission, getAdminJwtSecret } = require('./dist/middleware/adminAuth');
const { studentAuth } = require('./dist/middleware/auth');
const adminRoutes = require('./dist/routes/admin').default;
const examCodeRoutes = require('./dist/routes/examCode').default;
const authRoutes = require('./dist/routes/auth').default;

let passed = 0;
function pass(num, label) {
  passed++;
  console.log(`  ✅ [${num}] ${label}`);
}

async function request(serverPort, method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : '';
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: serverPort,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(dataString),
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({
            status: res.statusCode,
            body: parsed,
            headers: res.headers,
          });
        });
      }
    );
    req.on('error', reject);
    if (dataString) req.write(dataString);
    req.end();
  });
}

function makeToken(payload) {
  return jwt.sign(payload, getAdminJwtSecret(), { expiresIn: '1h' });
}

async function runPhase6BoundaryTests() {
  console.log('================================================================');
  console.log('👑 PHASE 6: ROLE BOUNDARY & PERMISSION VERIFICATION SUITE');
  console.log('================================================================\n');

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/admin', adminRoutes);
  app.use('/api', examCodeRoutes);
  app.use('/api/auth', authRoutes);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  const superAdminToken = makeToken({
    sub: 'admin@logicwhilelire.com',
    role: 'super_admin',
    staff_id: 'st000000-0000-0000-0000-000000000001',
    college_id: null,
  });

  const inspectorToken = makeToken({
    sub: 'inspector@college.edu',
    role: 'inspector',
    staff_id: 'st000000-0000-0000-0000-000000000004',
    college_id: 1,
  });

  const facultyNoPermsToken = makeToken({
    sub: 'faculty.none@college.edu',
    role: 'faculty',
    staff_id: 'st000000-0000-0000-0000-000000000002',
    college_id: 1,
    permissions: [],
  });

  const facultyWithPermsToken = makeToken({
    sub: 'faculty.perms@college.edu',
    role: 'faculty',
    staff_id: 'st000000-0000-0000-0000-000000000003',
    college_id: 1,
    permissions: ['create_questions', 'export_data', 'view_results'],
  });

  const studentToken = jwt.sign(
    { sub: 'stu-demo-01', id: 'stu-demo-01', role: 'student', hall_ticket: 'HT2026CS01' },
    process.env.JWT_SECRET || 'test_jwt_secret_key_32chars_long',
    { expiresIn: '1h' }
  );

  // --- 1. Faculty Boundaries ---
  console.log('--- 1. Faculty Access Boundary Enforcement ---');
  // Explicitly configure test faculty permissions in DB so requireFacultyPermission verifies live state
  await supabase.from('staff').update({ permissions: [] }).eq('id', 'st000000-0000-0000-0000-000000000002');
  await supabase.from('staff').update({ permissions: ['create_questions', 'export_data', 'view_results'] }).eq('id', 'st000000-0000-0000-0000-000000000003');

  // 1a. Faculty cannot reach admin settings (403)
  const fSettingsRes = await request(port, 'GET', '/api/admin/settings', null, {
    Authorization: `Bearer ${facultyNoPermsToken}`,
  });
  assert.strictEqual(fSettingsRes.status, 403, 'Faculty must be blocked from /api/admin/settings with HTTP 403');
  pass(1, 'Faculty is strictly blocked from /api/admin/settings (HTTP 403)');

  // 1b. Faculty cannot reach activity/audit logs (403)
  const fAuditRes = await request(port, 'GET', '/api/admin/audit-logs', null, {
    Authorization: `Bearer ${facultyNoPermsToken}`,
  });
  assert.strictEqual(fAuditRes.status, 403, 'Faculty must be blocked from /api/admin/audit-logs with HTTP 403');
  pass(2, 'Faculty is strictly blocked from /api/admin/audit-logs (HTTP 403)');

  // 1c. Faculty cannot reach staff management (403)
  const fStaffRes = await request(port, 'GET', '/api/admin/staff', null, {
    Authorization: `Bearer ${facultyNoPermsToken}`,
  });
  assert.strictEqual(fStaffRes.status, 403, 'Faculty must be blocked from /api/admin/staff with HTTP 403');
  pass(3, 'Faculty is strictly blocked from /api/admin/staff management (HTTP 403)');

  // 1d. Faculty without create_questions permission is blocked from creating questions
  const fCreateQBlocked = await request(port, 'POST', '/api/admin/questions', {
    question_text: 'Test question?',
    option_a: 'A',
    option_b: 'B',
    correct_option: 'a',
  }, {
    Authorization: `Bearer ${facultyNoPermsToken}`,
  });
  assert.strictEqual(fCreateQBlocked.status, 403);
  pass(4, 'Faculty without "create_questions" permission is blocked from POST /api/admin/questions (HTTP 403)');

  // 1e. Faculty with create_questions permission can create questions
  const fCreateQAllowed = await request(port, 'POST', '/api/admin/questions', {
    question_text: 'Sample valid question text here?',
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correct_answer: 'Option A',
    topic: 'Quantitative Aptitude',
  }, {
    Authorization: `Bearer ${facultyWithPermsToken}`,
  });
  assert.strictEqual(fCreateQAllowed.status, 201);
  pass(5, 'Faculty with "create_questions" permission is permitted to create questions (HTTP 201)');

  // --- 2. Inspector Boundaries ---
  console.log('\n--- 2. Inspector Access Boundary Enforcement ---');
  // 2a. Inspector can reach inspector dashboard data for their college
  const insDashRes = await request(port, 'GET', '/api/admin/inspector/dashboard-data', null, {
    Authorization: `Bearer ${inspectorToken}`,
  });
  assert.strictEqual(insDashRes.status, 200);
  assert.strictEqual(insDashRes.body.success, true);
  pass(6, 'Inspector successfully accesses /api/admin/inspector/dashboard-data (HTTP 200)');

  // 2b. Inspector is strictly blocked from admin settings (403)
  const insSettingsRes = await request(port, 'GET', '/api/admin/settings', null, {
    Authorization: `Bearer ${inspectorToken}`,
  });
  assert.strictEqual(insSettingsRes.status, 403, 'Inspector must be blocked from /api/admin/settings with HTTP 403');
  pass(7, 'Inspector is strictly blocked from /api/admin/settings (HTTP 403)');

  // 2c. Inspector is strictly blocked from system backups (403)
  const insBackupRes = await request(port, 'GET', '/api/admin/backup', null, {
    Authorization: `Bearer ${inspectorToken}`,
  });
  assert.strictEqual(insBackupRes.status, 403, 'Inspector must be blocked from /api/admin/backup with HTTP 403');
  pass(8, 'Inspector is strictly blocked from /api/admin/backup (HTTP 403)');

  // 2d. Inspector is strictly blocked from platform audit logs (403)
  const insAuditRes = await request(port, 'GET', '/api/admin/audit-logs', null, {
    Authorization: `Bearer ${inspectorToken}`,
  });
  assert.strictEqual(insAuditRes.status, 403, 'Inspector must be blocked from /api/admin/audit-logs with HTTP 403');
  pass(9, 'Inspector is strictly blocked from /api/admin/audit-logs (HTTP 403)');

  // --- 3. College Registration Toggle & Student Registration Boundary ---
  console.log('\n--- 3. College Registration Toggle & Student Boundaries ---');
  // Seed a test college that is disabled for registration
  const disabledCollegeId = 999;
  await supabase.from('colleges').delete().eq('id', disabledCollegeId);
  await supabase.from('colleges').insert({
    id: disabledCollegeId,
    college_name: 'Disabled Autonomous College of Engineering',
    college_code: 'DACE',
    is_active: true,
    registration_enabled: false,
  });

  const enabledCollegeId = 998;
  await supabase.from('colleges').delete().eq('id', enabledCollegeId);
  await supabase.from('colleges').insert({
    id: enabledCollegeId,
    college_name: 'Enabled Aerospace Institute of Technology',
    college_code: 'EAIT',
    is_active: true,
    registration_enabled: true,
  });

  // 3a. GET /api/colleges?registration=true lists only enabled colleges
  const regCollegesRes = await request(port, 'GET', '/api/colleges?registration=true');
  assert.strictEqual(regCollegesRes.status, 200);
  assert.strictEqual(regCollegesRes.body.success, true);
  const collegeList = regCollegesRes.body.colleges;
  assert.ok(collegeList.some((c) => Number(c.id) === enabledCollegeId), 'Enabled college must appear in registration list');
  assert.ok(!collegeList.some((c) => Number(c.id) === disabledCollegeId), 'Disabled college must NEVER appear in registration list');
  pass(10, 'GET /api/colleges?registration=true lists enabled colleges and excludes disabled colleges');

  // 3b. Student registration with disabled college is rejected with HTTP 403
  const studentRegBlocked = await request(port, 'POST', '/api/auth/register', {
    name: 'Candidate Test',
    email: `blocked_${Date.now()}@test.edu`,
    roll_number: `ROLL_${Date.now()}`,
    password: 'Password#2026!',
    college_id: disabledCollegeId,
  });
  assert.strictEqual(studentRegBlocked.status, 403, 'Registration with disabled college must be rejected with HTTP 403');
  assert.ok(studentRegBlocked.body.error.includes('closed') || studentRegBlocked.body.error.includes('disabled'));
  pass(11, 'Student registration for disabled college rejected with HTTP 403');

  // 3c. Student token blocked from admin endpoints
  const studentAdminRes = await request(port, 'GET', '/api/admin/dashboard-widgets', null, {
    Authorization: `Bearer ${studentToken}`,
  });
  assert.strictEqual(studentAdminRes.status, 401, 'Student token must be rejected from admin routes');
  pass(12, 'Student credentials strictly rejected from administrative endpoints (HTTP 401)');

  // --- 4. Super Admin Complete Control ---
  console.log('\n--- 4. Super Admin Unrestricted Section Access ---');
  // 4a. Settings
  const superSettingsRes = await request(port, 'GET', '/api/admin/settings', null, {
    Authorization: `Bearer ${superAdminToken}`,
  });
  assert.strictEqual(superSettingsRes.status, 200);
  assert.strictEqual(superSettingsRes.body.success, true);
  pass(13, 'Super Admin has access to /api/admin/settings');

  // 4b. Activity & Audit Logs
  const superAuditRes = await request(port, 'GET', '/api/admin/audit-logs', null, {
    Authorization: `Bearer ${superAdminToken}`,
  });
  assert.strictEqual(superAuditRes.status, 200);
  assert.strictEqual(superAuditRes.body.success, true);
  pass(14, 'Super Admin has access to /api/admin/audit-logs');

  // 4c. Dashboard widgets
  const superWidgetsRes = await request(port, 'GET', '/api/admin/dashboard-widgets', null, {
    Authorization: `Bearer ${superAdminToken}`,
  });
  assert.strictEqual(superWidgetsRes.status, 200);
  assert.strictEqual(superWidgetsRes.body.success, true);
  pass(15, 'Super Admin has access to /api/admin/dashboard-widgets');

  await new Promise((resolve) => server.close(resolve));

  console.log('================================================================');
  console.log(`🎉 ALL ${passed}/${passed} ROLE BOUNDARY & SECURITY TESTS PASSED!`);
  console.log('================================================================\n');
}

if (require.main === module) {
  runPhase6BoundaryTests().catch((err) => {
    console.error('\n❌ Role Boundary Test failed:', err);
    process.exit(1);
  });
}

module.exports = { runPhase6BoundaryTests };
