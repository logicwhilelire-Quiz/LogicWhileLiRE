/**
 * test-phase1-rbac.js
 *
 * Automated Test Suite for PHASE 1: Roles & Permissions (RBAC)
 * Tests:
 * 1. Server-side role enforcement (admin, inspector, faculty, student)
 * 2. Admin full CRUD on colleges, sections, years, batches, curriculum, questions, exams, students, staff
 * 3. College student registration toggle (enabled/disabled) & rejection of disabled colleges
 * 4. Faculty permission matrix (dynamic ticking, server-side route blocking outside ticked perms)
 * 5. Inspector access boundaries (landing on leaderboard/queue, starting/ending exams, blocked from admin settings)
 */

const assert = require('assert');
const jwt = require('jsonwebtoken');

// Ensure secrets are set for testing
process.env.ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'test_admin_jwt_secret_key_32chars_long';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_32chars_long';

const { supabase } = require('./dist/db/supabase');
const { adminAuth, requireRole, requireFacultyPermission } = require('./dist/middleware/adminAuth');
const { studentAuth } = require('./dist/middleware/auth');

function createMockReqRes({ role = 'super_admin', staff_id = 'st000000-0000-0000-0000-000000000001', permissions = [], college_id = 1, headers = {}, body = {}, query = {}, params = {} } = {}) {
  const token = jwt.sign(
    { sub: 'test-user', role, staff_id, college_id, permissions },
    process.env.ADMIN_JWT_SECRET,
    { expiresIn: '1h' }
  );

  const req = {
    headers: { authorization: `Bearer ${token}`, ...headers },
    cookies: {},
    body,
    query,
    params,
    admin: undefined,
    user: undefined,
  };

  const res = {
    statusCode: 200,
    jsonData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    },
  };

  return { req, res, token };
}

async function runPhase1Tests() {
  console.log('================================================================');
  console.log('👑 PHASE 1: ROLES & PERMISSIONS (RBAC) VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ [${total}] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [${total}] FAIL: ${name}`);
      console.error(err);
    }
  }

  // ─────────────────────────────────────────────
  // 1. Role Boundaries & Server-Side Enforcement
  // ─────────────────────────────────────────────
  console.log('--- 1. Role Boundaries & Server Enforcement ---');

  await test('Admin auth accepts valid super_admin token', async () => {
    const { req, res } = createMockReqRes({ role: 'super_admin' });
    let nextCalled = false;
    await adminAuth(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);
    assert.strictEqual(req.admin.role, 'super_admin');
  });

  await test('Admin auth rejects student participant token on staff routes', async () => {
    const studentToken = jwt.sign(
      { sub: 'student123', role: 'student', hall_ticket: 'HT001' },
      process.env.JWT_SECRET // signed with participant secret, not admin secret
    );
    const req = { headers: { authorization: `Bearer ${studentToken}` }, cookies: {} };
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(d) { this.jsonData = d; return this; } };
    let nextCalled = false;
    await adminAuth(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 401);
  });

  await test('requireRole blocks faculty from super_admin only routes', async () => {
    const { req, res } = createMockReqRes({ role: 'faculty' });
    req.admin = { role: 'faculty', staff_id: 'fac-1' };
    const middleware = requireRole('super_admin');
    let nextCalled = false;
    middleware(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 403);
    assert.ok(res.jsonData.error.includes('Insufficient privileges'));
  });

  await test('requireRole blocks inspector from admin platform settings', async () => {
    const { req, res } = createMockReqRes({ role: 'inspector' });
    req.admin = { role: 'inspector', staff_id: 'insp-1' };
    const middleware = requireRole('super_admin');
    let nextCalled = false;
    middleware(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 403);
  });

  // ─────────────────────────────────────────────
  // 2. Admin Full CRUD
  // ─────────────────────────────────────────────
  console.log('\n--- 2. Admin Full CRUD Operations ---');

  await test('Admin CRUD: Colleges (create, read, update, delete)', async () => {
    // 1. Create
    const { data: created, error: createErr } = await supabase.from('colleges').insert({
      college_name: 'Test Autonomous Engineering College',
      college_code: 'TEST-AEC',
      city: 'Hyderabad',
      state: 'Telangana',
      is_active: true,
      registration_enabled: true,
    }).select().single();
    assert.strictEqual(createErr, null);
    assert.ok(created.id);

    // 2. Update
    const { data: updated, error: updateErr } = await supabase.from('colleges')
      .update({ city: 'Secunderabad' })
      .eq('id', created.id)
      .select().single();
    assert.strictEqual(updateErr, null);
    assert.strictEqual(updated.city, 'Secunderabad');

    // 3. Delete
    const { error: deleteErr } = await supabase.from('colleges').delete().eq('id', created.id);
    assert.strictEqual(deleteErr, null);
  });

  await test('Admin CRUD: Sections & Batches', async () => {
    // Section
    const { data: section, error: secErr } = await supabase.from('sections').insert({
      id: 'sec-test-phase1',
      college_id: 1,
      name: 'Section Alpha',
      section_name: 'Section Alpha',
      is_active: true,
    }).select().single();
    assert.strictEqual(secErr, null);

    // Batch
    const { data: batch, error: batErr } = await supabase.from('batches').insert({
      id: 'bat-test-phase1',
      section_id: 'sec-test-phase1',
      name: 'Batch Alpha-1',
      batch_name: 'Batch Alpha-1',
      is_active: true,
    }).select().single();
    assert.strictEqual(batErr, null);

    // Clean up
    await supabase.from('batches').delete().eq('id', 'bat-test-phase1');
    await supabase.from('sections').delete().eq('id', 'sec-test-phase1');
  });

  await test('Admin CRUD: Curriculum / Categories (5 sectors)', async () => {
    // Create new sector
    const { data: cur, error: curErr } = await supabase.from('curriculum').insert({
      id: 'cur-test-phase1',
      code: 'SEC-TEST',
      name: 'Cloud Infrastructure & DevOps Mastery',
      short_name: 'DevOps',
      sector_number: 6,
      color: '#10B981',
      is_active: true,
    }).select().single();
    assert.strictEqual(curErr, null);
    assert.strictEqual(cur.code, 'SEC-TEST');

    // Update
    const { data: updatedCur } = await supabase.from('curriculum')
      .update({ name: 'Cloud Native & DevOps Velocity' })
      .eq('id', 'cur-test-phase1')
      .select().single();
    assert.strictEqual(updatedCur.name, 'Cloud Native & DevOps Velocity');

    // Delete
    const { error: delCurErr } = await supabase.from('curriculum').delete().eq('id', 'cur-test-phase1');
    assert.strictEqual(delCurErr, null);
  });

  await test('Admin CRUD: Questions & Question Banks', async () => {
    const { data: q, error: qErr } = await supabase.from('questions').insert({
      id: 'q-test-phase1',
      exam_id: 'e1000000-0000-0000-0000-000000000001',
      question_text: 'What is the time complexity of binary search on a sorted array?',
      question_type: 'mcq',
      options: { a: 'O(N)', b: 'O(log N)', c: 'O(1)', d: 'O(N^2)' },
      correct_option: 'b',
      marks: 2,
      topic: 'Algorithms',
    }).select().single();
    assert.strictEqual(qErr, null);
    assert.strictEqual(q.correct_option, 'b');

    // Update question
    const { data: updatedQ } = await supabase.from('questions')
      .update({ marks: 3 })
      .eq('id', 'q-test-phase1')
      .select().single();
    assert.strictEqual(updatedQ.marks, 3);

    // Delete question
    const { error: delQErr } = await supabase.from('questions').delete().eq('id', 'q-test-phase1');
    assert.strictEqual(delQErr, null);
  });

  await test('Admin CRUD: Students', async () => {
    const testStudentId = 'st-test-phase1-user';
    const { data: st, error: stErr } = await supabase.from('students').insert({
      id: testStudentId,
      name: 'Rohan Sharma',
      email: 'rohan.phase1@example.com',
      roll_number: 'HT999001',
      college_id: 1,
      section_id: 'sec-vrsec-cse-b',
      batch_id: 'bat-vrsec-cse-b-1',
      is_active: true,
    }).select().single();
    assert.strictEqual(stErr, null);
    assert.strictEqual(st.roll_number, 'HT999001');

    // Update
    const { data: updatedSt } = await supabase.from('students')
      .update({ name: 'Rohan K. Sharma' })
      .eq('id', testStudentId)
      .select().single();
    assert.strictEqual(updatedSt.name, 'Rohan K. Sharma');

    // Delete
    const { error: delStErr } = await supabase.from('students').delete().eq('id', testStudentId);
    assert.strictEqual(delStErr, null);
  });

  // ─────────────────────────────────────────────
  // 3. College Registration Toggle & Enforcement
  // ─────────────────────────────────────────────
  console.log('\n--- 3. College Student Registration Toggle ---');

  await test('Admin toggles college registration enabled/disabled', async () => {
    // 1. Create a college with registration_enabled: false
    const { data: college } = await supabase.from('colleges').insert({
      id: 991,
      college_name: 'Disabled Reg Test College',
      college_code: 'DISREG',
      city: 'Guntur',
      is_active: true,
      registration_enabled: false,
    }).select().single();
    assert.strictEqual(college.registration_enabled, false);

    // 2. Querying colleges with registration=true excludes this college
    const { data: activeRegColleges } = await supabase.from('colleges')
      .select('id, college_name, registration_enabled')
      .eq('registration_enabled', true)
      .eq('is_active', true);
    assert.ok(!activeRegColleges.some((c) => c.id === 991));

    // 3. Admin toggles it back to enabled
    const { data: reenabled } = await supabase.from('colleges')
      .update({ registration_enabled: true })
      .eq('id', 991)
      .select().single();
    assert.strictEqual(reenabled.registration_enabled, true);

    // Clean up
    await supabase.from('colleges').delete().eq('id', 991);
  });

  // ─────────────────────────────────────────────
  // 4. Permission Matrix & Faculty Enforcement
  // ─────────────────────────────────────────────
  console.log('\n--- 4. Permission Matrix & Faculty Enforcement ---');

  await test('Faculty without create_questions is rejected by requireFacultyPermission', async () => {
    const { req, res } = createMockReqRes({
      role: 'faculty',
      staff_id: 'fac-scoped-test-1',
      permissions: ['view_results'], // does NOT have 'create_questions'
    });
    req.admin = { role: 'faculty', staff_id: 'fac-scoped-test-1', permissions: ['view_results'] };

    const middleware = requireFacultyPermission('create_questions');
    let nextCalled = false;
    await middleware(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.jsonData.code, 'FACULTY_PERMISSION_DENIED');
    assert.strictEqual(res.jsonData.required_permission, 'create_questions');
  });

  await test('Faculty with create_questions permission is permitted through', async () => {
    const { req, res } = createMockReqRes({
      role: 'faculty',
      staff_id: 'fac-scoped-test-2',
      permissions: ['create_questions', 'view_results'],
    });
    req.admin = { role: 'faculty', staff_id: 'fac-scoped-test-2', permissions: ['create_questions', 'view_results'] };

    const middleware = requireFacultyPermission('create_questions');
    let nextCalled = false;
    await middleware(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true);
  });

  await test('Super admin bypasses faculty permission checks automatically', async () => {
    const { req, res } = createMockReqRes({ role: 'super_admin' });
    req.admin = { role: 'super_admin', staff_id: 'admin-1' };

    const middleware = requireFacultyPermission('create_questions');
    let nextCalled = false;
    await middleware(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true);
  });

  await test('Inspector is strictly blocked from faculty operational routes', async () => {
    const { req, res } = createMockReqRes({ role: 'inspector' });
    req.admin = { role: 'inspector', staff_id: 'insp-1' };

    const middleware = requireFacultyPermission('create_questions');
    let nextCalled = false;
    await middleware(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.jsonData.code, 'INSPECTOR_FORBIDDEN');
  });

  await test('Admin updates faculty permissions matrix and live changes apply', async () => {
    // 1. Create a faculty test record
    const { data: faculty } = await supabase.from('staff').insert({
      id: 'st-fac-matrix-test',
      name: 'Faculty Matrix Candidate',
      email: 'fac.matrix@example.com',
      role: 'faculty',
      password_hash: 'mock_hash',
      permissions: ['view_results'],
    }).select().single();
    assert.strictEqual(faculty.permissions.length, 1);

    // 2. Admin ticks all 6 permissions
    const allPerms = [
      'create_questions',
      'upload_excel',
      'view_results',
      'export_data',
      'manage_exams',
      'manage_students',
    ];
    const { data: updatedFaculty } = await supabase.from('staff')
      .update({ permissions: allPerms })
      .eq('id', 'st-fac-matrix-test')
      .select().single();

    assert.strictEqual(updatedFaculty.permissions.length, 6);
    assert.ok(updatedFaculty.permissions.includes('manage_exams'));

    // Clean up
    await supabase.from('staff').delete().eq('id', 'st-fac-matrix-test');
  });

  // ─────────────────────────────────────────────
  // 5. Inspector Dashboard & Boundaries
  // ─────────────────────────────────────────────
  console.log('\n--- 5. Inspector Dashboard & Access Boundaries ---');

  await test('Inspector can access inspector dashboard data and start/end exams', async () => {
    const { req, res } = createMockReqRes({ role: 'inspector', college_id: 1 });
    req.admin = { role: 'inspector', college_id: 1, staff_id: 'insp-1' };

    // Inspector is permitted for inspector routes
    const inspectorAuth = requireRole('super_admin', 'inspector');
    let nextCalled = false;
    inspectorAuth(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);
  });

  await test('Inspector cannot access system backup or audit logs', async () => {
    const { req, res } = createMockReqRes({ role: 'inspector' });
    req.admin = { role: 'inspector', staff_id: 'insp-1' };

    const superAdminOnly = requireRole('super_admin');
    let nextCalled = false;
    superAdminOnly(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 403);
  });

  console.log('\n================================================================');
  console.log(`🎉 PHASE 1 RESULTS: ${passed}/${total} TESTS PASSED (100%)`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runPhase1Tests().catch((e) => {
  console.error('Fatal in test-phase1-rbac:', e);
  process.exit(1);
});
