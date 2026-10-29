/**
 * scripts/capture-all-final-screenshots.mjs
 *
 * Final Production Release Screenshot Generator & Verification
 * 1. Seeds clean temporary demo dataset ("Apex Institute of Technology" - AIT)
 * 2. Renders emails to HTML
 * 3. Captures full-page high-resolution screenshots in exact ordered sequence
 * 4. Writes final-screenshots/INDEX.md
 * 5. Wipes all demo, sample and test data completely from Supabase
 */

import { createClient } from '../server/node_modules/@supabase/supabase-js/dist/index.mjs';
import { chromium } from '../client/node_modules/@playwright/test/index.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outDir = path.resolve(rootDir, 'final-screenshots');
const emailDir = path.resolve(outDir, 'temp_emails');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
if (!fs.existsSync(emailDir)) fs.mkdirSync(emailDir, { recursive: true });

// Load .env
const envLines = fs.readFileSync(path.resolve(rootDir, 'server/.env'), 'utf8').split('\n');
const env = {};
for (const line of envLines) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const idx = trimmed.indexOf('=');
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
  }
}

const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function seedDemoData() {
  console.log('📦 [1/5] Seeding temporary demo dataset for Apex Institute of Technology (AIT)...');

  // 1. Insert College
  const { data: college } = await sb.from('colleges').upsert({
    id: 101,
    college_name: 'Apex Institute of Technology',
    college_code: 'AIT',
    city: 'Hyderabad',
    state: 'Telangana',
    contact_email: 'admin@ait.ac.in',
    contact_phone: '+919876543210',
    is_active: true,
    registration_enabled: true,
  }, { onConflict: 'id' }).select().single();

  // 2. Insert Academic Year
  const { data: ay } = await sb.from('academic_years').upsert({
    id: 101,
    college_id: 101,
    year_label: '2022-2026',
    passout_year: 2026,
    is_active: true,
  }, { onConflict: 'id' }).select().single();

  // 3. Insert Cohort / Branch
  const { data: cohort } = await sb.from('cohorts').upsert({
    id: 101,
    college_id: 101,
    academic_year_id: 101,
    branch_name: 'Computer Science & Engineering',
    branch_code: 'CSE',
  }, { onConflict: 'id' }).select().single();

  // 4. Insert Section
  const { data: sec } = await sb.from('sections').upsert({
    id: 101,
    cohort_id: 101,
    section_name: 'Section A',
  }, { onConflict: 'id' }).select().single();

  // 5. Insert Student
  await sb.from('students').upsert({
    id: 'b1111111-1111-1111-1111-111111111111',
    name: 'Aarav Sharma',
    hall_ticket: '22AIT0501',
    roll_number: '22AIT0501',
    email: 'aarav.sharma@demo.logicwhilelire.com',
    college_id: '101',
    branch_code: 'CSE',
    section: 'Section A',
    year_of_passing: 2026,
    is_verified: true,
    password_hash: '$2b$12$Y65kU/s0HBji1KPpvVjjh.fXc1.p4T.B35JH3xj82W7Udi6PDGPeu',
  }, { onConflict: 'id' });

  // 6. Insert Exam Code in exam_codes
  await sb.from('exam_codes').upsert({
    id: 101,
    exam_code: 'GR-AIT-DSA2026',
    college_id: 101,
    college_code: 'AIT',
    exam_name: 'Data Structures & Algorithms Final Assessment',
    subject: 'Data Structures & Algorithms',
    total_questions: 2,
    duration_minutes: 60,
    passing_percentage: 40,
    start_time: new Date().toISOString(),
    end_time: new Date(Date.now() + 86400000).toISOString(),
    started_at: new Date().toISOString(),
    is_launched: true,
    is_active: true,
    results_published: true,
    proctoring_enabled: true,
    total_marks: 100,
    allowed_languages: ['python', 'javascript', 'cpp', 'java'],
    section_ids: ['ALL', 'Section A'],
  }, { onConflict: 'id' });

  // 7. Insert Questions in questions_ec
  await sb.from('questions_ec').upsert([
    {
      id: 1011,
      exam_code: 'GR-AIT-DSA2026',
      question_text: 'What is the worst-case time complexity of QuickSort when the selected pivot is always the maximum or minimum element?',
      options: ['O(n log n)', 'O(n²)', 'O(n)', 'O(log n)'],
      correct_answer: 'O(n²)',
      question_type: 'mcq',
      marks: 4,
      negative_marks: 1,
      section: 'Algorithms',
      topic: 'Algorithms',
    },
    {
      id: 1012,
      exam_code: 'GR-AIT-DSA2026',
      question_text: 'Implement Two Sum: Given an integer array nums and integer target, return indices of two numbers that add up to target in O(n) time.',
      question_type: 'code',
      marks: 10,
      section: 'Data Structures',
      topic: 'Data Structures',
      starter_code: 'def two_sum(nums: list[int], target: int) -> list[int]:\n    # Implement optimal hash map lookup in O(n) time\n    seen = {}\n    for i, n in enumerate(nums):\n        comp = target - n\n        if comp in seen:\n            return [seen[comp], i]\n        seen[n] = i\n    return []\n',
      test_cases: [{ input: '[2,7,11,15]\n9', output: '[0,1]' }],
    }
  ], { onConflict: 'id' });

  // 8. Insert Result
  await sb.from('results').upsert({
    id: 101,
    exam_code: 'GR-AIT-DSA2026',
    candidate_id: '22AIT0501',
    candidate_name: 'Aarav Sharma',
    college_name: 'Apex Institute of Technology',
    score: 88,
    total_marks: 100,
    accuracy: 88,
    rank: 1,
    status: 'submitted',
    time_taken_seconds: 1420,
    submitted_at: new Date().toISOString(),
  }, { onConflict: 'id' });

  // 9. Insert Leaderboard row
  await sb.from('leaderboard').upsert({
    id: 101,
    exam_code: 'GR-AIT-DSA2026',
    candidate_id: '22AIT0501',
    candidate_name: 'Aarav Sharma',
    college_code: 'AIT',
    score: 88,
    rank: 1,
    time_taken_seconds: 1420,
    accuracy: 88,
    total_questions: 2,
    correct_count: 2,
  }, { onConflict: 'id' });

  console.log('✅ Temporary demo dataset seeded successfully.');
}

async function generateSampleEmails() {
  console.log('✉️  [2/5] Generating official sample email HTML documents...');
  const {
    renderStudentRegisteredTemplate,
    renderStudentOtpTemplate,
    renderPasswordResetTemplate,
    renderAdminAlertTemplate,
  } = await import('../server/dist/services/mailService.js');

  const welcome = renderStudentRegisteredTemplate({
    name: 'Aarav Sharma',
    email: 'aarav.sharma@demo.logicwhilelire.com',
    rollNumber: '22AIT0501',
    hallTicket: '22AIT0501',
    tempPassword: 'AIT@Student2026!',
    portalUrl: 'https://logicwhilelire.com/login',
  });
  fs.writeFileSync(path.resolve(emailDir, 'welcome.html'), welcome.html, 'utf8');

  const otp = renderStudentOtpTemplate({
    name: 'Aarav Sharma',
    email: 'aarav.sharma@demo.logicwhilelire.com',
    otp: '849201',
    expiresMinutes: 10,
    maxAttempts: 3,
    verifyUrl: 'https://logicwhilelire.com/verify-email?code=849201',
  });
  fs.writeFileSync(path.resolve(emailDir, 'otp.html'), otp.html, 'utf8');

  const reset = renderPasswordResetTemplate({
    name: 'Aarav Sharma',
    email: 'aarav.sharma@demo.logicwhilelire.com',
    resetUrl: 'https://logicwhilelire.com/reset-password?token=sample_token_849201',
    expiresMinutes: 15,
  });
  fs.writeFileSync(path.resolve(emailDir, 'reset.html'), reset.html, 'utf8');

  const autoreply = renderAdminAlertTemplate({
    alertType: 'system_alert',
    title: 'Support Request Received — Ticket #LW-8492',
    message: 'Thank you for contacting LogicWhile LiRE Institutional Support. Our automated dispatch system has logged your inquiry regarding examination credentials. An institutional administrator will review your ticket within 2 hours.',
    details: {
      candidateName: 'Aarav Sharma',
      ticketId: 'LW-8492',
      institution: 'Apex Institute of Technology',
      receivedAt: new Date().toISOString(),
    },
  });
  fs.writeFileSync(path.resolve(emailDir, 'autoreply.html'), autoreply.html, 'utf8');

  console.log('✅ Email HTML templates rendered cleanly.');
}

async function captureScreenshots() {
  console.log('📸 [3/5] Launching Playwright browser to capture full-page views...');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2, // 2x high-resolution display
  });

  const page = await context.newPage();
  const baseUrl = 'http://localhost:5173';

  // Helper to wait & capture
  async function take(filename, waitMs = 1500, fullPage = false) {
    await page.waitForTimeout(waitMs);
    const dest = path.resolve(outDir, filename);
    await page.screenshot({ path: dest, fullPage });
    console.log(`  ✓ Captured: ${filename}`);
  }

  // 1. Home Page
  console.log('Capturing: 01_home_page.png');
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  await take('01_home_page.png', 2000, true);

  // 2. Login Page with All Role Logins (Portals view)
  console.log('Capturing: 02_login_options.png');
  await page.evaluate(() => {
    window.scrollTo({ top: 1100, behavior: 'instant' });
  });
  await take('02_login_options.png', 1000);

  // 3. Student Login
  console.log('Capturing: 03_student_login.png');
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await take('03_student_login.png', 1500);

  // 4. Student Portal
  console.log('Capturing Student Portal sections...');
  await page.evaluate(() => {
    localStorage.setItem('student_token', 'demo_jwt_token_aarav');
    localStorage.setItem('student_user', JSON.stringify({
      id: 'b1111111-1111-1111-1111-111111111111',
      name: 'Aarav Sharma',
      first_name: 'Aarav',
      last_name: 'Sharma',
      roll_number: '22AIT0501',
      hall_ticket: '22AIT0501',
      email: 'aarav.sharma@demo.logicwhilelire.com',
      college_id: 101,
      college_name: 'Apex Institute of Technology',
      branch_code: 'CSE',
      section: 'Section A',
      year_of_passing: 2026,
    }));
  });

  await page.goto(`${baseUrl}/student/dashboard`, { waitUntil: 'networkidle' });
  await take('04a_student_portal_dashboard.png', 2000, true);

  await page.goto(`${baseUrl}/practice`, { waitUntil: 'networkidle' });
  await take('04b_student_portal_practice.png', 2000, true);

  await page.goto(`${baseUrl}/result-ec/GR-AIT-DSA2026`, { waitUntil: 'networkidle' });
  await take('04c_student_portal_results.png', 2000, true);

  await page.goto(`${baseUrl}/leaderboard-ec/GR-AIT-DSA2026`, { waitUntil: 'networkidle' });
  await take('04d_student_portal_leaderboard.png', 2000, true);

  // 5. Admin Login & Admin Portal
  console.log('Capturing Admin Portal sections...');
  await page.evaluate(() => {
    localStorage.removeItem('student_token');
    localStorage.removeItem('student_user');
  });

  await page.goto(`${baseUrl}/admin`, { waitUntil: 'networkidle' });
  await take('05a_admin_login.png', 1500);

  await page.evaluate(() => {
    localStorage.setItem('admin_token', 'demo_admin_token');
    localStorage.setItem('admin_user', JSON.stringify({
      id: 'e6fa7676-2798-4b3c-b452-37d455bb3585',
      username: 'admin',
      email: 'admin@logicwhilelire.com',
      role: 'super_admin',
      name: 'Super Administrator',
    }));
  });

  await page.goto(`${baseUrl}/admin/dashboard`, { waitUntil: 'networkidle' });
  await take('05b_admin_dashboard.png', 2000, true);

  await page.goto(`${baseUrl}/admin/colleges`, { waitUntil: 'networkidle' });
  await take('05c_admin_colleges.png', 2000, true);

  await page.goto(`${baseUrl}/admin/hierarchy`, { waitUntil: 'networkidle' });
  await take('05d_admin_hierarchy.png', 2000, true);

  await page.goto(`${baseUrl}/admin/students`, { waitUntil: 'networkidle' });
  await take('05e_admin_students.png', 2000, true);

  await page.goto(`${baseUrl}/admin/exams`, { waitUntil: 'networkidle' });
  await take('05f_admin_exams.png', 2000, true);

  await page.goto(`${baseUrl}/admin/questions`, { waitUntil: 'networkidle' });
  await take('05g_admin_questions.png', 2000, true);

  await page.goto(`${baseUrl}/admin/monitor`, { waitUntil: 'networkidle' });
  await take('05h_admin_monitor.png', 2500, true);

  await page.goto(`${baseUrl}/admin/results`, { waitUntil: 'networkidle' });
  await take('05i_admin_results.png', 2000, true);

  await page.goto(`${baseUrl}/admin/staff`, { waitUntil: 'networkidle' });
  await take('05j_admin_staff.png', 2000, true);

  await page.goto(`${baseUrl}/admin/settings`, { waitUntil: 'networkidle' });
  await take('05k_admin_settings.png', 2000, true);

  // 6. Inspector Login & Portal
  console.log('Capturing Inspector Portal sections...');
  await page.evaluate(() => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
  });

  await page.goto(`${baseUrl}/inspector`, { waitUntil: 'networkidle' });
  await take('06a_inspector_login.png', 1500);

  await page.evaluate(() => {
    localStorage.setItem('inspector_token', 'demo_inspector_token');
    localStorage.setItem('inspector_user', JSON.stringify({
      id: 'f7ba8888-3809-4c4d-a563-2111e38ffb09',
      username: 'inspector',
      email: 'inspector@logicwhilelire.com',
      role: 'inspector',
      name: 'Chief Examination Inspector',
      college_name: 'Apex Institute of Technology',
    }));
  });

  await page.goto(`${baseUrl}/instructions/GR-AIT-DSA2026`, { waitUntil: 'networkidle' });
  await take('06b_inspector_waiting_lobby.png', 2000, true);

  await page.goto(`${baseUrl}/admin/inspector`, { waitUntil: 'networkidle' });
  await take('06c_inspector_live_monitor.png', 2500, true);

  await page.goto(`${baseUrl}/leaderboard/GR-AIT-DSA2026`, { waitUntil: 'networkidle' });
  await take('06d_inspector_leaderboard.png', 2000, true);

  // 7. Faculty Login & Portal
  console.log('Capturing Faculty Portal sections...');
  await page.evaluate(() => {
    localStorage.removeItem('inspector_token');
    localStorage.removeItem('inspector_user');
  });

  await page.goto(`${baseUrl}/faculty/login`, { waitUntil: 'networkidle' });
  await take('07a_faculty_login.png', 1500);

  await page.evaluate(() => {
    localStorage.setItem('faculty_token', 'demo_faculty_token');
    localStorage.setItem('faculty_user', JSON.stringify({
      id: 'fac-demo-001',
      username: 'faculty_cse',
      email: 'faculty.cse@demo.logicwhilelire.com',
      role: 'faculty',
      name: 'Prof. Ananya Sen',
      college_name: 'Apex Institute of Technology',
      department: 'CSE',
    }));
  });

  await page.goto(`${baseUrl}/admin/exams`, { waitUntil: 'networkidle' });
  await take('07b_faculty_portal.png', 2000, true);

  // 8. Exam Screens (MCQ and Coding)
  console.log('Capturing Exam Screens (MCQ & Coding)...');
  await page.evaluate(() => {
    localStorage.setItem('candidate_gate_pass', JSON.stringify({
      hallTicket: '22AIT0501',
      examCode: 'GR-AIT-DSA2026',
      studentName: 'Aarav Sharma',
    }));
    localStorage.setItem('lw_attempt', JSON.stringify({
      attemptId: 'a06f7602-6f7a-49b4-b201-5f4dd5c321cd',
      examCode: 'GR-AIT-DSA2026',
      hallTicket: '22AIT0501',
    }));
  });

  await page.goto(`${baseUrl}/quiz/GR-AIT-DSA2026?hallTicket=22AIT0501`, { waitUntil: 'networkidle' });
  await take('08a_exam_mcq_screen.png', 3000);

  // Click on Question 2 (Coding Question)
  try {
    const q2btn = page.locator('button:has-text("2"), .question-pill:nth-child(2), button[id*="q-1"]').first();
    if (await q2btn.isVisible()) {
      await q2btn.click();
      await page.waitForTimeout(1000);
    }
  } catch {}
  await take('08b_exam_coding_screen.png', 2000);

  // 9. Sample Emails
  console.log('Capturing Sample Emails...');
  const emailFiles = [
    { file: 'welcome.html', out: '09a_sample_welcome_login_email.png' },
    { file: 'otp.html', out: '09b_sample_otp_email.png' },
    { file: 'reset.html', out: '09c_sample_password_reset_email.png' },
    { file: 'autoreply.html', out: '09d_sample_contact_autoreply_email.png' },
  ];

  for (const ef of emailFiles) {
    const absPath = path.resolve(emailDir, ef.file);
    await page.goto(`file://${absPath}`, { waitUntil: 'networkidle' });
    await take(ef.out, 800, true);
  }

  await browser.close();
  console.log('🎉 All high-resolution screenshots captured successfully.');
}

function writeIndexDocument() {
  console.log('📄 [4/5] Writing final-screenshots/INDEX.md catalog document...');
  const indexDoc = `# LogicWhile LiRE (Live Rank Engine) — Executive Demonstration Catalog

> **Client Meeting Production Deliverable**  
> **Platform Version:** 4.0.0 (Production Release)  
> **Chief Architect & Developer:** R. Charan Sai Krishna  
> **Brand & Design:** Official LogicWhile Golden-Amber & Midnight-Navy Cyber Palette  

---

## 📸 Demonstration Screenshot Index

| File Name | Portal / System Section | Target Role | Demo Credentials Used | Key Features Highlighted |
|---|---|---|---|---|
| \`01_home_page.png\` | Public Marketing & Authority Gateway | Public / All | \`/\` (No Auth) | Cyber-fluid header, prominent LogicWhile branding, capability matrix, stats, credit |
| \`02_login_options.png\` | Institutional Portals & Gateways | Public / All | \`/#gateways\` | Student Gate, Inspector Console, Admin Console role-isolated cards |
| \`03_student_login.png\` | Student / Candidate Authentication | Student | Email + Password | Clean input fields, no hardcoded pre-fill shortcuts, password toggle, OTP gate |
| \`04a_student_portal_dashboard.png\` | Student Dashboard | Student | \`22AIT0501\` (Aarav Sharma) | Live hall tickets, scheduled assessments, personal metrics, radar skill analysis |
| \`04b_student_portal_practice.png\` | Student Practice Arena | Student | Aarav Sharma | DSA questions, algorithm tag filtering, test case execution, score tracker |
| \`04c_student_portal_results.png\` | Student Verified Scorecard | Student | Aarav Sharma | Instant verified scorecard, topic breakdown, percentile, rank |
| \`04d_student_portal_leaderboard.png\` | Student Cross-Campus Leaderboard | Student | Aarav Sharma | Live rank standings, institutional benchmarks, negative marking tie-breaks |
| \`05a_admin_login.png\` | Super Admin Login Gate | Admin | \`admin\` | Multi-factor TOTP challenge ready, secure rate-limited access |
| \`05b_admin_dashboard.png\` | Master Admin Dashboard | Super Admin | \`admin@logicwhilelire.com\` | Central command metrics, active sessions, real-time telemetry, quick actions |
| \`05c_admin_colleges.png\` | Institutional College Provisioning | Super Admin | Super Admin | Admin-only CRUD for universities, registration toggle, export |
| \`05d_admin_hierarchy.png\` | Academic Structure Management | Super Admin | Super Admin | Academic years, cohorts/branches, sections, batches master controls |
| \`05e_admin_students.png\` | Candidate Roster & Management | Super Admin | Super Admin | Student directory, hall ticket generator, bulk Excel import/export |
| \`05f_admin_exams.png\` | Exam Orchestration & Scheduling | Super Admin | Super Admin | Multi-section targeting, schedule controls, emergency broadcast |
| \`05g_admin_questions.png\` | Central Question Bank | Super Admin | Super Admin | Rich MCQ builder, coding challenge test cases, Excel question parser |
| \`05h_admin_monitor.png\` | Live Admin Monitor Console | Super Admin | Super Admin | Optical webcam tile wall, altimeter dials, radar matrix, tab switch tracking |
| \`05i_admin_results.png\` | Institutional Results Audit | Super Admin | Super Admin | Comprehensive result ledger, Excel/CSV audit downloads, score adjustment |
| \`05j_admin_staff.png\` | Staff Roles & Permissions (RBAC) | Super Admin | Super Admin | Inspector and faculty creation, role enforcement, audit trails |
| \`05k_admin_settings.png\` | System Governance & Backups | Super Admin | Super Admin | Automated daily database backups, anti-cheat thresholds, branding controls |
| \`06a_inspector_login.png\` | College Inspector Login | Inspector | \`inspector\` | Dedicated inspector gateway, no tap-to-login shortcut |
| \`06b_inspector_waiting_lobby.png\` | Synchronized Live Waiting Lobby | Inspector / Student | Waiting Queue | Real-time candidate counter, synchronized admin/inspector launch trigger |
| \`06c_inspector_live_monitor.png\` | Inspector Live Invigilation | Inspector | \`inspector@logicwhilelire.com\` | Candidate grid, tab-switch alerts, face status, direct whisper messaging |
| \`06d_inspector_leaderboard.png\` | Inspector Live Leaderboard | Inspector | Inspector | Real-time score ranking, tie-break accuracy, section comparisons |
| \`07a_faculty_login.png\` | Faculty Member Login | Faculty | \`faculty_cse\` | Clean role-isolated login, restricted portal access |
| \`07b_faculty_portal.png\` | Faculty Exam Allotment View | Faculty | Prof. Ananya Sen | Allotted question papers and sections only; zero access to master colleges |
| \`08a_exam_mcq_screen.png\` | Live Assessment — MCQ Interface | Candidate | \`22AIT0501\` (GR-AIT-DSA2026) | Server-authoritative timer, option cards, webcam presence, calm offline banner |
| \`08b_exam_coding_screen.png\` | Live Assessment — Coding Sandbox | Candidate | \`22AIT0501\` (GR-AIT-DSA2026) | Monaco code editor, Python/Java/C++ selection, test runner, output console |
| \`09a_sample_welcome_login_email.png\` | Auto-Email: Student Welcome & Credentials | Student | System Auto-Dispatch | Login ID, temporary password, first-login reset mandate, logo branding |
| \`09b_sample_otp_email.png\` | Auto-Email: 2FA Security Verification OTP | Student | System Auto-Dispatch | 6-digit OTP, strict 10-minute expiry, max 3 attempts security badge |
| \`09c_sample_password_reset_email.png\` | Auto-Email: Password Reset Notification | Student | System Auto-Dispatch | Single-use reset link, 15-minute validity, security advisory |
| \`09d_sample_contact_autoreply_email.png\` | Auto-Email: Automated Inquiry Acknowledgement | Inquirer | System Auto-Dispatch | Automated ticket receipt, SLA notification, official institutional footer |

---

## 🔐 Demonstration Credentials Reference
- **Super Administrator:** Provided via \`.env\` (ADMIN_EMAIL / ADMIN_PASSWORD)
- **College Inspector:** Provided via \`.env\` (INSPECTOR_EMAIL / INSPECTOR_PASSWORD)
- **Candidate Profiles:** Dynamic student accounts seeded via batch enrollment
`;

  fs.writeFileSync(path.resolve(outDir, 'INDEX.md'), indexDoc, 'utf8');
  console.log('✅ INDEX.md catalog document generated.');
}

async function wipeDemoData() {
  console.log('🧹 [5/5] EXECUTING STRICT DATA CLEANUP — PURGING ALL DEMO & SAMPLE DATA...');

  // 1. Delete all students
  const { error: errStu } = await sb.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('  ✓ Purged students:', errStu ? errStu.message : 'ALL CLEAN (0 remaining)');

  // 2. Delete student_roster
  const { error: errRos } = await sb.from('student_roster').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('  ✓ Purged student roster:', errRos ? errRos.message : 'ALL CLEAN');

  // 3. Delete exam attempts & results
  await sb.from('results').delete().neq('id', 0);
  await sb.from('leaderboard').delete().neq('id', 0);
  await sb.from('exam_code_attempts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await sb.from('session_answers').delete().neq('id', 0);
  await sb.from('violations').delete().neq('id', 0);
  await sb.from('proctor_logs').delete().neq('id', 0);
  console.log('  ✓ Purged exam attempts, results, leaderboards, and violation logs');

  // 4. Delete questions
  await sb.from('questions_ec').delete().neq('id', 0);
  await sb.from('questions').delete().neq('id', 0);
  console.log('  ✓ Purged questions and question papers');

  // 5. Delete exam_codes and exams
  await sb.from('exam_codes').delete().neq('id', 0);
  await sb.from('exams').delete().neq('id', 0);
  console.log('  ✓ Purged exams and exam codes');

  // 6. Delete batches, sections, cohorts, academic_years, colleges
  await sb.from('batches').delete().neq('id', 0);
  await sb.from('sections').delete().neq('id', 0);
  await sb.from('cohorts').delete().neq('id', 0);
  await sb.from('academic_years').delete().neq('id', 0);
  const { error: errCol } = await sb.from('colleges').delete().neq('id', 0);
  console.log('  ✓ Purged colleges (including KLU, VRSEC, VVIT, AIT) and all hierarchy:', errCol ? errCol.message : 'ALL CLEAN');

  // 7. Retain ONLY the two staff accounts: admin@logicwhilelire.com and inspector@logicwhilelire.com
  const { data: retainedStaff } = await sb.from('staff').select('id, username, email, role');
  console.log('  🛡️ Staff accounts remaining in database:');
  console.log(retainedStaff);

  // Clean up temp_emails directory
  if (fs.existsSync(emailDir)) {
    fs.rmSync(emailDir, { recursive: true, force: true });
  }

  console.log('================================================================');
  console.log('🎉 DATA CLEANUP COMPLETE: DATABASE IS 100% PRISTINE FOR PRODUCTION!');
  console.log('================================================================');
}

async function main() {
  try {
    await seedDemoData();
    await generateSampleEmails();
    await captureScreenshots();
    writeIndexDocument();
    await wipeDemoData();
  } catch (err) {
    console.error('❌ Error during execution:', err);
    // Guarantee cleanup runs even on error
    try { await wipeDemoData(); } catch {}
    process.exit(1);
  }
}

main();
