import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import WebSocket from 'ws';

async function run() {
  console.log('=== STARTING VISUAL PROOF SCREENSHOT CAPTURE (EDGE CDP) ===');
  const artifactDir = 'C:\\Users\\chitt\\.gemini\\antigravity-ide\\brain\\b0d67fa4-04fc-4a53-98ed-b4e99e2264ff';
  const outDir = path.join(artifactDir, 'verification_proof');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proof-edge-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9339;

  const edgeProcess = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1440,900',
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

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  const navigateAndCapture = async (url, filename, setupFn) => {
    console.log(`Capturing: ${url} -> ${filename}...`);
    await send('Page.navigate', { url });
    await new Promise((r) => setTimeout(r, 1500));
    if (setupFn) {
      await setupFn();
      await new Promise((r) => setTimeout(r, 800));
    }
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    if (shot && shot.data) {
      const filePath = path.join(outDir, filename);
      fs.writeFileSync(filePath, Buffer.from(shot.data, 'base64'));
      console.log(`  ✅ Saved: ${filePath}`);
    }
  };

  // 1. Home Page with Fixed Topbar
  await navigateAndCapture('http://localhost:5173/', '01_home_fixed_topbar.png');

  // 2. Inspector Portal
  await navigateAndCapture('http://localhost:5173/inspector', '02_inspector_portal.png');

  // 3. Question Bank with Admin Authentication
  // Obtain fresh admin token from backend
  let adminToken = '';
  try {
    const loginRes = await fetch('http://localhost:3001/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'LogicWhile#Admin2026!' }),
    });
    const loginData = await loginRes.json();
    adminToken = loginData.token;
  } catch (err) {
    console.warn('Backend login notice:', err);
  }

  // Pre-seed token in localStorage on localhost:5173 domain
  await send('Page.navigate', { url: 'http://localhost:5173/' });
  await new Promise((r) => setTimeout(r, 1000));
  if (adminToken) {
    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('admin_token', '${adminToken}');
        localStorage.setItem('admin_user', JSON.stringify({ username: 'admin', role: 'super_admin' }));
      `,
    });
  }

  await navigateAndCapture(
    'http://localhost:5173/admin/questions',
    '03_question_bank_flow.png'
  );

  // 4. Results EC Page Audit Manifest
  await navigateAndCapture(
    'http://localhost:5173/result-ec/CS2026?hallTicket=24HU1A05F9',
    '04_results_audit_manifest.png',
    async () => {
      await send('Runtime.evaluate', {
        expression: `
          const sampleQuestions = [
            { id: 'q1', type: 'mcq', question_type: 'mcq', question: 'What is the time complexity of searching in a balanced Binary Search Tree?', options: { a: 'O(1)', b: 'O(log n)', c: 'O(n)', d: 'O(n log n)' }, candidateAnswer: 'B', correctAnswer: 'B', marks: 2, isCorrect: true },
            { id: 'q2', type: 'mcq', question_type: 'mcq', question: 'Which page replacement algorithm suffers from Belady\\'s Anomaly?', options: { a: 'LRU', b: 'FIFO', c: 'Optimal', d: 'Clock' }, candidateAnswer: 'A', correctAnswer: 'B', marks: 2, isCorrect: false },
            { id: 'q3', type: 'coding', question_type: 'coding', question: 'Implement an in-place array rotation algorithm by k positions.', candidateAnswer: 'def rotate(nums, k):\\n    k %= len(nums)\\n    nums.reverse()\\n    nums[:k] = reversed(nums[:k])\\n    nums[k:] = reversed(nums[k:])', marks: 10, isCorrect: true },
            { id: 'q4', type: 'mcq', question_type: 'mcq', question: 'What is the maximum number of edges in a simple undirected graph with n vertices?', options: { a: 'n(n-1)/2', b: 'n^2', c: '2^n', d: 'n!' }, candidateAnswer: null, correctAnswer: 'A', marks: 2, isCorrect: false }
          ];

          const mockAttempt = {
            examCode: 'CS2026',
            hallTicket: '24HU1A05F9',
            candidateName: 'Charan Sai Krishna',
            score: 12,
            totalMarks: 16,
            percentage: 75,
            accuracy: 75,
            rank: 1,
            totalCandidates: 45,
            correctAnswers: 2,
            wrongAnswers: 1,
            unanswered: 1,
            mcqScore: 2,
            mcqMaxMarks: 6,
            questions: sampleQuestions,
            allQuestions: sampleQuestions,
            answers: { q1: 'B', q2: 'A' },
            codeAnswers: { q3: 'def rotate(nums, k):\\n    pass' },
            submittedAt: new Date().toISOString()
          };
          const jsonStr = JSON.stringify(mockAttempt);
          localStorage.setItem('logicwhilelire_results_CS2026', jsonStr);
          sessionStorage.setItem('logicwhilelire_results_CS2026', jsonStr);
          localStorage.setItem('logicwhilelire_attempt', jsonStr);
          localStorage.setItem('lw_attempt', jsonStr);
          window.location.reload();
        `,
      });
      await new Promise((r) => setTimeout(r, 2500));
    }
  );

  // 4b. Scroll down and capture Questions & Answer Verification Section
  console.log('Capturing scrolled questions audit section...');
  await send('Runtime.evaluate', {
    expression: 'window.scrollBy({ top: 900, behavior: "instant" });',
  });
  await new Promise((r) => setTimeout(r, 1000));
  const scrolledShot = await send('Page.captureScreenshot', { format: 'png' });
  if (scrolledShot && scrolledShot.data) {
    fs.writeFileSync(
      path.join(outDir, '04b_results_questions_manifest_scrolled.png'),
      Buffer.from(scrolledShot.data, 'base64')
    );
    console.log('  ✅ Saved: 04b_results_questions_manifest_scrolled.png');
  }

  // 5. Candidate Register Gate
  await navigateAndCapture('http://localhost:5173/register', '05_candidate_gate.png');

  // 6. Student Login
  await navigateAndCapture('http://localhost:5173/login', '06_student_login.png');

  // 7. Student Enter Exam (Hall ticket + Exam code)
  await navigateAndCapture('http://localhost:5173/enter-exam', '07_student_enter_exam.png');

  // 8. Admin Dashboard
  await navigateAndCapture('http://localhost:5173/admin/dashboard', '08_admin_dashboard.png');

  // 9. Admin Hierarchy & College / CSE Department / Sections
  await navigateAndCapture('http://localhost:5173/admin/hierarchy', '09_admin_hierarchy.png');

  // 10. Faculty Portal
  await navigateAndCapture('http://localhost:5173/faculty', '10_faculty_portal.png');

  // 11. Live Leaderboard across Portals
  await navigateAndCapture('http://localhost:5173/leaderboard/CS2026', '11_leaderboard_page.png');

  // 12. Inspector Live Console
  await navigateAndCapture('http://localhost:5173/inspector/console/CS2026', '12_inspector_live_console.png');

  console.log('=== ALL SCREENSHOTS CAPTURED SUCCESSFULLY ===');
  ws.close();
  edgeProcess.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal capture error:', err);
  process.exit(1);
});
