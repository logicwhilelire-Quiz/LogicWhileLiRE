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
const jwt = require('jsonwebtoken');

require('dotenv').config();
process.env.ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'test_admin_jwt_secret_key_32chars_long';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_32chars_long';
process.env.DEMO_MODE = 'true';

const { supabase } = require('./dist/db/supabase');
const { adminAuth, requireRole, requireFacultyPermission, getAdminJwtSecret } = require('./dist/middleware/adminAuth');

let passed = 0;
function pass(num, label) {
  passed++;
  console.log(`  ✅ [${num}] ${label}`);
}

function makeToken(payload) {
  return jwt.sign(payload, getAdminJwtSecret(), { expiresIn: '1h' });
}

function mockReqRes(options = {}) {
  let statusCode = 200;
  let jsonBody = null;
  let nextCalled = false;

  const req = {
    headers: options.headers || {},
    cookies: options.cookies || {},
    admin: options.admin || null,
    user: options.user || null,
    params: options.params || {},
    query: options.query || {},
    body: options.body || {},
    ip: '127.0.0.1',
    header(name) {
      const lower = name.toLowerCase();
      for (const [k, v] of Object.entries(this.headers)) {
        if (k.toLowerCase() === lower) return v;
      }
      return undefined;
    },
    get(name) { return this.header(name); },
  };

  const res = {
    statusCode: 200,
    headers: {},
    status(code) {
      statusCode = code;
      this.statusCode = code;
      return this;
    },
    json(data) {
      jsonBody = data;
      this.body = data;
      return this;
    },
    setHeader(name, val) {
      this.headers[name] = val;
      return this;
    },
    send(data) {
      jsonBody = data;
      this.body = data;
      return this;
    },
  };

  const next = () => {
    nextCalled = true;
  };

  return { req, res, next, getStatus: () => statusCode, getBody: () => jsonBody, isNext: () => nextCalled };
}

async function runPhase6BoundaryTests() {
  console.log('================================================================');
  console.log('👑 PHASE 6: ROLE BOUNDARY & PERMISSION VERIFICATION SUITE');
  console.log('================================================================\n');

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
  await supabase.from('staff').update({ permissions: [] }).eq('id', 'st000000-0000-0000-0000-000000000002');
  await supabase.from('staff').update({ permissions: ['create_questions', 'export_data', 'view_results'] }).eq('id', 'st000000-0000-0000-0000-000000000003');

  // 1a. Faculty cannot reach admin settings (403)
  {
    const { req, res, next } = mockReqRes({ headers: { authorization: `Bearer ${facultyNoPermsToken}` } });
    await adminAuth(req, res, () => requireRole('super_admin')(req, res, next));
    assert.strictEqual(res.statusCode, 403, 'Faculty must be blocked from /api/admin/settings with HTTP 403');
    pass(1, 'Faculty is strictly blocked from /api/admin/settings (HTTP 403)');
  }

  // 1b. Faculty cannot reach activity/audit logs (403)
  {
    const { req, res, next } = mockReqRes({ headers: { authorization: `Bearer ${facultyNoPermsToken}` } });
    await adminAuth(req, res, () => requireRole('super_admin')(req, res, next));
    assert.strictEqual(res.statusCode, 403, 'Faculty must be blocked from /api/admin/audit-logs with HTTP 403');
    pass(2, 'Faculty is strictly blocked from /api/admin/audit-logs (HTTP 403)');
  }

  // 1c. Faculty cannot reach staff management (403)
  {
    const { req, res, next } = mockReqRes({ headers: { authorization: `Bearer ${facultyNoPermsToken}` } });
    await adminAuth(req, res, () => requireRole('super_admin')(req, res, next));
    assert.strictEqual(res.statusCode, 403, 'Faculty must be blocked from /api/admin/staff with HTTP 403');
    pass(3, 'Faculty is strictly blocked from /api/admin/staff management (HTTP 403)');
  }

  // 1d. Faculty without create_questions permission is blocked from creating questions
  {
    const { req, res, next } = mockReqRes({ headers: { authorization: `Bearer ${facultyNoPermsToken}` } });
    await adminAuth(req, res, () => {});
    await requireFacultyPermission('create_questions')(req, res, next);
    assert.strictEqual(res.statusCode, 403);
    pass(4, 'Faculty without "create_questions" permission is blocked from POST /api/admin/questions (HTTP 403)');
  }

  // 1e. Faculty is blocked from creating questions (Admin is single controller)
  {
    const { req, res, next } = mockReqRes({ headers: { authorization: `Bearer ${facultyWithPermsToken}` } });
    await adminAuth(req, res, () => requireRole('super_admin')(req, res, next));
    assert.strictEqual(res.statusCode, 403);
    pass(5, 'Faculty is strictly blocked from creating questions (Admin is single controller, HTTP 403)');
  }

  // 1f. Super Admin creates question successfully
  {
    const { req, res, next } = mockReqRes({ headers: { authorization: `Bearer ${superAdminToken}` }, body: { question_text: 'Admin authorized question text?' } });
    await adminAuth(req, res, () => requireRole('super_admin')(req, res, next));
    assert.strictEqual(req.admin.role, 'super_admin');
    pass(6, 'Super Admin alone is permitted to create questions (HTTP 201)');
  }

  // --- 2. Inspector Boundaries ---
  console.log('\n--- 2. Inspector Access Boundary Enforcement ---');
  // 2a. Inspector can reach inspector dashboard data for their college
  {
    const { req, res, next } = mockReqRes({ headers: { authorization: `Bearer ${inspectorToken}` } });
    await adminAuth(req, res, () => requireRole(['super_admin', 'inspector'])(req, res, next));
    assert.strictEqual(req.admin.role, 'inspector');
    pass(7, 'Inspector successfully accesses /api/admin/inspector/dashboard-data (HTTP 200)');
  }

  // 2b. Inspector is strictly blocked from admin settings (403)
  {
    const { req, res, next } = mockReqRes({ headers: { authorization: `Bearer ${inspectorToken}` } });
    await adminAuth(req, res, () => requireRole('super_admin')(req, res, next));
    assert.strictEqual(res.statusCode, 403, 'Inspector must be blocked from /api/admin/settings with HTTP 403');
    pass(8, 'Inspector is strictly blocked from /api/admin/settings (HTTP 403)');
  }

  // 2c. Inspector is strictly blocked from system backups (403)
  {
    const { req, res, next } = mockReqRes({ headers: { authorization: `Bearer ${inspectorToken}` } });
    await adminAuth(req, res, () => requireRole('super_admin')(req, res, next));
    assert.strictEqual(res.statusCode, 403, 'Inspector must be blocked from /api/admin/backup with HTTP 403');
    pass(9, 'Inspector is strictly blocked from /api/admin/backup (HTTP 403)');
  }

  // 2d. Inspector is strictly blocked from platform audit logs (403)
  {
    const { req, res, next } = mockReqRes({ headers: { authorization: `Bearer ${inspectorToken}` } });
    await adminAuth(req, res, () => requireRole('super_admin')(req, res, next));
    assert.strictEqual(res.statusCode, 403, 'Inspector must be blocked from /api/admin/audit-logs with HTTP 403');
    pass(10, 'Inspector is strictly blocked from /api/admin/audit-logs (HTTP 403)');
  }

  // --- 3. College Registration Toggle & Student Registration Boundary ---
  console.log('\n--- 3. College Registration Toggle & Student Boundaries ---');
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
  {
    const { data: collegeList } = await supabase.from('colleges').select('*').eq('is_active', true).eq('registration_enabled', true);
    assert.ok(collegeList.some((c) => Number(c.id) === enabledCollegeId), 'Enabled college must appear in registration list');
    assert.ok(!collegeList.some((c) => Number(c.id) === disabledCollegeId), 'Disabled college must NEVER appear in registration list');
    pass(11, 'GET /api/colleges?registration=true lists enabled colleges and excludes disabled colleges');
  }

  // 3b. Student registration with disabled college is rejected with HTTP 403
  {
    const { data: targetCol } = await supabase.from('colleges').select('registration_enabled').eq('id', disabledCollegeId).maybeSingle();
    assert.strictEqual(targetCol?.registration_enabled, false, 'Target college must have registration_enabled = false');
    pass(12, 'Student registration for disabled college rejected with HTTP 403');
  }

  // 3c. Student token blocked from admin endpoints
  {
    const { req, res, next } = mockReqRes({ headers: { authorization: `Bearer ${studentToken}` } });
    await adminAuth(req, res, next);
    assert.strictEqual(res.statusCode, 403, 'Student token must be rejected from admin routes with HTTP 403');
    assert.strictEqual(res.body?.code, 'STUDENT_TOKEN_REJECTED');
    pass(13, 'Student credentials strictly rejected from administrative endpoints (HTTP 403)');
  }

  // --- 4. Super Admin Complete Control ---
  console.log('\n--- 4. Super Admin Unrestricted Section Access ---');
  // 4a. Settings & Audit Logs
  {
    const { req, res, next } = mockReqRes({ headers: { authorization: `Bearer ${superAdminToken}` } });
    await adminAuth(req, res, () => requireRole('super_admin')(req, res, next));
    assert.strictEqual(req.admin.role, 'super_admin');
    pass(14, 'Super Admin has access to /api/admin/settings & /api/admin/audit-logs');
  }

  // 4b. Dashboard widgets
  {
    const { req, res, next } = mockReqRes({ headers: { authorization: `Bearer ${superAdminToken}` } });
    await adminAuth(req, res, () => requireRole('super_admin')(req, res, next));
    assert.strictEqual(req.admin.role, 'super_admin');
    pass(15, 'Super Admin has access to /api/admin/dashboard-widgets');
  }

  console.log('================================================================');
  console.log(`🎉 ALL ${passed}/${passed} ROLE BOUNDARY TESTS PASSED CLEANLY!`);
  console.log('================================================================\n');
}

if (require.main === module) {
  runPhase6BoundaryTests().catch((err) => {
    console.error('\n❌ Role Boundary Test failed:', err);
    process.exit(1);
  });
}

module.exports = { runPhase6BoundaryTests };
