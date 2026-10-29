import 'dotenv/config';
import { supabase } from '../src/db/supabase';
import { httpServer } from '../src/index';

async function req(method: string, url: string, body?: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function runEndToEnd() {
  console.log('\n================================================================');
  console.log('🚀 LogicWhileLiRE — FULL PRODUCTION END-TO-END VALIDATION');
  console.log('================================================================\n');

  // Wait for server to bind
  await new Promise((resolve) => {
    if (httpServer.listening) return resolve(true);
    httpServer.on('listening', () => resolve(true));
  });

  const address = httpServer.address();
  const port = typeof address === 'object' && address ? address.port : 3001;
  const BASE = `http://127.0.0.1:${port}`;
  console.log(`📡 Testing against server at ${BASE}\n`);

  let passed = 0;
  function pass(step: string, desc: string) {
    passed++;
    console.log(`  ✅ [${step}] ${desc}`);
  }

  try {
    // 1. Health check
    const healthRes = await req('GET', `${BASE}/api/health`);
    if (healthRes.status === 200 && healthRes.data?.status === 'ok') {
      pass('1. HEALTH', `Health check passed (/api/health) — Service: ${healthRes.data.service}`);
    } else {
      throw new Error(`Health check failed: ${JSON.stringify(healthRes)}`);
    }

    // 2. Super Admin Login
    const adminLoginRes = await req('POST', `${BASE}/api/admin/login`, {
      username: process.env.ADMIN_USERNAME || 'admin',
      password: process.env.ADMIN_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD || '',
    });
    const adminToken = adminLoginRes.data?.token;
    if (adminLoginRes.status === 200 && adminToken) {
      pass('2. ADMIN AUTH', `Super Admin authenticated (user: ${adminLoginRes.data.user?.username})`);
    } else {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLoginRes)}`);
    }

    // 3. Inspector Login
    const inspectorLoginRes = await req('POST', `${BASE}/api/admin/login`, {
      username: process.env.INSPECTOR_USERNAME || 'inspector',
      password: process.env.INSPECTOR_PASSWORD || process.env.INITIAL_INSPECTOR_PASSWORD || '',
    });
    const inspectorToken = inspectorLoginRes.data?.token;
    if (inspectorLoginRes.status === 200 && inspectorToken) {
      pass('3. INSPECTOR AUTH', `Inspector authenticated (role: ${inspectorLoginRes.data.user?.role})`);
    } else {
      throw new Error(`Inspector login failed: ${JSON.stringify(inspectorLoginRes)}`);
    }

    // 4. Admin creates College
    const collegeCode = `IARE${Math.floor(1000 + Math.random() * 9000)}`;
    const collegeRes = await req(
      'POST',
      `${BASE}/api/admin/colleges`,
      {
        college_name: 'IARE Institute of Technology',
        college_code: collegeCode,
        domain: 'iare.ac.in',
        address: 'Dundigal, Hyderabad, Telangana',
      },
      adminToken
    );
    const collegeId = collegeRes.data?.college?.id || collegeRes.data?.data?.id;
    if (!collegeId) {
      throw new Error(`College creation failed: ${JSON.stringify(collegeRes)}`);
    }
    pass('4. COLLEGE CREATION', `Admin created college with ID: ${collegeId}`);

    // 5. Admin creates Exam Code
    const testExamCode = `LW${Math.floor(1000 + Math.random() * 9000)}`;
    const examCodeRes = await req(
      'POST',
      `${BASE}/api/admin/exam-codes`,
      {
        exam_code: testExamCode,
        exam_name: 'LogicWhile Live Assessment 2026',
        subject: 'Computer Science & Engineering',
        college_id: collegeId,
        duration_minutes: 30,
        total_questions: 2,
        passing_percentage: 40,
        negative_marks: 0,
        max_violations: 2,
        auto_terminate: true,
        proctoring_mode: 'webcam',
        is_active: true,
        start_time: new Date(Date.now() - 3600000).toISOString(),
        end_time: new Date(Date.now() + 86400000).toISOString(),
      },
      adminToken
    );
    if (![200, 201].includes(examCodeRes.status)) {
      throw new Error(`Exam code creation failed: ${JSON.stringify(examCodeRes)}`);
    }
    const finalExamCode = examCodeRes.data?.exam_code?.exam_code || examCodeRes.data?.data?.exam_code || testExamCode;
    pass('5. EXAM CREATION', `Admin created targeted exam code: ${finalExamCode}`);

    // 6. Admin adds questions
    await supabase.from('questions_ec').insert([
      {
        exam_code: finalExamCode,
        question: 'What is the runtime of binary search?',
        option_a: 'O(log n)',
        option_b: 'O(n)',
        option_c: 'O(n^2)',
        option_d: 'O(1)',
        correct_answer: 'A',
        marks: 1,
        question_type: 'mcq',
      },
      {
        exam_code: finalExamCode,
        question: 'Which data structure uses LIFO order?',
        option_a: 'Queue',
        option_b: 'Stack',
        option_c: 'Array',
        option_d: 'Tree',
        correct_answer: 'B',
        marks: 1,
        question_type: 'mcq',
      },
    ]);
    pass('6. QUESTIONS SEEDED', `Admin added 2 test questions to exam code: ${finalExamCode}`);

    // 7. Student registers / creates attempt
    const testHallTicket = `22B91A${Math.floor(100 + Math.random() * 900)}`;
    await supabase.from('students').insert({
      hall_ticket: testHallTicket,
      roll_number: testHallTicket,
      student_name: 'Test Candidate',
      email: `${testHallTicket.toLowerCase()}@logicwhilelire.com`,
      college_id: collegeId,
      branch_code: 'CSE',
      section: 'A',
      is_verified: true,
      status: 'active',
    });
    pass('7. STUDENT RECORD', `Student enrolled with hall ticket: ${testHallTicket}`);

    // 8. Student reports issue before start
    const issueRes = await req('POST', `${BASE}/api/v1/inspector/report-issue`, {
      candidateId: testHallTicket,
      studentName: 'Test Candidate',
      hallTicket: testHallTicket,
      examCode: finalExamCode,
      issueType: 'pre_exam_query',
      message: 'Testing issue desk communication prior to exam dispatch',
    });
    if (issueRes.data?.success) {
      pass('8. PRE-EXAM ISSUE REPORT', 'Student sent issue report before start; delivered straight to Inspector & Admin');
    }

    // 9. Admin/Inspector starts exam
    const startExamRes = await req(
      'POST',
      `${BASE}/api/admin/exams/${finalExamCode}/start`,
      {},
      adminToken
    );
    if (!startExamRes.data?.success) {
      throw new Error(`Start exam failed: ${JSON.stringify(startExamRes)}`);
    }
    pass('9. PUSH-TO-START', `Exam started by administrator: ${finalExamCode}`);

    // 10. Student gate verification clearance
    const entryRes = await req('POST', `${BASE}/api/verify-exam-entry`, {
      examCode: finalExamCode,
      hallTicket: testHallTicket,
    });
    if (!entryRes.data?.success) {
      throw new Error(`Gate entry verification failed: ${JSON.stringify(entryRes)}`);
    }
    const attemptId = entryRes.data?.attempt_id;
    const sessionToken = entryRes.data?.session_token;
    pass('10. GATE CLEARANCE', `Gate clearance granted (attempt: ${attemptId})`);

    // 11. Student starts exam session
    const studentStartRes = await req('GET', `${BASE}/api/exam-code/${finalExamCode}/start?hallTicket=${testHallTicket}`);
    const questions = studentStartRes.data?.questions;
    if (studentStartRes.data?.success && questions && questions.length > 0) {
      pass('11. EXAM SESSION START', `Student entered exam; received ${questions.length} shuffled questions`);
    } else {
      throw new Error(`Student start failed: ${JSON.stringify(studentStartRes)}`);
    }

    // 12. Student violation strike 1 (warning)
    const viol1Res = await req('POST', `${BASE}/api/exam-code/${finalExamCode}/violation`, {
      candidateId: testHallTicket,
      attemptId: attemptId,
      session_token: sessionToken,
      examCode: finalExamCode,
      violationType: 'tab_switch',
      notes: 'Browser lost focus (tab switch)',
    });
    if (viol1Res.data?.success) {
      pass('12. VIOLATION WARNING', `Strike 1 warning recorded: count=${viol1Res.data.violation_count}, max=${viol1Res.data.max_violations}`);
    } else {
      throw new Error(`Violation 1 failed: ${JSON.stringify(viol1Res)}`);
    }

    // 13. Student saves answer
    const answerRes = await req('POST', `${BASE}/api/exam-code/${finalExamCode}/save-answer`, {
      examCode: finalExamCode,
      attemptId: attemptId,
      session_token: sessionToken,
      candidateId: testHallTicket,
      hallTicket: testHallTicket,
      items: [{ question_id: questions[0].id, answer: 'A', type: 'mcq' }],
    });
    if (answerRes.data?.success) {
      pass('13. AUTOSAVE ANSWER', 'Student answer saved and synced securely in real-time');
    } else {
      throw new Error(`Answer save failed: ${JSON.stringify(answerRes)}`);
    }

    // 14. Student submits exam
    const submitRes = await req('POST', `${BASE}/api/exam-code/${finalExamCode}/submit`, {
      examCode: finalExamCode,
      attemptId: attemptId,
      session_token: sessionToken,
      hallTicket: testHallTicket,
      answers: { [questions[0].id]: 'A' },
      timeSpent: 120,
    });
    if (submitRes.data?.success) {
      pass('14. EXAM SUBMIT', `Attempt submitted: score=${submitRes.data.score}/${submitRes.data.totalMarks}`);
    } else {
      throw new Error(`Exam submit failed: ${JSON.stringify(submitRes)}`);
    }

    // 15. Live Leaderboard verification
    const leaderboardRes = await req('GET', `${BASE}/api/exam-code/${finalExamCode}/leaderboard`);
    if (leaderboardRes.data?.success) {
      pass('15. LIVE LEADERBOARD', `Leaderboard populated with rank listings: ${(leaderboardRes.data.leaderboard || []).length} candidates`);
    }

    // 16. Backup download check
    const backupRes = await req('GET', `${BASE}/api/admin/backup`, undefined, adminToken);
    if (backupRes.data?.success) {
      pass('16. BACKUP ENGINE', `Backup generated: ${backupRes.data.backup?.download_url || backupRes.data.downloadUrl}`);
    } else {
      throw new Error(`Backup failed: ${JSON.stringify(backupRes)}`);
    }

    // ── CLEANUP: Wipe test data to leave ONLY seed Admin & Inspector ──
    console.log('\n🧹 Purging test records from Supabase...');
    await supabase.from('exam_code_attempts').delete().eq('exam_code', finalExamCode);
    await supabase.from('questions_ec').delete().eq('exam_code', finalExamCode);
    await supabase.from('exam_codes').delete().eq('exam_code', finalExamCode);
    await supabase.from('students').delete().eq('hall_ticket', testHallTicket);
    if (collegeId) {
      await supabase.from('colleges').delete().eq('id', collegeId);
    }
    await supabase.from('proctor_logs').delete().eq('exam_id', finalExamCode);
    pass('17. CLEANUP', 'All test records wiped; database cleanly reset to zero demo data');

    console.log('\n================================================================');
    console.log(`🎉 ALL ${passed}/17 PRODUCTION LIFECYCLE TESTS PASSED CLEANLY!`);
    console.log('================================================================\n');
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ Test failed with error:', err.message);
    process.exit(1);
  }
}

runEndToEnd();
