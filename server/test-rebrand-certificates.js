/**
 * test-rebrand-certificates.js — Retired Certificate Route & Discontinuation Test Suite
 *
 * PHASE C Specification (Master Prompt Section 4):
 * "C4. Retired URL: the old public verification URL must not 404 or crash.
 *      Serve one simple branded static page: 'Certificate verification has been retired.'
 *      with a link home, because certificates issued earlier may carry printed QR codes.
 *  C6. Tests: delete or rewrite certificate tests so the total is accurate,
 *      and add a test that the retired URL returns the static page with HTTP 200
 *      and that no certificate route exists elsewhere."
 */

const http = require('http');
const assert = require('assert');

const BASE_URL = process.env.API_URL || 'http://localhost:3001';

function request(method, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data), raw: data });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('📜 GROWTHRAN — PHASE C: CERTIFICATE RETIREMENT & INTEGRITY SUITE');
  console.log('Target:', BASE_URL);
  console.log('================================================================\n');

  // Test 1: Verify legacy LW- token returns 200 with retired status (JSON)
  console.log('[1/4] Verifying legacy LW- token returns HTTP 200 with retired notification...');
  const legacyRes = await request('GET', '/api/certificate/verify/LW-CERT-8F29A4D1', { 'Accept': 'application/json' });
  assert.strictEqual(legacyRes.status, 200, 'Legacy cert URL must return HTTP 200');
  assert.strictEqual(legacyRes.body.retired, true, 'Response must confirm retirement: retired === true');
  assert.strictEqual(legacyRes.body.valid, false, 'Retired certificate must have valid === false');
  assert.ok(legacyRes.body.message.includes('retired'), 'Message must inform user of retirement');
  console.log('  ✅ Legacy LW- token cleanly returns HTTP 200 retirement payload: ' + legacyRes.body.message);

  // Test 2: Verify new GR- token returns 200 with retired status (JSON)
  console.log('\n[2/4] Verifying new GR- token returns HTTP 200 with retired notification...');
  const newRes = await request('GET', '/api/certificate/verify/GR-CERT-9B31E7C4', { 'Accept': 'application/json' });
  assert.strictEqual(newRes.status, 200, 'GR cert URL must return HTTP 200');
  assert.strictEqual(newRes.body.retired, true, 'Response must confirm retirement');
  assert.strictEqual(newRes.body.valid, false, 'Certificate validation is discontinued');
  console.log('  ✅ New GR- token cleanly returns HTTP 200 retirement payload: ' + newRes.body.message);

  // Test 3: Verify Browser / HTML request returns static retired notice with HTTP 200
  console.log('\n[3/4] Verifying Browser (HTML) request serves static retirement page with HTTP 200...');
  const htmlRes = await request('GET', '/api/certificate/verify/GR-2201A0501', { 'Accept': 'text/html,application/xhtml+xml' });
  assert.strictEqual(htmlRes.status, 200, 'Browser request must return HTTP 200');
  assert.ok(htmlRes.raw.includes('Certificate verification has been retired.'), 'Static HTML must display retirement headline');
  assert.ok(htmlRes.raw.includes('Return to Home'), 'Static HTML must offer a link back home');
  console.log('  ✅ Static retirement page served successfully (HTTP 200) with home link');

  // Test 4: Verify obsolete certificate routes do NOT exist elsewhere (HTTP 404)
  console.log('\n[4/4] Verifying no other certificate issuing/management routes exist (HTTP 404)...');
  const issueRes = await request('POST', '/api/certificate/issue');
  assert.strictEqual(issueRes.status, 404, 'POST /api/certificate/issue must return 404');
  const manageRes = await request('GET', '/api/certificates');
  assert.strictEqual(manageRes.status, 404, 'GET /api/certificates must return 404');
  console.log('  ✅ No certificate creation or issuing routes exist on server (404 confirmed)');

  console.log('\n================================================================');
  console.log('🎉 ALL 4 CERTIFICATE RETIREMENT SPECIFICATION TESTS PASSED!');
  console.log('   Retired URL never 404s/crashes: CONFIRMED (HTTP 200 static page)');
  console.log('   No active certificate routes exist elsewhere: CONFIRMED');
  console.log('================================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ Certificate retirement test suite failed:');
  console.error(err);
  process.exit(1);
});
