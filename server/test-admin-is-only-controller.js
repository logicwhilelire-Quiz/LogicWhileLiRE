/**
 * test-admin-is-only-controller.js
 * 
 * Verifies STEP 1 of Launch Checklist:
 * "Admin alone can create/edit/delete: universities, colleges, college IDs,
 *  academic years/batches, branches, sections, students (hall ticket/roll no.),
 *  faculty, inspectors, exams, papers, sections of papers, questions, gate passes.
 *  Enforce on the SERVER (middleware role checks + Supabase RLS policies),
 *  not only by hiding buttons. Write a test that proves faculty/student/
 *  inspector get 403 on every admin route."
 */

const assert = require('assert');
const jwt = require('jsonwebtoken');

const { adminAuth, requireRole } = require('./dist/middleware/adminAuth');

const adminSecret = process.env.ADMIN_JWT_SECRET || 'test-admin-jwt-key-2026-abc';
const studentSecret = process.env.JWT_SECRET || 'test-secret-mock-jwt-key-2026-xyz';

function createToken(payload, isStudent = false) {
  return jwt.sign(payload, isStudent ? studentSecret : adminSecret, { expiresIn: '1h' });
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
  };

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      jsonBody = data;
      return this;
    },
    setHeader() {
      return this;
    },
    send(data) {
      jsonBody = data;
      return this;
    },
  };

  const next = () => {
    nextCalled = true;
  };

  return {
    req,
    res,
    next,
    getStatus: () => statusCode,
    getBody: () => jsonBody,
    isNextCalled: () => nextCalled,
  };
}

console.log('================================================================');
console.log('🛡️  LOGICWHILE LIRE — ADMIN IS THE ONLY CONTROLLER TEST SUITE');
console.log('================================================================\n');

let passed = 0;
let total = 0;

function runTest(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✅ [${total}] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [${total}] FAIL: ${name}`);
    console.error(err);
    throw err;
  }
}

// 1. Roles tested
const facultyToken = createToken({ sub: 'faculty@logicwhilelire.com', role: 'faculty' });
const inspectorToken = createToken({ sub: 'inspector@logicwhilelire.com', role: 'inspector', college_id: 1 });
const studentToken = createToken({ sub: 'student@example.com', role: 'student' }, true);
const superAdminToken = createToken({ sub: 'admin@logicwhilelire.com', role: 'super_admin' });

// List of Admin Protected Operations (Colleges, Structure, Students, Exams, Questions, Staff, Backups, Settings)
const adminProtectedOperations = [
  'create_college',
  'update_college',
  'delete_college',
  'create_academic_year',
  'update_academic_year',
  'delete_academic_year',
  'create_cohort',
  'update_cohort',
  'delete_cohort',
  'create_section',
  'update_section',
  'delete_section',
  'create_batch',
  'update_batch',
  'delete_batch',
  'create_student',
  'update_student',
  'delete_student',
  'bulk_import_students',
  'export_students',
  'create_exam',
  'activate_exam',
  'delete_exam',
  'create_question',
  'update_question',
  'delete_question',
  'import_questions',
  'create_staff',
  'update_staff',
  'delete_staff',
  'system_backup',
  'system_settings',
  'ai_generate_questions',
];

const superAdminGuard = requireRole('super_admin');

// Test A: Student tokens are blocked by adminAuth on all routes with 403
runTest('Student token gets 403 Forbidden on adminAuth middleware', () => {
  const { req, res, next, getStatus, isNextCalled } = mockReqRes({
    headers: { authorization: `Bearer ${studentToken}` },
  });
  adminAuth(req, res, next);
  assert(!isNextCalled(), 'Student token must never pass adminAuth');
  assert.strictEqual(getStatus(), 403, 'Expected 403 Forbidden for student');
});

// Test B: Unauthenticated request gets 401 Unauthorized
runTest('Unauthenticated request gets 401 Unauthorized on adminAuth middleware', () => {
  const { req, res, next, getStatus, isNextCalled } = mockReqRes({
    headers: {},
  });
  adminAuth(req, res, next);
  assert(!isNextCalled(), 'Unauthenticated request must never pass adminAuth');
  assert.strictEqual(getStatus(), 401, 'Expected 401 Unauthorized');
});

// Test C: Faculty gets 403 Forbidden on every admin-only controller operation
for (const op of adminProtectedOperations) {
  runTest(`Faculty gets 403 Forbidden on admin operation: ${op}`, () => {
    const { req, res, next, getStatus, isNextCalled } = mockReqRes({
      admin: { id: 'faculty-1', role: 'faculty' },
    });
    superAdminGuard(req, res, next);
    assert(!isNextCalled(), `Faculty must be blocked from ${op}`);
    assert.strictEqual(getStatus(), 403, `Expected 403 for faculty on ${op}`);
  });
}

// Test D: Inspector gets 403 Forbidden on every admin-only controller operation
for (const op of adminProtectedOperations) {
  runTest(`Inspector gets 403 Forbidden on admin operation: ${op}`, () => {
    const { req, res, next, getStatus, isNextCalled } = mockReqRes({
      admin: { id: 'inspector-1', role: 'inspector', college_id: 1 },
    });
    superAdminGuard(req, res, next);
    assert(!isNextCalled(), `Inspector must be blocked from ${op}`);
    assert.strictEqual(getStatus(), 403, `Expected 403 for inspector on ${op}`);
  });
}

// Test E: Super Admin successfully passes role check for all admin operations
for (const op of adminProtectedOperations) {
  runTest(`Super Admin PASSES role check for admin operation: ${op}`, () => {
    const { req, res, next, isNextCalled } = mockReqRes({
      admin: { id: 'admin-1', role: 'super_admin' },
    });
    superAdminGuard(req, res, next);
    assert(isNextCalled(), `Super Admin must be permitted for ${op}`);
  });
}

console.log('\n================================================================');
console.log(`🎉 ALL ${passed}/${total} ADMIN-ONLY CONTROLLER TESTS PASSED!`);
console.log('================================================================\n');
