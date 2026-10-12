import dotenv from 'dotenv';
dotenv.config();

import {
  sendMail,
  sendAdminWelcome,
  sendInspectorCreated,
  sendFacultyCreated,
  sendStudentOtp,
  sendStudentRegistered,
  sendPasswordReset,
  sendExamScheduled,
  sendFacultyPaperAllocated,
  sendResultReport,
  sendAdminAlert,
  getMailLogs,
  resendMailLogById,
  memoryMailLogs,
  MAIL_FROM_NOREPLY,
  MAIL_REPLY_TO,
  RESEND_API_KEY,
} from '../services/mailService';

async function runRoleMailVerification() {
  console.log('\n========================================================================');
  console.log('🚀 [LOGICWHILE LIRE] ROLE-BASED RESEND EMAIL SERVICE VERIFICATION');
  console.log('========================================================================\n');

  const apiKey = process.env.RESEND_API_KEY || RESEND_API_KEY;
  console.log(`📡 [Config] RESEND_API_KEY configured: ${Boolean(apiKey)} (Prefix: ${apiKey ? apiKey.slice(0, 7) + '...' : 'none'})`);
  console.log(`📤 [Config] MAIL_FROM_NOREPLY: ${process.env.MAIL_FROM_NOREPLY || MAIL_FROM_NOREPLY}`);
  console.log(`📥 [Config] MAIL_REPLY_TO: ${process.env.MAIL_REPLY_TO || MAIL_REPLY_TO}\n`);

  const testEmail = 'charansairamavath@gmail.com';
  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ [PASS] ${testName}`);
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
    }
  }

  // ── TEST 1: Direct sendMail with Resend ───────────────────────────────────
  console.log('--- 1. Testing Core sendMail() ---');
  const directSend = await sendMail({
    to: testEmail,
    subject: '🧪 LogicWhile LiRE Core Service Test',
    html: '<p>Core sendMail test verification.</p>',
    text: 'Core sendMail test verification.',
    template: 'system_test',
    sentBy: 'test_runner',
  });
  assert(directSend.success, `Core sendMail dispatched successfully (Status: ${directSend.status}, ResendId: ${directSend.resend_id})`);
  assert(Boolean(directSend.log_id), `Log record ID generated: ${directSend.log_id}`);

  // ── TEST 2: Template: admin_welcome ────────────────────────────────────────
  console.log('\n--- 2. Testing Template: admin_welcome ---');
  const adminWelcomeRes = await sendAdminWelcome({
    name: 'Super Admin',
    email: testEmail,
    role: 'super_admin',
  });
  assert(adminWelcomeRes.success, 'admin_welcome template delivered');

  // ── TEST 3: Template: inspector_created ────────────────────────────────────
  console.log('\n--- 3. Testing Template: inspector_created ---');
  const inspectorRes = await sendInspectorCreated({
    name: 'Inspector Vikram Rao',
    email: testEmail,
    tempPassword: 'Insp#982143!',
    collegeName: 'Vasavi College of Engineering',
  });
  assert(inspectorRes.success, 'inspector_created template delivered');

  // ── TEST 4: Template: faculty_created (with temp password & assigned sections)
  console.log('\n--- 4. Testing Template: faculty_created ---');
  const facultyRes = await sendFacultyCreated({
    name: 'Dr. Anita Sharma',
    email: testEmail,
    tempPassword: 'Faculty#774129!',
    assignedSections: ['Section A', 'Section B', 'CSE Core Batch 1'],
    collegeName: 'Chaitanya Bharathi Institute of Technology',
  });
  assert(facultyRes.success, 'faculty_created template delivered with assigned sections and temp password');

  // ── TEST 5: Template: student_otp (10 min expiry, max 3 attempts) ──────────
  console.log('\n--- 5. Testing Template: student_otp ---');
  const studentOtpRes = await sendStudentOtp({
    name: 'Charan Sai',
    email: testEmail,
    otp: '482910',
    expiresMinutes: 10,
    maxAttempts: 3,
    verifyUrl: 'https://logicwhilelire.com/verify-email?token=test_token&email=' + encodeURIComponent(testEmail),
  });
  assert(studentOtpRes.success, 'student_otp template delivered with 10-minute expiry warning');

  // ── TEST 6: Template: student_registered ──────────────────────────────────
  console.log('\n--- 6. Testing Template: student_registered ---');
  const studentRegRes = await sendStudentRegistered({
    name: 'Charan Sai',
    email: testEmail,
    hallTicket: '2026-CSE-0042',
    collegeName: 'Vasavi College of Engineering',
  });
  assert(studentRegRes.success, 'student_registered confirmation delivered');

  // ── TEST 7: Template: password_reset ──────────────────────────────────────
  console.log('\n--- 7. Testing Template: password_reset ---');
  const passResetRes = await sendPasswordReset({
    name: 'Charan Sai',
    email: testEmail,
    resetUrl: 'https://logicwhilelire.com/reset-password?token=test_reset_token',
    expiresMinutes: 15,
  });
  assert(passResetRes.success, 'password_reset template delivered');

  // ── TEST 8: Template: exam_scheduled (Targeted Criteria) ──────────────────
  console.log('\n--- 8. Testing Template: exam_scheduled ---');
  const examSchedRes = await sendExamScheduled({
    toEmail: testEmail,
    studentName: 'Charan Sai',
    hallTicket: '2026-CSE-0042',
    examTitle: 'Advanced Data Structures & Algorithms Benchmark',
    examCode: 'DSA-2026-A1',
    durationMinutes: 90,
    scheduledAt: 'Oct 15, 2026 at 10:00 AM IST',
    targetedCriteria: {
      collegeName: 'Vasavi College of Engineering',
      branch: 'CSE',
      year: 2026,
      section: 'Section A',
    },
  });
  assert(examSchedRes.success, 'exam_scheduled delivered with targeted criteria');

  // ── TEST 9: Template: faculty_paper_allocated ─────────────────────────────
  console.log('\n--- 9. Testing Template: faculty_paper_allocated ---');
  const paperAllocRes = await sendFacultyPaperAllocated({
    toEmail: testEmail,
    facultyName: 'Dr. Anita Sharma',
    examTitle: 'Cloud Computing & Distributed Systems',
    examCode: 'CLOUD-2026-FINAL',
    questionCount: 45,
    submissionDeadline: 'Oct 14, 2026 at 17:00 IST',
  });
  assert(paperAllocRes.success, 'faculty_paper_allocated delivered');

  // ── TEST 10: Template: result_report ──────────────────────────────────────
  console.log('\n--- 10. Testing Template: result_report ---');
  const resultReportRes = await sendResultReport({
    toEmail: testEmail,
    studentName: 'Charan Sai',
    hallTicket: '2026-CSE-0042',
    examTitle: 'Advanced Data Structures & Algorithms Benchmark',
    examCode: 'DSA-2026-A1',
    score: 88,
    maxScore: 100,
    percentage: 88,
    rank: 1,
    correctCount: 44,
    wrongCount: 6,
    timeTakenSeconds: 3120,
  });
  assert(resultReportRes.success, 'result_report scorecard delivered');

  // ── TEST 11: Template: admin_alert (Anti-Cheat & Daily Backup) ─────────────
  console.log('\n--- 11. Testing Template: admin_alert ---');
  const antiCheatAlert = await sendAdminAlert({
    alertType: 'anti_cheat_termination',
    title: 'Candidate Terminated for Proctoring Breach',
    message: 'Candidate exceeded maximum violation threshold during active exam session.',
    details: {
      candidateName: 'Test Student',
      hallTicket: '2026-CSE-0999',
      examTitle: 'Operating Systems Benchmark',
      violationCount: 3,
      reason: 'Repeated tab switches detected by Proctor telemetry',
      ipAddress: '192.168.1.42',
    },
    targetAdminEmail: testEmail,
  });
  assert(antiCheatAlert.success, 'admin_alert (anti-cheat termination) delivered');

  const backupAlert = await sendAdminAlert({
    alertType: 'daily_backup_completed',
    title: 'Nightly Database Backup Completed',
    message: 'Automated nightly disaster recovery backup completed successfully.',
    details: {
      backupId: 'backup_20261011_020000',
      fileCount: 48,
      googleDriveStatus: 'synced_ok',
    },
    targetAdminEmail: testEmail,
  });
  assert(backupAlert.success, 'admin_alert (daily backup done) delivered');

  // ── TEST 12: Password Sanitization in Mail Logs ────────────────────────────
  console.log('\n--- 12. Verifying Password Sanitization in Mail Logs ---');
  const facultyLog = memoryMailLogs.find((l) => l.template === 'faculty_created');
  assert(Boolean(facultyLog), 'faculty_created log entry found in mail_logs');
  if (facultyLog) {
    const rawPassInMeta = JSON.stringify(facultyLog.metadata).includes('Faculty#774129!');
    assert(!rawPassInMeta, 'Temporary password masked in stored log metadata (NO plain text passwords stored)');
    const rawPassInHtml = (facultyLog.html_content || '').includes('Faculty#774129!');
    assert(!rawPassInHtml, 'Temporary password masked in stored log HTML content');
  }

  // ── TEST 13: Querying Mail Logs (Admin Screen API) ────────────────────────
  console.log('\n--- 13. Testing Admin Mail Logs Query & Resend ---');
  const logsQuery = await getMailLogs({ page: 1, limit: 10 });
  assert(logsQuery.logs.length > 0, `getMailLogs retrieved ${logsQuery.logs.length} entries`);
  assert(logsQuery.stats.total > 0, `Stats show ${logsQuery.stats.total} total emails dispatched`);

  // Test Resend of an existing log
  if (logsQuery.logs[0]) {
    const targetLogId = logsQuery.logs[0].id;
    console.log(`  🔄 Testing Resend for Log ID: ${targetLogId}...`);
    const resendResult = await resendMailLogById(targetLogId);
    assert(resendResult.success, `resendMailLogById succeeded (New ID: ${resendResult.id})`);
  }

  console.log('\n========================================================================');
  console.log(`🏁 VERIFICATION SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('========================================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runRoleMailVerification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
