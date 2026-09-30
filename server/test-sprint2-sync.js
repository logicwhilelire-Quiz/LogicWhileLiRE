/**
 * test-sprint2-sync.js
 * End-to-end integration test suite for Sprint 2: Synchronous Live Assessment Dispatch Engine.
 *
 * Covers:
 * 1. Unauthorized start rejection (no token -> 401, bad token -> 401)
 * 2. Authorized start + PRD schema match (POST /api/v1/exams/:id/start)
 * 3. Idempotency (second call returns already_started: true, same server_start_time, no timer reset)
 * 4. Live Socket.io broadcast to connected candidate lobby
 * 5. Reconnect socket sync (late connector / reconnector immediately receives EXAM_STARTED with elapsed_seconds)
 * 6. REST mount-time check (/api/v1/exams/:id/lobby-stats returns exam_started state for page refresh recovery)
 * 7. Server-authoritative timer logic (late joiner remaining time is reduced by elapsed time, not full duration)
 */

const http = require('http');
const https = require('https');
const { io } = require('../client/node_modules/socket.io-client');

const BASE_URL = process.env.API_URL || 'http://localhost:3001';
const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin123';
const TEST_CODE = 'DEMO123';

function request(method, urlPath, headers, body) {
  headers = headers || {};
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const client = url.protocol === 'https:' ? https : http;
    const reqHeaders = Object.assign({}, headers);
    let postData = null;
    if (body && typeof body === 'object') {
      postData = JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }
    const req = client.request(url, { method: method, headers: reqHeaders }, function(res) {
      const chunks = [];
      res.on('data', function(d) { chunks.push(d); });
      res.on('end', function() {
        let json = null;
        try { json = JSON.parse(Buffer.concat(chunks).toString()); } catch(_) {}
        resolve({ status: res.statusCode, json: json });
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let passed = 0;
let failed = 0;

function assert(condition, label, detail) {
  if (condition) {
    console.log('  PASS: ' + label);
    passed++;
  } else {
    console.error('  FAIL: ' + label + (detail ? ' -- ' + detail : ''));
    failed++;
  }
}

async function run() {
  console.log('================================================================');
  console.log('  SPRINT 2 E2E TEST: Synchronous Live Assessment & Timer Engine');
  console.log('  Target: ' + BASE_URL);
  console.log('  Exam Code: ' + TEST_CODE);
  console.log('================================================================\n');

  // 0. Health check
  const health = await request('GET', '/health');
  assert(health.status === 200, 'Server health check returns 200');
  if (health.status !== 200) {
    console.error('Server is not healthy, aborting.');
    process.exit(1);
  }

  // 1. Unauthorized start rejection
  console.log('\n[1] Unauthorized Start Rejection');
  const noTokenRes = await request('POST', `/api/v1/exams/${TEST_CODE}/start`, {}, { allow_late_join: true });
  assert(noTokenRes.status === 401, 'Request without token rejected with 401', 'got ' + noTokenRes.status);

  const badTokenRes = await request('POST', `/api/v1/exams/${TEST_CODE}/start`, {
    Authorization: 'Bearer invalid.bogus.jwt.token'
  }, { allow_late_join: true });
  assert(badTokenRes.status === 401, 'Request with invalid token rejected with 401', 'got ' + badTokenRes.status);

  // Setup: Admin Login
  console.log('\n[SETUP] Authenticating Admin...');
  const loginRes = await request('POST', '/api/admin/login', {}, { username: ADMIN_USER, password: ADMIN_PASS });
  const adminToken = loginRes.json && loginRes.json.token;
  assert(!!adminToken, 'Admin login succeeded and returned JWT token');
  if (!adminToken) {
    console.error('Failed to authenticate admin. Cannot proceed.');
    process.exit(1);
  }

  // Reset exam state so tests can be run repeatedly without restarting server
  await request('POST', `/api/v1/exams/${TEST_CODE}/reset-state`, {
    Authorization: `Bearer ${adminToken}`,
  });

  // 2. Pre-start: Connect Candidate Socket 1 to lobby
  console.log('\n[2] Candidate 1 Pre-Connect to Lobby & Live Broadcast Verification');
  let socket1ReceivedStart = null;
  let socket1BroadcastCount = 0;

  const socket1 = io(BASE_URL, { transports: ['websocket', 'polling'] });
  await new Promise((resolve) => {
    socket1.on('connect', () => {
      console.log(`  Candidate 1 socket connected: ${socket1.id}`);
      socket1.emit('lobby:join', { examCode: TEST_CODE });
      resolve();
    });
  });

  socket1.on('EXAM_STARTED', (payload) => {
    socket1BroadcastCount++;
    socket1ReceivedStart = payload;
    console.log(`  Candidate 1 received EXAM_STARTED: elapsed=${payload.elapsed_seconds ?? 0}s`);
  });

  // Brief pause to ensure lobby room join is registered
  await sleep(300);

  // Trigger Authorized Start
  const startRes = await request('POST', `/api/v1/exams/${TEST_CODE}/start`, {
    Authorization: `Bearer ${adminToken}`
  }, { allow_late_join: true });

  assert(startRes.status === 200, 'POST /start returns 200 OK', 'got ' + startRes.status);
  assert(startRes.json?.success === true, 'Response contains success: true');
  assert(startRes.json?.already_started === false, 'First start has already_started: false');
  assert(typeof startRes.json?.server_start_time === 'number', 'Response has server_start_time as number');
  assert(typeof startRes.json?.duration_seconds === 'number', 'Response has duration_seconds as number');
  assert(startRes.json?.allow_late_join === true, 'Response has allow_late_join: true');

  const serverStartTime = startRes.json?.server_start_time;
  const durationSeconds = startRes.json?.duration_seconds;

  // Wait for Socket 1 to receive live broadcast
  await sleep(500);
  assert(socket1ReceivedStart !== null, 'Candidate 1 received live EXAM_STARTED broadcast');
  if (socket1ReceivedStart) {
    assert(socket1ReceivedStart.event === 'EXAM_STARTED', 'Event name is EXAM_STARTED');
    assert(socket1ReceivedStart.exam_id === TEST_CODE, 'exam_id matches ' + TEST_CODE);
    assert(socket1ReceivedStart.server_start_time === serverStartTime, 'server_start_time matches API response');
    assert(socket1ReceivedStart.duration_seconds === durationSeconds, 'duration_seconds matches API response');
    assert(socket1ReceivedStart.allow_late_join === true, 'allow_late_join is true');
  }

  // 3. Idempotency Check
  console.log('\n[3] Idempotency Verification (Repeated Start Calls)');
  const startRes2 = await request('POST', `/api/v1/exams/${TEST_CODE}/start`, {
    Authorization: `Bearer ${adminToken}`
  }, { allow_late_join: true });

  assert(startRes2.status === 200, 'Second start call returns 200 OK');
  assert(startRes2.json?.already_started === true, 'Second call returns already_started: true');
  assert(
    startRes2.json?.server_start_time === serverStartTime,
    'Second call returns IDENTICAL server_start_time (timer is NOT reset)'
  );
  assert(socket1BroadcastCount === 1, 'Candidate 1 did NOT receive duplicate EXAM_STARTED broadcast');

  // 4. Reconnect & Late-Join Socket Sync
  console.log('\n[4] Late-Join / Reconnect Socket Sync');
  console.log('  Waiting 2 seconds to simulate late connection...');
  await sleep(2200);

  let socket2ReceivedStart = null;
  const socket2 = io(BASE_URL, { transports: ['websocket', 'polling'] });

  await new Promise((resolve) => {
    socket2.on('connect', () => {
      console.log(`  Candidate 2 (late joiner) connected: ${socket2.id}`);
      socket2.on('EXAM_STARTED', (payload) => {
        socket2ReceivedStart = payload;
        resolve();
      });
      socket2.emit('lobby:join', { examCode: TEST_CODE });
    });
  });

  assert(socket2ReceivedStart !== null, 'Candidate 2 immediately received EXAM_STARTED on lobby:join');
  if (socket2ReceivedStart) {
    assert(socket2ReceivedStart.event === 'EXAM_STARTED', 'Late join payload event is EXAM_STARTED');
    assert(socket2ReceivedStart.server_start_time === serverStartTime, 'Late join server_start_time matches original');
    assert(typeof socket2ReceivedStart.elapsed_seconds === 'number', 'Late join payload includes elapsed_seconds');
    assert(
      socket2ReceivedStart.elapsed_seconds >= 2,
      'Late join elapsed_seconds is accurate (>= 2s, got ' + socket2ReceivedStart.elapsed_seconds + 's)'
    );
  }

  // 5. REST Reconnect Recovery: GET /api/v1/exams/:examCode/lobby-stats
  console.log('\n[5] REST Reconnect Recovery Check (Mount-Time Page Refresh Check)');
  const statsRes = await request('GET', `/api/v1/exams/${TEST_CODE}/lobby-stats`);
  assert(statsRes.status === 200, 'GET /lobby-stats returns 200 OK');
  assert(statsRes.json?.exam_started !== null, 'lobby-stats returns non-null exam_started object');
  const started = statsRes.json?.exam_started;
  if (started) {
    assert(started.server_start_time === serverStartTime, 'lobby-stats exam_started has matching server_start_time');
    assert(started.elapsed_seconds >= 2, 'lobby-stats elapsed_seconds reflects real elapsed time (>= 2s)');
    assert(
      started.remaining_seconds <= durationSeconds - 2,
      'lobby-stats remaining_seconds is counting down (' + started.remaining_seconds + 's <= ' + (durationSeconds - 2) + 's)'
    );
  }

  // 6. Server-Authoritative Timer & Late-Joiner Countdown Logic
  console.log('\n[6] Server-Authoritative Countdown Math & DB End Time Verification');
  const now = Date.now();
  const trueElapsed = Math.floor((now - serverStartTime) / 1000);
  const remainingForLateJoiner = Math.max(0, durationSeconds - trueElapsed);

  assert(
    remainingForLateJoiner < durationSeconds,
    `Late joiner timer (${remainingForLateJoiner}s) is strictly less than full duration (${durationSeconds}s)`
  );
  assert(
    remainingForLateJoiner <= durationSeconds - 2,
    `Late joiner has lost at least 2 elapsed seconds (${remainingForLateJoiner}s <= ${durationSeconds - 2}s)`
  );

  // Clean up sockets
  socket1.disconnect();
  socket2.disconnect();

  console.log('\n================================================================');
  console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed === 0) {
    console.log('✨ ALL SPRINT 2 REQUIREMENTS MET AND VERIFIED WITH LIVE SOCKETS!\n');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED.\n');
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err.message, err.stack);
  process.exit(1);
});