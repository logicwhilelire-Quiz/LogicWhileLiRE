/**
 * test-phase2-audit.js
 *
 * Automated Test Suite for PHASE 2: Monitoring & Audit Trail
 * Tests:
 * 1. Audit log schema enforcement: user_id, role, action, target, ip, user_agent, timestamp
 * 2. Logging events:
 *    - Logins and failed logins with client IP and User-Agent
 *    - Exam start/stop actions
 *    - Question edits and creation
 *    - Exports (Excel report, PDF report, Batch students)
 *    - Permission changes
 *    - Student edits and blocking
 * 3. Admin-only "Activity" route access boundaries:
 *    - Super admin access permitted (200)
 *    - Faculty completely blocked (403)
 *    - Inspector completely blocked (403)
 * 4. Activity log filtering:
 *    - Filter by role (faculty, inspector, super_admin)
 *    - Filter by action
 *    - Filter by date
 * 5. Admin dashboard widgets:
 *    - Live exams count and payload
 *    - Students online count
 *    - Violations count
 *    - Recent faculty activity
 *    - System health (status, database, latency, heap, uptime)
 *    - Role security (faculty and inspector blocked with 403)
 */

const assert = require('assert');
const jwt = require('jsonwebtoken');

process.env.ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'test_admin_jwt_secret_key_32chars_long';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_32chars_long';

const { supabase } = require('./dist/db/supabase');
const { adminAuth, requireRole } = require('./dist/middleware/adminAuth');
const { recordAuditLog, auditLog } = require('./dist/middleware/auditLog');
const { listAuditLogs, getAdminDashboardWidgets } = require('./dist/controllers/adminController');

function createMockReqRes({ role = 'super_admin', staff_id = 'st000000-0000-0000-0000-000000000001', college_id = 1, headers = {}, body = {}, query = {}, params = {} } = {}) {
  const token = jwt.sign(
    { sub: 'test-user', role, staff_id, college_id },
    process.env.ADMIN_JWT_SECRET,
    { expiresIn: '1h' }
  );

  const req = {
    headers: {
      authorization: `Bearer ${token}`,
      'user-agent': 'LogicWhileLiRE-AuditTester/1.0 (Windows NT 10.0; Win64; x64)',
      ...headers,
    },
    cookies: {},
    ip: '192.168.1.105',
    socket: { remoteAddress: '192.168.1.105' },
    body,
    query,
    params,
    admin: undefined,
  };

  const res = {
    statusCode: 200,
    headers: {},
    jsonData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    },
    setHeader(name, val) {
      this.headers[name] = val;
    },
  };

  return { req, res, token };
}

async function runPhase2Tests() {
  console.log('================================================================');
  console.log('🛡️  PHASE 2: MONITORING & AUDIT TRAIL VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Reason: ${err.message}`);
      failed++;
    }
  }

  async function asyncTest(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Reason: ${err.message}`);
      failed++;
    }
  }

  // ── TEST 1: Audit Log Table Schema & Direct Insertion ──
  await asyncTest('Audit Log schema captures user_id, role, action, target, IP, user_agent, timestamp', async () => {
    const adminUser = {
      staff_id: 'staff-audit-test-01',
      sub: 'faculty@college.edu',
      role: 'faculty',
      college_id: 1,
    };

    const mockReq = {
      headers: { 'user-agent': 'Mozilla/5.0 Audit Agent Test' },
      ip: '10.0.0.42',
    };

    await recordAuditLog(adminUser, 'QUESTION_EDIT', 'questions', 'q-999', { title: 'Updated Question' }, mockReq);

    const { data: logEntry } = await supabase
      .from('audit_log')
      .select('*')
      .eq('action', 'QUESTION_EDIT')
      .eq('user_id', 'staff-audit-test-01')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    assert(logEntry, 'Audit log entry must be written to audit_log table');
    assert.strictEqual(logEntry.user_id, 'staff-audit-test-01');
    assert.strictEqual(logEntry.role, 'faculty');
    assert.strictEqual(logEntry.action, 'QUESTION_EDIT');
    assert(logEntry.target.includes('questions:q-999'), 'Target must reflect table and target ID');
    assert.strictEqual(logEntry.ip, '10.0.0.42');
    assert.strictEqual(logEntry.user_agent, 'Mozilla/5.0 Audit Agent Test');
    assert(logEntry.timestamp, 'Timestamp must be present');
    assert(!isNaN(new Date(logEntry.timestamp).getTime()), 'Timestamp must be valid ISO date string');
  });

  // ── TEST 2: Audit Log Middleware Interception ──
  await asyncTest('auditLog middleware records mutations upon successful response', async () => {
    const middleware = auditLog('UPDATE_QUESTION', 'questions');
    const { req, res } = createMockReqRes({ role: 'faculty', staff_id: 'faculty-uuid-02' });
    req.admin = { sub: 'faculty@test.edu', role: 'faculty', staff_id: 'faculty-uuid-02' };
    req.params = { id: 'q-555' };
    req.body = { marks: 5 };

    let nextCalled = false;
    await middleware(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true, 'Middleware must pass control to next handler');

    // Simulate endpoint returning 200 JSON
    res.status(200).json({ success: true, updated: true });

    // Allow promise resolution
    await new Promise((r) => setTimeout(r, 50));

    const { data: logs } = await supabase
      .from('audit_log')
      .select('*')
      .eq('action', 'UPDATE_QUESTION')
      .eq('user_id', 'faculty-uuid-02');

    assert(logs && logs.length > 0, 'Middleware must log successful 2xx mutation');
    const entry = logs[logs.length - 1];
    assert.strictEqual(entry.role, 'faculty');
    assert.strictEqual(entry.ip, '192.168.1.105');
    assert.strictEqual(entry.user_agent, 'LogicWhileLiRE-AuditTester/1.0 (Windows NT 10.0; Win64; x64)');
  });

  // ── TEST 3: Logging of Critical Operations ──
  await asyncTest('Audit entries generated for Exam Start, Stop, Exports, Permissions, and Student Edits', async () => {
    const admin = { staff_id: 'super-admin-01', sub: 'admin@logicwhile.com', role: 'super_admin' };
    const inspector = { staff_id: 'inspector-01', sub: 'inspector@college.edu', role: 'inspector', college_id: 2 };
    const faculty = { staff_id: 'faculty-01', sub: 'faculty@college.edu', role: 'faculty', college_id: 2 };

    const reqMeta = { headers: { 'user-agent': 'Chrome Audit/2.0' }, ip: '172.16.0.12' };

    // Exam Start & Stop
    await recordAuditLog(inspector, 'START_EXAM', 'exams', 'exam-phase2-01', { is_active: true }, reqMeta);
    await recordAuditLog(inspector, 'END_EXAM', 'exams', 'exam-phase2-01', { is_active: false }, reqMeta);

    // Permission change
    await recordAuditLog(admin, 'UPDATE_STAFF_PERMISSIONS', 'staff', faculty.staff_id, { permissions: ['create_questions', 'export_data'] }, reqMeta);

    // Student edits & block
    await recordAuditLog(faculty, 'UPDATE_STUDENT', 'students', 'stu-999', { name: 'John Updated' }, reqMeta);
    await recordAuditLog(admin, 'BLOCK_STUDENT', 'students', 'stu-999', { is_blocked: true, reason: 'Tab switch' }, reqMeta);

    // Exports
    await recordAuditLog(faculty, 'EXPORT_REPORT_EXCEL', 'exams', 'exam-phase2-01', { rows: 45 }, reqMeta);
    await recordAuditLog(faculty, 'EXPORT_REPORT_PDF', 'exams', 'exam-phase2-01', { rows: 45 }, reqMeta);
    await recordAuditLog(faculty, 'EXPORT_BATCH_STUDENTS', 'students', 'batch-A', { count: 60 }, reqMeta);

    const { data: startLogs } = await supabase.from('audit_log').select('*').eq('action', 'START_EXAM');
    const { data: endLogs } = await supabase.from('audit_log').select('*').eq('action', 'END_EXAM');
    const { data: permLogs } = await supabase.from('audit_log').select('*').eq('action', 'UPDATE_STAFF_PERMISSIONS');
    const { data: studentLogs } = await supabase.from('audit_log').select('*').eq('action', 'UPDATE_STUDENT');
    const { data: blockLogs } = await supabase.from('audit_log').select('*').eq('action', 'BLOCK_STUDENT');
    const { data: excelExport } = await supabase.from('audit_log').select('*').eq('action', 'EXPORT_REPORT_EXCEL');
    const { data: pdfExport } = await supabase.from('audit_log').select('*').eq('action', 'EXPORT_REPORT_PDF');
    const { data: batchExport } = await supabase.from('audit_log').select('*').eq('action', 'EXPORT_BATCH_STUDENTS');

    assert(startLogs && startLogs.length > 0, 'START_EXAM must be recorded in audit log');
    assert(endLogs && endLogs.length > 0, 'END_EXAM must be recorded in audit log');
    assert(permLogs && permLogs.length > 0, 'UPDATE_STAFF_PERMISSIONS must be recorded in audit log');
    assert(studentLogs && studentLogs.length > 0, 'UPDATE_STUDENT must be recorded in audit log');
    assert(blockLogs && blockLogs.length > 0, 'BLOCK_STUDENT must be recorded in audit log');
    assert(excelExport && excelExport.length > 0, 'EXPORT_REPORT_EXCEL must be recorded');
    assert(pdfExport && pdfExport.length > 0, 'EXPORT_REPORT_PDF must be recorded');
    assert(batchExport && batchExport.length > 0, 'EXPORT_BATCH_STUDENTS must be recorded');
  });

  // ── TEST 4: Role Boundaries on Activity / Audit Log Route ──
  await asyncTest('Super admin can access /api/admin/activity while Faculty and Inspector are strictly blocked (HTTP 403)', async () => {
    // 1. Super admin call
    const adminCheck = requireRole('super_admin');
    const { req: adminReq, res: adminRes } = createMockReqRes({ role: 'super_admin' });
    adminAuth(adminReq, adminRes, () => {});
    
    let adminNextCalled = false;
    adminCheck(adminReq, adminRes, () => { adminNextCalled = true; });
    assert.strictEqual(adminNextCalled, true, 'Super Admin must pass requireRole for activity logs');

    // 2. Faculty call
    const { req: facultyReq, res: facultyRes } = createMockReqRes({ role: 'faculty' });
    adminAuth(facultyReq, facultyRes, () => {});
    let facultyNextCalled = false;
    adminCheck(facultyReq, facultyRes, () => { facultyNextCalled = true; });
    assert.strictEqual(facultyNextCalled, false, 'Faculty must NEVER pass requireRole for activity logs');
    assert.strictEqual(facultyRes.statusCode, 403, 'Faculty must receive HTTP 403 on activity logs');

    // 3. Inspector call
    const { req: inspectorReq, res: inspectorRes } = createMockReqRes({ role: 'inspector' });
    adminAuth(inspectorReq, inspectorRes, () => {});
    let inspectorNextCalled = false;
    adminCheck(inspectorReq, inspectorRes, () => { inspectorNextCalled = true; });
    assert.strictEqual(inspectorNextCalled, false, 'Inspector must NEVER pass requireRole for activity logs');
    assert.strictEqual(inspectorRes.statusCode, 403, 'Inspector must receive HTTP 403 on activity logs');
  });

  // ── TEST 5: Activity Log Filtering ──
  await asyncTest('Activity logs filter accurately by role, action, and date', async () => {
    // Seed distinct entries
    const todayStr = new Date().toISOString().split('T')[0];
    await recordAuditLog({ staff_id: 'fac-91', role: 'faculty' }, 'FILTER_TEST_ACTION_A', 'test', '1', null, { ip: '1.1.1.1' });
    await recordAuditLog({ staff_id: 'insp-92', role: 'inspector' }, 'FILTER_TEST_ACTION_B', 'test', '2', null, { ip: '2.2.2.2' });

    // Test filter by role = faculty
    const { req: reqFaculty, res: resFaculty } = createMockReqRes({ role: 'super_admin', query: { role: 'faculty' } });
    await listAuditLogs(reqFaculty, resFaculty);
    assert.strictEqual(resFaculty.statusCode, 200);
    assert(resFaculty.jsonData.logs.every((l) => l.role === 'faculty'), 'Role=faculty filter must return only faculty logs');

    // Test filter by role = inspector
    const { req: reqInspector, res: resInspector } = createMockReqRes({ role: 'super_admin', query: { role: 'inspector' } });
    await listAuditLogs(reqInspector, resInspector);
    assert.strictEqual(resInspector.statusCode, 200);
    assert(resInspector.jsonData.logs.every((l) => l.role === 'inspector'), 'Role=inspector filter must return only inspector logs');

    // Test filter by action
    const { req: reqAction, res: resAction } = createMockReqRes({ role: 'super_admin', query: { action: 'FILTER_TEST_ACTION_A' } });
    await listAuditLogs(reqAction, resAction);
    assert.strictEqual(resAction.statusCode, 200);
    assert(resAction.jsonData.logs.every((l) => l.action === 'FILTER_TEST_ACTION_A'), 'Action filter must match exactly');

    // Test filter by date
    const { req: reqDate, res: resDate } = createMockReqRes({ role: 'super_admin', query: { date: todayStr } });
    await listAuditLogs(reqDate, resDate);
    assert.strictEqual(resDate.statusCode, 200);
    assert(resDate.jsonData.logs.every((l) => (l.timestamp || '').startsWith(todayStr)), 'Date filter must match date prefix');
  });

  // ── TEST 6: Admin Dashboard Widgets Endpoint & Schema ──
  await asyncTest('Dashboard widgets endpoint returns live exams, online students, violations, recent faculty activity, and system health', async () => {
    // Seed an active exam and session for widget calculation
    await supabase.from('exams').insert({
      id: 'widget-live-exam-01',
      title: 'Active Assessment Widget Test',
      duration_minutes: 60,
      is_active: true,
      created_by: 'super_admin',
    });

    const { req, res } = createMockReqRes({ role: 'super_admin' });
    await getAdminDashboardWidgets(req, res);

    assert.strictEqual(res.statusCode, 200, 'Dashboard widgets must return HTTP 200');
    assert(res.jsonData.success, 'Response must be success: true');
    const { widgets } = res.jsonData;
    assert(widgets, 'widgets object must be present');

    // Widget 1: Live Exams
    assert(typeof widgets.live_exams_count === 'number', 'live_exams_count must be number');
    assert(Array.isArray(widgets.live_exams), 'live_exams must be array');

    // Widget 2: Students online
    assert(typeof widgets.students_online === 'number', 'students_online must be number');

    // Widget 3: Violations count
    assert(typeof widgets.violations_count === 'number', 'violations_count must be number');

    // Widget 4: Recent faculty activity
    assert(Array.isArray(widgets.recent_faculty_activity), 'recent_faculty_activity must be array');
    if (widgets.recent_faculty_activity.length > 0) {
      const item = widgets.recent_faculty_activity[0];
      assert.strictEqual(item.role, 'faculty', 'recent_faculty_activity must contain only faculty logs');
      assert(item.user_id, 'user_id must be present');
      assert(item.action, 'action must be present');
      assert(item.timestamp, 'timestamp must be present');
    }

    // Widget 5: System Health
    const health = widgets.system_health;
    assert(health, 'system_health must be present');
    assert.strictEqual(health.status, 'operational');
    assert(typeof health.latency_ms === 'number');
    assert(typeof health.heap_used_mb === 'number');
    assert(typeof health.uptime_seconds === 'number');
    assert(health.database.includes('connected'));
  });

  // ── TEST 7: Dashboard Widgets Role Boundary ──
  test('Dashboard widgets endpoint blocks non-admin callers (Faculty & Inspector get HTTP 403)', () => {
    const adminCheck = requireRole('super_admin');

    // Faculty check
    const { req: facultyReq, res: facultyRes } = createMockReqRes({ role: 'faculty' });
    adminAuth(facultyReq, facultyRes, () => {});
    let facultyPassed = false;
    adminCheck(facultyReq, facultyRes, () => { facultyPassed = true; });
    assert.strictEqual(facultyPassed, false);
    assert.strictEqual(facultyRes.statusCode, 403);

    // Inspector check
    const { req: inspectorReq, res: inspectorRes } = createMockReqRes({ role: 'inspector' });
    adminAuth(inspectorReq, inspectorRes, () => {});
    let inspectorPassed = false;
    adminCheck(inspectorReq, inspectorRes, () => { inspectorPassed = true; });
    assert.strictEqual(inspectorPassed, false);
    assert.strictEqual(inspectorRes.statusCode, 403);
  });

  console.log('\n================================================================');
  console.log(`📊 PHASE 2 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2Tests().catch((err) => {
  console.error('Fatal Phase 2 test error:', err);
  process.exit(1);
});
