/**
 * Automated Verification Script:
 * 1. Security Termination exact status string vs Restart Guard exact rejection
 * 2. Terminated student cannot re-enter (HTTP 403 ATTEMPT_TERMINATED)
 * 3. Allow Re-entry preserves remaining time & saved partial answers
 * 4. Post-reentry student can resume session successfully
 */

const jwt = require('jsonwebtoken');
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'test-secret';
const adminToken = jwt.sign(
  { sub: 'admin@logicwhilelire.com', role: 'super_admin', staff_id: 'test-admin' },
  ADMIN_JWT_SECRET,
  { expiresIn: '1h' }
);

async function postJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runTest() {
  console.log('======================================================================');
  console.log('🧪 RUNNING: Security Termination Guard & Allow Re-entry Automated Test');
  console.log('======================================================================\n');

  const testExamCode = 'DEMO-TERM-001';
  const testHallTicket = `HT-TEST-${Date.now()}`;

  // 1. Ensure test exam code exists
  const { data: firstCol } = await supabase.from('colleges').select('id, college_name').limit(1).single();
  const collegeId = firstCol ? firstCol.id : 3;

  await supabase.from('exam_codes').delete().eq('exam_code', testExamCode);

  const { error: insErr } = await supabase.from('exam_codes').insert({
    exam_code: testExamCode,
    exam_name: 'Termination & Re-entry Test Exam',
    duration_minutes: 60,
    total_questions: 2,
    is_active: true,
    is_launched: true,
    paper_status: 'live',
    college: firstCol?.college_name || 'VRSEC',
    college_id: collegeId,
    start_time: new Date().toISOString(),
    end_time: new Date(Date.now() + 3600000).toISOString(),
  });
  if (insErr) console.warn('Exam insert error:', insErr.message);

  // Ensure test questions exist
  const { data: existingQ } = await supabase
    .from('questions_ec')
    .select('id')
    .eq('exam_code', testExamCode);

  if (!existingQ || existingQ.length === 0) {
    await supabase.from('questions_ec').insert([
      {
        exam_code: testExamCode,
        question: 'Sample Question 1',
        option_a: 'Alpha',
        option_b: 'Beta',
        option_c: 'Gamma',
        option_d: 'Delta',
        correct_answer: 'A',
        marks: 1,
      },
      {
        exam_code: testExamCode,
        question: 'Sample Question 2',
        option_a: 'One',
        option_b: 'Two',
        option_c: 'Three',
        option_d: 'Four',
        correct_answer: 'B',
        marks: 1,
      },
    ]);
  }

  let attemptId = null;

  try {
    // -------------------------------------------------------------
    // STEP 1: Candidate enters exam and creates attempt
    // -------------------------------------------------------------
    console.log('Step 1: Student entering exam via verify-exam-entry...');
    const entryRes = await postJson(`${BASE_URL}/api/verify-exam-entry`, {
      hallTicket: testHallTicket,
      examCode: testExamCode,
      studentName: 'Test Student',
    });

    console.log('  -> Entry status:', entryRes.status, '| attempt_id:', entryRes.data.attempt_id);
    attemptId = entryRes.data.attempt_id;
    if (!attemptId) throw new Error(`Failed to obtain attempt_id: ${JSON.stringify(entryRes.data)}`);

    // -------------------------------------------------------------
    // STEP 2: Candidate answers questions (stored in partial_answers)
    // -------------------------------------------------------------
    console.log('\nStep 2: Candidate saves answers and spends 15 minutes (900 seconds)...');
    const savedAnswers = { 'q1': 'A', 'q2': 'B' };
    await supabase
      .from('exam_code_attempts')
      .update({
        partial_answers: savedAnswers,
        answers: savedAnswers,
        time_taken_seconds: 900, // 15 mins out of 60 mins -> 45 mins (2700s) remaining
      })
      .eq('id', attemptId);

    // -------------------------------------------------------------
    // STEP 3: Security Force Termination occurs
    // -------------------------------------------------------------
    console.log('\nStep 3: Triggering security force termination (submit with status: terminated)...');
    const termRes = await postJson(`${BASE_URL}/api/exam-code/${testExamCode}/submit`, {
      attemptId,
      hallTicket: testHallTicket,
      status: 'terminated',
      termination_reason: 'Tab switch or fullscreen breach during active exam',
      answers: savedAnswers,
      timeTakenSeconds: 900,
    });
    console.log('  -> Submit status:', termRes.status, termRes.data);

    // Verify DB status
    const { data: terminatedAttempt } = await supabase
      .from('exam_code_attempts')
      .select('status, override_reason, answers, partial_answers')
      .eq('id', attemptId)
      .single();

    console.log('  -> Exact status string set in database:', JSON.stringify(terminatedAttempt.status));
    console.log('  -> Override/Termination reason:', JSON.stringify(terminatedAttempt.override_reason));
    if (terminatedAttempt.status !== 'terminated_cheating') {
      throw new Error(`Expected status to be "terminated_cheating", got "${terminatedAttempt.status}"`);
    }
    console.log('  ✅ CONFIRMED: Exact status string set on security termination is: "terminated_cheating"');

    // -------------------------------------------------------------
    // STEP 4: Terminated student attempts to re-enter exam
    // -------------------------------------------------------------
    console.log('\nStep 4: Terminated student attempts to re-enter exam (Restart Guard test)...');
    const blockedRes = await postJson(`${BASE_URL}/api/verify-exam-entry`, {
      hallTicket: testHallTicket,
      examCode: testExamCode,
    });

    console.log('  -> Restart Guard response HTTP:', blockedRes.status);
    console.log('  -> Rejection Code:', blockedRes.data.code);
    console.log('  -> Rejected Status string:', JSON.stringify(blockedRes.data.status));
    console.log('  -> Rejection Error:', blockedRes.data.error);

    if (blockedRes.status !== 403 || blockedRes.data.code !== 'ATTEMPT_TERMINATED') {
      throw new Error(`Expected HTTP 403 ATTEMPT_TERMINATED, got: ${JSON.stringify(blockedRes)}`);
    }
    if (blockedRes.data.status !== 'terminated_cheating') {
      throw new Error(`Expected restart guard to reject status "terminated_cheating", got "${blockedRes.data.status}"`);
    }
    console.log('  ✅ CONFIRMED: Restart guard rejected student with HTTP 403 ATTEMPT_TERMINATED matching status "terminated_cheating"!');

    // -------------------------------------------------------------
    // STEP 5: Admin uses "Allow Re-entry"
    // -------------------------------------------------------------
    console.log('\nStep 5: Admin calls Allow Re-entry endpoint...');
    const reentryRes = await postJson(
      `${BASE_URL}/api/admin/attempts/${attemptId}/allow-reentry`,
      { reason: 'Approved false-positive blur event' },
      { Authorization: `Bearer ${adminToken}` }
    );

    console.log('  -> Allow Re-entry HTTP status:', reentryRes.status);
    console.log('  -> Returned Message:', reentryRes.data.message);
    console.log('  -> Remaining seconds returned:', reentryRes.data.remaining_seconds);
    console.log('  -> Saved answers count returned:', reentryRes.data.saved_answers_count);

    if (reentryRes.status !== 200 || reentryRes.data.remaining_seconds <= 0) {
      throw new Error(`Allow re-entry failed: ${JSON.stringify(reentryRes.data)}`);
    }
    if (reentryRes.data.saved_answers_count !== 2) {
      throw new Error(`Expected 2 saved answers preserved, got ${reentryRes.data.saved_answers_count}`);
    }

    // Verify DB state after Allow Re-entry
    const { data: reenteredAttempt } = await supabase
      .from('exam_code_attempts')
      .select('status, end_time, submitted_at, time_taken_seconds, partial_answers, answers')
      .eq('id', attemptId)
      .single();

    console.log('\n  -> Database record after Allow Re-entry:');
    console.log('     Status:', reenteredAttempt.status);
    console.log('     End Time cleared:', reenteredAttempt.end_time === null);
    console.log('     Submitted At cleared:', reenteredAttempt.submitted_at === null);
    console.log('     Time taken preserved in DB:', reenteredAttempt.time_taken_seconds, 'seconds');
    console.log('     Saved answers in DB:', JSON.stringify(reenteredAttempt.answers));
    console.log('     Partial answers in DB:', JSON.stringify(reenteredAttempt.partial_answers));

    if (reenteredAttempt.status !== 'in_progress') {
      throw new Error(`Expected status to be "in_progress", got "${reenteredAttempt.status}"`);
    }
    if (reenteredAttempt.time_taken_seconds !== 900) {
      throw new Error(`Expected time_taken_seconds to be 900, got ${reenteredAttempt.time_taken_seconds}`);
    }
    if (Object.keys(reenteredAttempt.answers || {}).length !== 2) {
      throw new Error('Saved answers were lost after allow re-entry!');
    }
    console.log('  ✅ CONFIRMED: Allow Re-entry preserves remaining time (2700s) & saved answers intact!');

    // -------------------------------------------------------------
    // STEP 6: Student re-enters and resumes examination
    // -------------------------------------------------------------
    console.log('\nStep 6: Student now re-enters via verify-exam-entry...');
    const resumeRes = await postJson(`${BASE_URL}/api/verify-exam-entry`, {
      hallTicket: testHallTicket,
      examCode: testExamCode,
    });

    console.log('  -> Entry status:', resumeRes.status);
    console.log('  -> Resumed:', resumeRes.data.resumed);
    console.log('  -> Message:', resumeRes.data.message);

    if (resumeRes.data.resumed !== true) {
      throw new Error(`Expected candidate to resume successfully, got: ${JSON.stringify(resumeRes.data)}`);
    }
    console.log('  ✅ CONFIRMED: Student successfully resumed exam session after admin re-entry clearance!');

    console.log('\n======================================================================');
    console.log('🎉 ALL TESTS PASSED: STATUS MATCH, RESTART GUARD, & RE-ENTRY TIME/ANSWER PRESERVATION VERIFIED!');
    console.log('======================================================================');
  } finally {
    // Clean up test attempt
    if (attemptId) {
      await supabase.from('exam_code_attempts').delete().eq('id', attemptId);
    }
  }
}

runTest().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
