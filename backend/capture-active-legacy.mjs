import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import WebSocket from 'ws';

async function captureActiveLegacy() {
  const outDir = path.resolve('../screenshots/audit');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-edge-legacy-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9339;

  const edgeProcess = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--no-first-run',
    '--no-default-browser-check',
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

  const evalJs = async (expr) => {
    const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return res?.result?.value;
  };

  // Navigate to enroll page first
  await send('Page.navigate', { url: 'http://localhost:5173/enroll/e1000000-0000-0000-0000-000000000001' });
  await new Promise((r) => setTimeout(r, 2000));

  // 1. Fill enroll form and click Send OTP to arrive at OTPVerifyPage naturally
  await evalJs(`
    const n = document.getElementById("enroll-name");
    const h = document.getElementById("enroll-hall-ticket");
    const m = document.getElementById("enroll-mobile");
    const e = document.getElementById("enroll-email");
    const setVal = (el, v) => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    if (n && h && m && e) {
      setVal(n, "Audit Student");
      setVal(h, "HT_AUDIT_01");
      setVal(m, "9876543210");
      setVal(e, "audit.student@example.com");
      document.querySelector("form")?.requestSubmit();
    }
  `);

  await new Promise((r) => setTimeout(r, 3000));

  // Now we should be on /verify with real state
  const urlNow = await evalJs('window.location.href');
  console.log('Enrolled and navigated to:', urlNow);

  // Capture 1440px
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await new Promise((r) => setTimeout(r, 1000));
  let shot = await send('Page.captureScreenshot', { format: 'png' });
  if (shot?.data) {
    fs.writeFileSync(path.join(outDir, '15_otp_verify_1440.png'), Buffer.from(shot.data, 'base64'));
    console.log('Saved 15_otp_verify_1440.png (active)');
  }

  // Capture 375px
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await new Promise((r) => setTimeout(r, 1000));
  shot = await send('Page.captureScreenshot', { format: 'png' });
  if (shot?.data) {
    fs.writeFileSync(path.join(outDir, '15_otp_verify_375.png'), Buffer.from(shot.data, 'base64'));
    console.log('Saved 15_otp_verify_375.png (active)');
  }

  // 2. Submit OTP to transition to ExamPage
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await evalJs(`
    const form = document.querySelector("form");
    if (form) form.requestSubmit();
  `);
  await new Promise((r) => setTimeout(r, 3500));

  const examUrl = await evalJs('window.location.href');
  console.log('Submitted OTP, navigated to:', examUrl);

  shot = await send('Page.captureScreenshot', { format: 'png' });
  if (shot?.data) {
    fs.writeFileSync(path.join(outDir, '16_exam_legacy_1440.png'), Buffer.from(shot.data, 'base64'));
    console.log('Saved 16_exam_legacy_1440.png (active)');
  }

  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await new Promise((r) => setTimeout(r, 1000));
  shot = await send('Page.captureScreenshot', { format: 'png' });
  if (shot?.data) {
    fs.writeFileSync(path.join(outDir, '16_exam_legacy_375.png'), Buffer.from(shot.data, 'base64'));
    console.log('Saved 16_exam_legacy_375.png (active)');
  }

  ws.close();
  edgeProcess.kill();
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
}

captureActiveLegacy().catch(console.error);
