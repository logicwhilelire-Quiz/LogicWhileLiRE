import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import WebSocket from 'ws';

async function testPage(url) {
  console.log('\n========================================');
  console.log(`TESTING URL: ${url}`);
  console.log('========================================');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9335;

  const edgeProcess = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--no-first-run',
    '--no-default-browser-check',
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
  const netFails = [];

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
    if (msg.method === 'Console.messageAdded') {
      const text = msg.params.message.text;
      logs.push(`[Console ${msg.params.message.level}] ${text}`);
      if (msg.params.message.level === 'error') {
        errors.push(`[Console Error] ${text}`);
      }
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const desc = msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text;
      errors.push(`[Runtime Exception] ${desc}`);
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const args = (msg.params.args || []).map(a => a.value || a.description || '').join(' ');
      logs.push(`[API ${msg.params.type}] ${args}`);
      if (msg.params.type === 'error') {
        errors.push(`[API Error] ${args}`);
      }
    }
    if (msg.method === 'Network.loadingFailed') {
      netFails.push(`[Net Fail] ${msg.params.errorText} on request ${msg.params.requestId}`);
    }
  });

  await send('Console.enable');
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');

  console.log('Navigating to', url);
  await send('Page.navigate', { url });

  // Wait 7 seconds for React to mount, fetch bundles, and render
  await new Promise(r => setTimeout(r, 7000));

  const bodyRes = await send('Runtime.evaluate', {
    expression: 'document.getElementById("root")?.innerHTML || document.body.innerHTML'
  });

  console.log('\n--- CONSOLE LOGS ---');
  logs.forEach(l => console.log(l));

  console.log('\n--- NETWORK FAILS ---');
  netFails.forEach(f => console.log(f));

  console.log('\n--- ERRORS DETECTED (' + errors.length + ') ---');
  errors.forEach(e => console.error(e));

  console.log('\n--- RENDERED HTML FIRST 400 CHARS ---');
  console.log((bodyRes?.result?.value || '').substring(0, 400));

  ws.close();
  edgeProcess.kill();
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
}

async function run() {
  await testPage('http://localhost:5173/enter-exam');
}

run().catch(console.error);
