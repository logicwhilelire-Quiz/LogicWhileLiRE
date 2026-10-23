import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import WebSocket from 'ws';

const targets = [
  { id: 'landing', path: '/', name: 'LandingPage' },
  { id: 'gate', path: '/register', name: 'CandidateRegisterGatePage' },
  { id: 'result', path: '/result-ec/DEMO123', name: 'ResultECPage' },
];

async function run() {
  console.log('=== CAPTURING POST-POLISH SCREENSHOTS (Landing, Gate, Results) ===');
  const outDir = path.resolve('../screenshots/after');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'after-polish-edge-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9340;

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

  await send('Page.enable');
  await send('Runtime.enable');

  for (const item of targets) {
    console.log(`\nCapturing ${item.name} (${item.path})...`);

    // 1. Desktop 1440x900
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    const fullUrl = `http://localhost:5173${item.path}`;
    await send('Page.navigate', { url: fullUrl });

    // Wait until content mounts
    for (let wait = 0; wait < 20; wait++) {
      await new Promise((r) => setTimeout(r, 200));
      const res = await send('Runtime.evaluate', {
        expression: `Boolean(document.querySelector('h1, h2, form, .page-content'))`,
        returnByValue: true
      });
      if (res?.result?.value) break;
    }
    await new Promise((r) => setTimeout(r, 1500));

    const shot1440 = await send('Page.captureScreenshot', { format: 'png' });
    if (shot1440?.data) {
      const p1440 = path.join(outDir, `${item.id}_1440.png`);
      fs.writeFileSync(p1440, Buffer.from(shot1440.data, 'base64'));
      console.log(`  Saved: ${p1440}`);
    }

    // 2. Mobile 375x812
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
      console.log(`  Saved: ${p375}`);
    }
  }

  ws.close();
  edgeProcess.kill();
  console.log('\n=== ALL POST-POLISH SCREENSHOTS CAPTURED SUCCESSFULLY ===');
}

run().catch((err) => {
  console.error('Error during capture:', err);
  process.exit(1);
});
