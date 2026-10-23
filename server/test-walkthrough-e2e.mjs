import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import WebSocket from 'ws';

async function runFullE2ETest() {
  console.log('=== STARTING COMPLETE E2E WALKTHROUGH VERIFICATION ===\n');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'walkthrough-test-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9336;

  const edgeProcess = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    'about:blank'
  ]);

  let target = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 200));
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json`);
      const list = await res.json();
      target = list.find(t => t.type === 'page');
      if (target) break;
    } catch {}
  }

  if (!target) {
    console.error('Could not connect to Edge debugger');
    edgeProcess.kill();
    return;
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  const errors = [];
  const logs = [];

  await new Promise(resolve => ws.on('open', resolve));

  let reqId = 1;
  const send = (method, params = {}) => {
    return new Promise(resolve => {
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

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.method === 'Console.messageAdded' && msg.params.message.level === 'error') {
      errors.push(`[Console Error] ${msg.params.message.text}`);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const desc = msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text;
      errors.push(`[Runtime Exception] ${desc}`);
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      const args = (msg.params.args || []).map(a => a.value || a.description || '').join(' ');
      errors.push(`[API Error] ${args}`);
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

  // --------------------------------------------------------------------------
  // PART 1: CANDIDATE EXAM WALKTHROUGH
  // --------------------------------------------------------------------------
  console.log('--- STEP 1: Candidate Exam Entry (/enter-exam) ---');
  await send('Page.navigate', { url: 'http://localhost:5173/enter-exam' });
  await new Promise(r => setTimeout(r, 3500));

  let html1 = await evalJs('document.body.innerHTML');
  let hasEnterForm = await evalJs('Boolean(document.getElementById("examCode") && document.getElementById("hallTicket"))');
  console.log(`✓ Enter Exam page rendered properly: ${hasEnterForm}`);

  console.log('--- STEP 2: Input DEMO123 and 2201A0501 ---');
  await evalJs(`
    const ec = document.getElementById("examCode");
    const ht = document.getElementById("hallTicket");
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    nativeInputValueSetter.call(ec, "DEMO123");
    ec.dispatchEvent(new Event("input", { bubbles: true }));
    nativeInputValueSetter.call(ht, "2201A0501");
    ht.dispatchEvent(new Event("input", { bubbles: true }));
  `);
  await new Promise(r => setTimeout(r, 600));

  // Submit form
  console.log('--- STEP 3: Submitting Exam Code Form ---');
  await evalJs(`
    const form = document.querySelector("form");
    if (form) form.requestSubmit();
  `);
  await new Promise(r => setTimeout(r, 3000));

  let currentUrl = await evalJs('window.location.href');
  console.log(`Navigated to: ${currentUrl}`);

  // We should be on /instructions/DEMO123
  if (currentUrl.includes('/instructions/DEMO123')) {
    console.log('✓ Successfully arrived at Instructions page!');

    // Wait or click skip
    await evalJs(`
      const skipBtn = document.getElementById("skip-instruction-wait-btn");
      if (skipBtn) skipBtn.click();
    `);
    await new Promise(r => setTimeout(r, 1000));

    // Click Start Exam button
    console.log('--- STEP 4: Clicking Start Exam ---');
    await evalJs(`
      const startBtn = document.getElementById("start-exam-now-btn");
      if (startBtn) startBtn.click();
    `);
    await new Promise(r => setTimeout(r, 3500));

    currentUrl = await evalJs('window.location.href');
    console.log(`Navigated to: ${currentUrl}`);

    // If proctoring consent modal is visible, click consent
    const consentBtnVisible = await evalJs('Boolean(document.getElementById("confirm-proctoring-consent-btn"))');
    console.log(`Proctoring Consent Modal visible: ${consentBtnVisible}`);
    if (consentBtnVisible) {
      await evalJs('document.getElementById("confirm-proctoring-consent-btn").click()');
      await new Promise(r => setTimeout(r, 2000));
    }

    // Verify Quiz page loaded questions
    const questionText = await evalJs('document.querySelector(".exam-question-text")?.innerText || document.querySelector("h3")?.innerText || ""');
    console.log(`✓ Quiz Question loaded: "${questionText.substring(0, 60)}..."`);

    // Verify face monitor is active
    const faceMonitorActive = await evalJs('Boolean(document.querySelector(".exam-face-monitor") || document.querySelector("video"))');
    console.log(`✓ Face Monitor / Camera active: ${faceMonitorActive}`);

    // Click an option (e.g. option 1)
    await evalJs(`
      const options = document.querySelectorAll(".exam-option-card, .quiz-option, button.option-btn");
      if (options.length > 0) options[0].click();
    `);
    await new Promise(r => setTimeout(r, 1000));

    // Submit the quiz
    console.log('--- STEP 5: Clicking Submit Quiz ---');
    await evalJs(`
      const openBtn = document.getElementById("open-submit-modal-btn");
      if (openBtn) openBtn.click();
    `);
    await new Promise(r => setTimeout(r, 1200));

    // Confirm submit in modal
    await evalJs(`
      const confirmBtn = document.getElementById("confirm-submit-exam-btn");
      if (confirmBtn) confirmBtn.click();
    `);
    await new Promise(r => setTimeout(r, 4500));

    currentUrl = await evalJs('window.location.href');
    console.log(`Navigated to: ${currentUrl}`);
    console.log(`✓ Arrived at Scorecard / Result page: ${currentUrl.includes('/result-ec/')}`);

    // Check Scorecard details
    const scorecardTitle = await evalJs('document.querySelector("h1, h2, h3")?.innerText || ""');
    console.log(`✓ Result Screen Header: "${scorecardTitle}"`);

    // Check Leaderboard Link / Podium
    const hasLeaderboard = await evalJs('Boolean(document.querySelector(".leaderboard-podium") || document.querySelector("a[href*=\'leaderboard\']"))');
    console.log(`✓ Leaderboard element / link present: ${hasLeaderboard}`);

    // Navigate to 3D Leaderboard
    console.log('--- STEP 5b: Navigating to 3D Leaderboard (/leaderboard-ec/DEMO123) ---');
    await send('Page.navigate', { url: 'http://localhost:5173/leaderboard-ec/DEMO123' });
    await new Promise(r => setTimeout(r, 3500));
    currentUrl = await evalJs('window.location.href');
    const lbTitle = await evalJs('document.querySelector("h1, h2, h3")?.innerText || ""');
    console.log(`✓ 3D Leaderboard URL: ${currentUrl} | Header: "${lbTitle}"`);
  } else {
    console.error(`Failed to navigate to instructions page, current URL: ${currentUrl}`);
  }

  // --------------------------------------------------------------------------
  // PART 2: ADMINISTRATOR & PROCTORING WALKTHROUGH
  // --------------------------------------------------------------------------
  console.log('\n--- STEP 6: Administrator Login (/admin/login) ---');
  await send('Page.navigate', { url: 'http://localhost:5173/admin/login' });
  await new Promise(r => setTimeout(r, 3000));

  const hasAdminForm = await evalJs('Boolean(document.getElementById("admin-username") && document.getElementById("admin-password"))');
  console.log(`✓ Admin Login form rendered: ${hasAdminForm}`);

  console.log('--- STEP 7: Entering admin / admin123 credentials ---');
  await evalJs(`
    const u = document.getElementById("admin-username");
    const p = document.getElementById("admin-password");
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    nativeSetter.call(u, "admin");
    u.dispatchEvent(new Event("input", { bubbles: true }));
    nativeSetter.call(p, "admin123");
    p.dispatchEvent(new Event("input", { bubbles: true }));
    const form = document.querySelector("form");
    if (form) form.requestSubmit();
  `);
  await new Promise(r => setTimeout(r, 3500));

  currentUrl = await evalJs('window.location.href');
  console.log(`Navigated after admin login to: ${currentUrl}`);
  console.log(`✓ Admin Dashboard loaded: ${currentUrl.includes('/admin/dashboard')}`);

  // Test Sessions page
  console.log('--- STEP 8: Accessing Sessions page (/admin/sessions) ---');
  await send('Page.navigate', { url: 'http://localhost:5173/admin/sessions' });
  await new Promise(r => setTimeout(r, 3000));
  currentUrl = await evalJs('window.location.href');
  let sessionsTitle = await evalJs('document.querySelector("h1, h2, h3")?.innerText || ""');
  console.log(`✓ Sessions page URL: ${currentUrl} | Header: "${sessionsTitle}"`);

  // Test Analytics page
  console.log('--- STEP 9: Accessing Analytics page (/admin/analytics) ---');
  await send('Page.navigate', { url: 'http://localhost:5173/admin/analytics' });
  await new Promise(r => setTimeout(r, 3000));
  currentUrl = await evalJs('window.location.href');
  let analyticsTitle = await evalJs('document.querySelector("h1, h2, h3")?.innerText || ""');
  console.log(`✓ Analytics page URL: ${currentUrl} | Header: "${analyticsTitle}"`);

  // Test Monitor / Proctoring Timeline
  console.log('--- STEP 10: Accessing Proctoring Timeline / Monitor (/admin/monitor) ---');
  await send('Page.navigate', { url: 'http://localhost:5173/admin/monitor' });
  await new Promise(r => setTimeout(r, 3000));
  currentUrl = await evalJs('window.location.href');
  let monitorTitle = await evalJs('document.querySelector("h1, h2, h3")?.innerText || ""');
  console.log(`✓ Live Monitor URL: ${currentUrl} | Header: "${monitorTitle}"`);

  console.log('\n--- TOTAL CONSOLE / RUNTIME ERRORS DETECTED ---');
  console.log(`Errors count: ${errors.length}`);
  errors.forEach(e => console.error(e));

  ws.close();
  edgeProcess.kill();
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}

  console.log('\n=== COMPLETE E2E WALKTHROUGH TEST FINISHED ===');
}

runFullE2ETest().catch(console.error);
