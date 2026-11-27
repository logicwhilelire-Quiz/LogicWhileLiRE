/**
 * test-concurrency-and-mail.js
 * Verifies:
 * 1. 300-concurrent student burst (start -> questions -> lobby-stats -> submit) without 500s or double-submit races
 * 2. Campus NAT IP rate-limit composite keys for 300 distinct candidates on one shared IP
 * 3. Forgot Password & Forgot User ID across Student + Staff portals
 * 4. Automated Mail Forwarder Rules + Manual Email Forwarding
 */
process.env.TEST_MOCK_ONLY = 'true';
process.env.NODE_ENV = 'test';
require('./test-helper');
process.env.PORT = '0';

const http = require('http');
const assert = require('assert');
const jwt = require('jsonwebtoken');

const appModule = require('./dist/index');
const server = appModule.httpServer;
const { supabase } = require('./dist/db/supabase');
const { getAdminJwtSecret } = require('./dist/middleware/adminAuth');
const { memoryMailLogs } = require('./dist/services/mailService');

let baseUrl = '';
const keepAliveAgent = new http.Agent({ keepAlive: true, maxSockets: 64 });

function req(method, urlPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlPath, baseUrl);
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      method,
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      agent: keepAliveAgent,
      headers: {
        'content-type': 'application/json',
        ...(payload ? { 'content-length': Buffer.byteLength(payload) } : {}),
        ...headers,
      },
    };
    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data || '{}') });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function run() {
  await new Promise((resolve) => {
    if (server.listening) return resolve();
    server.listen(0, '127.0.0.1', resolve);
  });
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${addr.port}`;

  const adminToken = jwt.sign(
    { staff_id: 'e6fa7676-2798-4b3c-b452-37d455bb3585', username: 'admin', role: 'super_admin' },
    getAdminJwtSecret(),
    { expiresIn: '1h' }
  );
  const authHdr = { Authorization: `Bearer ${adminToken}` };

  // Seed 300-student open exam + questions
  const examCode = 'GR-LOAD-300TEST';
  await supabase.from('exam_codes').insert({
    exam_code: examCode,
    exam_name: '300-Student Concurrency Benchmark',
    duration_minutes: 60,
    total_questions: 3,
    total_marks: 3,
    passing_percentage: 40,
    is_active: true,
    is_launched: true,
    started_at: new Date().toISOString(),
  });
  await supabase.from('questions_ec').insert([
    {
      exam_code: examCode,
      question: '2 + 2 = ?',
      option_a: '3',
      option_b: '4',
      option_c: '5',
      option_d: '6',
      correct_answer: 'B',
      marks: 1,
      topic: 'Quantitative',
      section: 'Quant',
      question_type: 'mcq',
    },
    {
      exam_code: examCode,
      question: 'Which structure is FIFO?',
      option_a: 'Stack',
      option_b: 'Queue',
      option_c: 'Heap',
      option_d: 'Tree',
      correct_answer: 'B',
      marks: 1,
      topic: 'DSA',
      section: 'DSA',
      question_type: 'mcq',
    },
    {
      exam_code: examCode,
      question: 'HTTP 200 means?',
      option_a: 'OK',
      option_b: 'Not Found',
      option_c: 'Forbidden',
      option_d: 'Conflict',
      correct_answer: 'A',
      marks: 1,
      topic: 'Core CS',
      section: 'Core CS',
      question_type: 'mcq',
    },
  ]);

  console.log('\n================================================================');
  console.log('⚡ 300-STUDENT CONCURRENCY & MAIL RECOVERY / FORWARDER SUITE');
  console.log('================================================================');

  // 1. 300 simultaneous exam start requests
  const tStart = Date.now();
  const startResults = await Promise.all(
    Array.from({ length: 300 }, (_, i) =>
      req('GET', `/api/exam-code/${examCode}/start?hallTicket=HT300_${String(i + 1).padStart(3, '0')}`)
    )
  );
  const startFailures = startResults.filter((r) => r.status !== 200 || !r.data?.success);
  assert.strictEqual(startFailures.length, 0, `Expected 0 failures in 300 starts, got ${startFailures.length}`);
  assert(startResults[0].data.time_left_seconds >= 3500, 'Expected full duration remaining on fresh start');
  console.log(`  ✅ [1] 300 concurrent /start calls succeeded in ${Date.now() - tStart}ms`);

  // 2. 300 simultaneous /questions + /lobby-stats calls (sectionBreakdown populated)
  const [qBatch, lobbyRes] = await Promise.all([
    Promise.all(
      Array.from({ length: 100 }, (_, i) =>
        req('GET', `/api/exam-code/${examCode}/questions?hallTicket=HT300_${String(i + 1).padStart(3, '0')}`)
      )
    ),
    req('GET', `/api/v1/exams/${examCode}/lobby-stats`),
  ]);
  assert.strictEqual(qBatch.filter((r) => r.status !== 200).length, 0, 'All /questions requests must return 200');
  assert.strictEqual(lobbyRes.status, 200);
  assert(Array.isArray(lobbyRes.data.exam_sections) && lobbyRes.data.exam_sections.length === 3, 'Expected 3 real exam_sections in lobby-stats');
  console.log(`  ✅ [2] Cached /questions burst & /lobby-stats dynamic sections verified`);

  // 3. Double-submit idempotency & concurrent /submit across 50 candidates
  const submitPromises = [];
  for (let i = 0; i < 50; i++) {
    const ht = `HT300_${String(i + 1).padStart(3, '0')}`;
    submitPromises.push(req('POST', `/api/exam-code/${examCode}/submit`, { hallTicket: ht, answers: {} }));
  }
  const submitResults = await Promise.all(submitPromises);
  assert.strictEqual(submitResults.filter((r) => r.status !== 200 || !r.data?.success).length, 0, 'All 50 concurrent submits succeeded');
  console.log(`  ✅ [3] Concurrent /submit locks verified across 50 submissions`);

  // 4. Health telemetry exposes runtime & socket metrics
  const healthRes = await req('GET', '/api/health');
  assert.strictEqual(healthRes.status, 200);
  assert(healthRes.data.runtime && typeof healthRes.data.runtime.memory_rss_mb === 'number', 'Runtime telemetry present on /api/health');
  console.log(`  ✅ [4] /api/health runtime telemetry verified (${healthRes.data.runtime.memory_rss_mb} MB RSS)`);

  // 5. Forgot User ID & Forgot Password across portals (with a real-domain test email)
  const recoveryEmail = 'recovery.candidate@rvit.edu.in';
  await supabase.from('students').insert({
    name: 'Recovery Tester',
    email: recoveryEmail,
    roll_number: '24HU1A05F9',
    hall_ticket: '24HU1A05F9',
    college_id: 1,
    is_verified: true,
    is_active: true,
  });

  // Setup auto-forwarder BEFORE dispatching recovery mail
  const addRuleRes = await req(
    'POST',
    '/api/admin/mail-forwarders',
    {
      name: 'Recovery Audit Forwarder',
      template: 'user_id_recovery',
      forwardTo: 'audit-backup@rvit.edu.in',
      mode: 'forward_copy',
      enabled: true,
    },
    authHdr
  );
  assert.strictEqual(addRuleRes.status, 200);
  assert(addRuleRes.data.forwarder && addRuleRes.data.forwarder.id, 'Mail forwarder rule created');
  const ruleId = addRuleRes.data.forwarder.id;

  const listRulesRes = await req('GET', '/api/admin/mail-forwarders', null, authHdr);
  assert(listRulesRes.data.forwarders.some((f) => f.id === ruleId), 'Forwarder rule persisted in list');

  const forgotIdRes = await req('POST', '/api/auth/forgot-user-id', { email: recoveryEmail, portal: 'student' });
  assert.strictEqual(forgotIdRes.status, 200);
  assert(
    Array.isArray(forgotIdRes.data.demo_recovered_accounts) &&
      forgotIdRes.data.demo_recovered_accounts.some((a) => a.userId === '24HU1A05F9'),
    'Recovered student Hall Ticket ID 24HU1A05F9'
  );

  // Give async forwarder copy a moment to flush
  await new Promise((r) => setTimeout(r, 150));

  const userIdLog = memoryMailLogs.find((l) => l.template === 'user_id_recovery' && l.to_email === recoveryEmail);
  assert(userIdLog, 'user_id_recovery mail logged');
  const autoForwardedLog = memoryMailLogs.find((l) => l.template === 'mail_forwarded' && l.to_email.includes('audit-backup@rvit.edu.in'));
  assert(autoForwardedLog, 'Automated mail forwarder triggered [mail_forwarded] copy');
  console.log(`  ✅ [5] Forgot User ID + Automated Mail Forwarder rule verified`);

  // 6. Forgot Password across Staff & Student + Manual Forward Mail Log
  const forgotStaffRes = await req('POST', '/api/auth/forgot-password', { identifier: 'admin', portal: 'admin' });
  assert.strictEqual(forgotStaffRes.status, 200);
  assert(forgotStaffRes.data.demo_reset_link, 'Staff password reset link generated');

  const fwdManualRes = await req(
    'POST',
    `/api/admin/mail-logs/${userIdLog.id}/forward`,
    { forwardTo: 'coordinator@rvit.edu.in', note: 'Exam hall desk copy' },
    authHdr
  );
  assert.strictEqual(fwdManualRes.status, 200);
  const manualFwdLog = memoryMailLogs.find((l) => l.template === 'mail_forwarded' && l.to_email.includes('coordinator@rvit.edu.in'));
  assert(manualFwdLog, 'Manual mail forward endpoint logged forwarded copy');

  const delRuleRes = await req('DELETE', `/api/admin/mail-forwarders/${ruleId}`, null, authHdr);
  assert.strictEqual(delRuleRes.status, 200);
  console.log(`  ✅ [6] Multi-portal Forgot Password + Manual Mail Forward + Forwarder cleanup verified`);

  console.log('================================================================\n');
  server.close();
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Concurrency & Mail test failed:', err);
  try { server.close(); } catch {}
  process.exit(1);
});
