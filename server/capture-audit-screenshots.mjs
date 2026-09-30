import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import WebSocket from 'ws';

const routesToAudit = [
  { id: '01_landing', path: '/', name: 'LandingPage' },
  { id: '02_enter_exam', path: '/enter-exam', name: 'EnterExamPage' },
  { id: '03_instructions', path: '/instructions/DEMO123', name: 'InstructionsPage' },
  { id: '04_quiz', path: '/quiz/DEMO123', name: 'ExamCodeQuizPage' },
  { id: '05_result_ec', path: '/result-ec/DEMO123', name: 'ResultECPage' },
  { id: '06_leaderboard_ec', path: '/leaderboard-ec/DEMO123', name: 'LeaderboardECPage' },
  { id: '07_verify_cert', path: '/verify/GR-VRSEC-2026-HT2026001', name: 'VerifyCertificatePage' },
  { id: '08_practice_arena', path: '/practice', name: 'PracticeArenaPage' },
  { id: '09_candidate_gate', path: '/register', name: 'CandidateRegisterGatePage' },
  { id: '10_waiting_lobby', path: '/contest/demo-contest/waiting-lobby', name: 'WaitingLobbyPage' },
  { id: '11_student_login', path: '/login', name: 'StudentLoginPage' },
  { id: '12_forgot_password', path: '/forgot-password', name: 'ForgotPasswordPage' },
  { id: '13_reset_password', path: '/reset-password', name: 'ResetPasswordPage' },
  { id: '14_enroll', path: '/enroll/e1000000-0000-0000-0000-000000000001', name: 'EnrollPage' },
  { id: '15_otp_verify', path: '/enroll/e1000000-0000-0000-0000-000000000001/verify', name: 'OTPVerifyPage' },
  { id: '16_exam_legacy', path: '/exam', name: 'ExamPage' },
  { id: '17_leaderboard_legacy', path: '/leaderboard/e1000000-0000-0000-0000-000000000001', name: 'LeaderboardPage' },
  { id: '18_admin_login', path: '/admin/login', name: 'AdminLoginPage' },
  { id: '19_admin_dashboard', path: '/admin/dashboard', name: 'Dashboard' },
  { id: '20_admin_exams', path: '/admin/exams', name: 'ExamControl' },
  { id: '21_admin_questions', path: '/admin/questions', name: 'QuestionControl' },
  { id: '22_admin_students', path: '/admin/students', name: 'StudentControl' },
  { id: '23_admin_monitor', path: '/admin/monitor', name: 'MonitorControl' },
  { id: '24_admin_results', path: '/admin/results', name: 'ResultControl' },
  { id: '25_admin_settings', path: '/admin/settings', name: 'SettingsControl' },
  { id: '26_admin_staff', path: '/admin/staff', name: 'StaffManagementPage' },
  { id: '27_admin_create_exam', path: '/admin/create-exam', name: 'CreateExamPage' },
  { id: '28_admin_import', path: '/admin/import', name: 'ImportQuestionsPage' },
  { id: '29_admin_sessions', path: '/admin/sessions', name: 'SessionsPage' },
  { id: '30_admin_reports', path: '/admin/reports', name: 'ReportsPage' },
  { id: '31_admin_analytics', path: '/admin/analytics', name: 'AnalyticsPage' },
  { id: '32_admin_colleges', path: '/admin/colleges', name: 'CollegesPage' },
  { id: '33_admin_exam_codes', path: '/admin/exam-codes', name: 'ExamCodesPage' },
  { id: '34_about', path: '/about', name: 'AboutPage' },
  { id: '35_not_found', path: '/this-is-a-404-test-route', name: 'NotFoundPage' },
];

async function run() {
  console.log('=== STARTING AUDIT SCREENSHOTS & CONTENT EXTRACTION ===');
  const outDir = path.resolve('../screenshots/audit');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-edge-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9338;

  const edgeProcess = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    'about:blank',
  ]);

  let target = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json`);
      const list = await res.json();
      target = list.find((t) => t.type === 'page');
      if (target) break;
    } catch {}
  }

  if (!target) {
    console.error('Failed to connect to Edge debugger');
    edgeProcess.kill();
    return;
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.on('open', resolve));

  let reqId = 1;
  const send = (method, params = {}) => {
    return new Promise((resolve) => {
      const id = reqId++;
      const handler = (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.id === id) {
          ws.off('message', handler);
          resolve(msg.result);
        }
      };
      ws.on('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  const pageLogs = [];
  const pageErrors = [];

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.method === 'Console.messageAdded' && msg.params.message.level === 'error') {
      pageErrors.push(`[Console Error] ${msg.params.message.text}`);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const desc = msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text;
      pageErrors.push(`[Runtime Exception] ${desc}`);
    }
  });

  await send('Console.enable');
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');

  const evalJs = async (expr) => {
    const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return res?.result?.value;
  };

  // First, obtain an admin token from the backend
  console.log('Fetching admin token from backend API...');
  let adminToken = '';
  let adminUser = {};
  try {
    const loginRes = await fetch('http://localhost:3001/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    const loginData = await loginRes.json();
    adminToken = loginData.token || '';
    adminUser = loginData.user || {};
    console.log('Admin token acquired:', adminToken ? 'YES' : 'NO');
  } catch (e) {
    console.warn('Could not login directly via API:', e.message);
  }

  // Pre-seed mock attempt in localStorage for instructions & quiz pages
  const attemptPayload = JSON.stringify({
    attemptId: 'att_demo_audit_001',
    examCode: 'DEMO123',
    hallTicket: '2201A0501',
    examDetails: {
      exam_name: 'GROWTHRAN Autonomous Engineering Sprint',
      duration_minutes: 45,
      total_questions: 15,
    },
  });

  const auditReport = [];

  // Loop through all routes
  for (const item of routesToAudit) {
    console.log(`\n--- Auditing ${item.id}: ${item.name} (${item.path}) ---`);
    pageErrors.length = 0;

    // 1. Desktop Viewport 1440x900
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    const fullUrl = `http://localhost:5173${item.path}`;
    await send('Page.navigate', { url: fullUrl });

    // Seed localStorage if needed
    await new Promise((r) => setTimeout(r, 600));
    await evalJs(`
      if (${Boolean(adminToken)}) {
        localStorage.setItem('admin_token', ${JSON.stringify(adminToken)});
        localStorage.setItem('admin_user', ${JSON.stringify(JSON.stringify(adminUser))});
      }
      localStorage.setItem('growthran_attempt', ${JSON.stringify(attemptPayload)});
      localStorage.setItem('lw_attempt', ${JSON.stringify(attemptPayload)});
      localStorage.setItem('student_token', 'mock_student_jwt_audit');
      localStorage.setItem('session_token', 'mock_session_jwt_audit');
    `);

    // Allow page animations and React components to settle
    await new Promise((r) => setTimeout(r, 2400));

    // Capture desktop screenshot
    const shot1440 = await send('Page.captureScreenshot', { format: 'png' });
    if (shot1440?.data) {
      const p1440 = path.join(outDir, `${item.id}_1440.png`);
      fs.writeFileSync(p1440, Buffer.from(shot1440.data, 'base64'));
      console.log(`  Saved 1440px screenshot: ${item.id}_1440.png`);
    }

    // Extract content details from the page
    const pageData = await evalJs(`
      (() => {
        const h1 = Array.from(document.querySelectorAll('h1')).map(e => e.innerText.trim()).filter(Boolean);
        const h2 = Array.from(document.querySelectorAll('h2')).map(e => e.innerText.trim()).filter(Boolean);
        const h3 = Array.from(document.querySelectorAll('h3')).map(e => e.innerText.trim()).filter(Boolean);
        const buttons = Array.from(document.querySelectorAll('button, a.btn, a[role="button"]')).map(e => e.innerText.trim().replace(/\\n/g, ' ')).filter(Boolean);
        const inputs = Array.from(document.querySelectorAll('input, select, textarea')).map(e => ({
          id: e.id,
          placeholder: e.placeholder,
          name: e.name,
          type: e.type
        }));
        const stats = Array.from(document.querySelectorAll('.stat-val, .stat-value, .stat-number, [data-stat]')).map(e => e.innerText.trim()).filter(Boolean);
        const canvasCount = document.querySelectorAll('canvas').length;
        const currentUrl = window.location.href;
        const bodySnippet = document.body.innerText.substring(0, 500).replace(/\\s+/g, ' ');

        return {
          h1,
          h2: h2.slice(0, 6),
          h3: h3.slice(0, 6),
          buttons: buttons.slice(0, 10),
          inputs,
          stats,
          canvasCount,
          currentUrl,
          bodySnippet
        };
      })()
    `);

    // 2. Mobile Viewport 375x812
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await new Promise((r) => setTimeout(r, 1200));

    const shot375 = await send('Page.captureScreenshot', { format: 'png' });
    if (shot375?.data) {
      const p375 = path.join(outDir, `${item.id}_375.png`);
      fs.writeFileSync(p375, Buffer.from(shot375.data, 'base64'));
      console.log(`  Saved 375px screenshot: ${item.id}_375.png`);
    }

    auditReport.push({
      route: item,
      pageData,
      errors: [...pageErrors],
    });
  }

  // Save audit data JSON for documentation reference
  fs.writeFileSync(path.join(outDir, 'audit_extracted_content.json'), JSON.stringify(auditReport, null, 2));
  console.log(`\nAudit complete! Extracted content saved to ${path.join(outDir, 'audit_extracted_content.json')}`);

  ws.close();
  edgeProcess.kill();
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
}

run().catch(console.error);
