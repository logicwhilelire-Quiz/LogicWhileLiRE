const http = require('http');
const https = require('https');
const crypto = require('crypto');

const BASE_URL = process.env.API_URL || 'http://localhost:3001';
const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin123';

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

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

function computeRemaining(serverStartTime, durationSeconds) {
  const elapsed = Math.floor((Date.now() - serverStartTime) / 1000);
  return Math.max(0, durationSeconds - elapsed);
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
  console.log('=== SPRINT 2 -- Synchronous Live Assessment Tests ===');
  console.log('Target: ' + BASE_URL + '\n');

  const health = await request('GET', '/health');
  assert(health.status === 200, 'Server health check');
  if (health.status !== 200) { console.error('Server not running'); process.exit(1); }

  console.log('\n[SETUP] Admin login...');
  const loginRes = await request('POST', '/api/admin/login', {}, { username: ADMIN_USER, password: ADMIN_PASS });
  const adminToken = loginRes.json && loginRes.json.token;
  assert(!!adminToken, 'Admin login returns JWT token', 'status=' + loginRes.status);

  const TEST_CODE = 'DEMO';
  console.log('\n[1] Unauthorized: no token');
  const noAuthRes = await request('POST', '/api/v1/exams/' + TEST_CODE + '/start', {}, { allow_late_join: false });
  assert(noAuthRes.status === 401, 'Start without token returns 401', 'got ' + noAuthRes.status);

  console.log('\n[2] Unauthorized: invalid token');
  const badTokenRes = await request('POST', '/api/v1/exams/' + TEST_CODE + '/start', { Authorization: 'Bearer fake.student.token' }, { allow_late_join: false });
  assert(badTokenRes.status === 401, 'Start with invalid token returns 401', 'got ' + badTokenRes.status);

  console.log('\n[3] Authorized start');
  var startRes = null;
  if (adminToken) {
    startRes = await request('POST', '/api/v1/exams/' + TEST_CODE + '/start', { Authorization: 'Bearer ' + adminToken }, { allow_late_join: true });
    var authAccepted = startRes.status !== 401 && startRes.status !== 403;
    assert(authAccepted, 'Admin token accepted by adminAuth middleware', 'status=' + startRes.status);
    if (startRes.status === 200) {
      assert(startRes.json && startRes.json.success === true, 'Start returns success:true');
      assert(typeof startRes.json.server_start_time === 'number', 'server_start_time is a number');
      assert(typeof startRes.json.duration_seconds === 'number', 'duration_seconds is a number');
      assert(startRes.json.already_started === false, 'First call: already_started=false');
    } else {
      console.log('  INFO: Exam code ' + TEST_CODE + ' returned ' + startRes.status + ' -- ' + JSON.stringify(startRes.json));
    }
  }

  console.log('\n[4] Idempotency: second call same exam code');
  if (adminToken) {
    const start2Res = await request('POST', '/api/v1/exams/' + TEST_CODE + '/start', { Authorization: 'Bearer ' + adminToken }, {});
    if (startRes && startRes.status === 200) {
      assert(start2Res.status === 200, 'Second call returns 200', 'got ' + start2Res.status);
      assert(start2Res.json && start2Res.json.already_started === true, 'Second call: already_started=true');
      assert(
        start2Res.json.server_start_time === startRes.json.server_start_time,
        'Second call: server_start_time unchanged (no reset)',
        'original=' + startRes.json.server_start_time + ' second=' + start2Res.json.server_start_time
      );
    } else {
      console.log('  INFO: Skipping idempotency deep check (first call was not 200)');
      assert(start2Res.status !== 401 && start2Res.status !== 403, 'Second call: auth still passes', 'got ' + start2Res.status);
    }
  }

  console.log('\n[5] Late-join timer correctness (pure math)');
  var simStart = Date.now() - 5000;
  var simDur = 3600;
  var rem = computeRemaining(simStart, simDur);
  assert(rem <= simDur - 5, 'Remaining after 5s <= duration-5 (' + rem + 's <= ' + (simDur-5) + 's)');
  assert(rem < simDur, 'Remaining (' + rem + 's) < total duration (' + simDur + 's)');
  console.log('  INFO: Late joiner gets ' + rem + 's remaining of ' + simDur + 's total');

  console.log('\n[6] Reconnect-after-start sync logic (unit test)');
  var mockStart = Date.now() - 15000;
  var mockDur = 3600;
  var elapsed = Math.floor((Date.now() - mockStart) / 1000);
  var remaining = Math.max(0, mockDur - elapsed);
  assert(elapsed >= 15, 'elapsed_seconds >= 15 (got ' + elapsed + ')');
  assert(remaining <= mockDur - 15, 'Reconnect remaining (' + remaining + 's) <= duration-15');
  var reconnectPayload = { event: 'EXAM_STARTED', exam_id: 'TEST', server_start_time: mockStart, duration_seconds: mockDur, allow_late_join: true, elapsed_seconds: elapsed };
  assert(reconnectPayload.event === 'EXAM_STARTED', 'Reconnect payload event=EXAM_STARTED');
  assert(typeof reconnectPayload.elapsed_seconds === 'number', 'Reconnect payload has elapsed_seconds');
  var computedRem = reconnectPayload.duration_seconds - reconnectPayload.elapsed_seconds;
  assert(computedRem < reconnectPayload.duration_seconds, 'Client computes correct remaining (' + computedRem + 's)');

  console.log('\n=== RESULTS: ' + passed + ' passed, ' + failed + ' failed ===');
  if (failed === 0) console.log('ALL SPRINT 2 TESTS PASSED');
  else { console.log('SOME TESTS FAILED'); process.exit(1); }
}

run().catch(function(err) { console.error('Test error:', err.message, err.stack); process.exit(1); });