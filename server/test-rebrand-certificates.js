/**
 * test-rebrand-certificates.js — Dual-Prefix Certificate & QR Verification Test Suite
 *
 * PHASE R Condition 4:
 * "Certificates and QR verification: existing LW- certificate codes and
 *  hall-ticket hashes must keep verifying forever. Add a test that
 *  verifies a legacy LW- certificate and a new GR- certificate."
 */

const http = require('http');
const assert = require('assert');

const BASE_URL = process.env.API_URL || 'http://localhost:3001';

function request(method, path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const req = http.request(url, { method }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('📜 GROWTHRAN — DUAL-PREFIX CERTIFICATE VERIFICATION SUITE');
  console.log('Target:', BASE_URL);
  console.log('================================================================\n');

  // Test 1: Verify legacy LW- certificate code
  console.log('[1/4] Verifying legacy LW- certificate code (e.g. LW-CERT-8F29A4D1)...');
  const legacyRes = await request('GET', '/api/certificate/verify/LW-CERT-8F29A4D1');
  assert.strictEqual(legacyRes.status, 200, 'Legacy cert request should return 200');
  assert.strictEqual(legacyRes.body.valid, true, 'Legacy certificate must be valid: true');
  assert.ok(legacyRes.body.certificate.certificate_id.startsWith('LW-'), 'Legacy certificate ID must retain LW- prefix');
  assert.ok(legacyRes.body.certificate.crypto_hash, 'Must include cryptographic hash');
  assert.strictEqual(legacyRes.body.certificate.issuer, 'GROWTHRAN Examination Board & Quality Council');
  assert.strictEqual(legacyRes.body.certificate.developer_credit, 'Developed by R. Charan Sai');
  console.log('  ✅ Legacy LW- certificate successfully verified: ' + legacyRes.body.certificate.certificate_id);

  // Test 2: Verify new GR- certificate code
  console.log('\n[2/4] Verifying new GR- certificate code (e.g. GR-CERT-9B31E7C4)...');
  const newRes = await request('GET', '/api/certificate/verify/GR-CERT-9B31E7C4');
  assert.strictEqual(newRes.status, 200, 'New GR cert request should return 200');
  assert.strictEqual(newRes.body.valid, true, 'New certificate must be valid: true');
  assert.ok(newRes.body.certificate.certificate_id.startsWith('GR-'), 'New certificate ID must have GR- prefix');
  assert.ok(newRes.body.certificate.crypto_hash, 'Must include cryptographic hash');
  assert.strictEqual(newRes.body.certificate.issuer, 'GROWTHRAN Examination Board & Quality Council');
  assert.strictEqual(newRes.body.certificate.developer_credit, 'Developed by R. Charan Sai');
  console.log('  ✅ New GR- certificate successfully verified: ' + newRes.body.certificate.certificate_id);

  // Test 3: Verify candidate hall-ticket legacy token
  console.log('\n[3/4] Verifying candidate hall-ticket legacy token (LW-2201A0501)...');
  const htLegacy = await request('GET', '/api/certificate/verify/LW-2201A0501');
  assert.strictEqual(htLegacy.status, 200);
  assert.strictEqual(htLegacy.body.valid, true);
  assert.ok(htLegacy.body.certificate.certificate_id.startsWith('LW-'));
  console.log('  ✅ Candidate legacy hall ticket token verified with LW- certificate: ' + htLegacy.body.certificate.certificate_id);

  // Test 4: Verify candidate hall-ticket new token
  console.log('\n[4/4] Verifying candidate hall-ticket new token (GR-2201A0501)...');
  const htNew = await request('GET', '/api/certificate/verify/GR-2201A0501');
  assert.strictEqual(htNew.status, 200);
  assert.strictEqual(htNew.body.valid, true);
  assert.ok(htNew.body.certificate.certificate_id.startsWith('GR-'));
  console.log('  ✅ Candidate new hall ticket token verified with GR- certificate: ' + htNew.body.certificate.certificate_id);

  console.log('\n================================================================');
  console.log('🎉 ALL 4 DUAL-PREFIX CERTIFICATE TESTS PASSED CLEANLY!');
  console.log('   Legacy LW- certificates verify forever: CONFIRMED');
  console.log('   New GR- certificates fully operational: CONFIRMED');
  console.log('================================================================\n');
}

runTests().catch(err => {
  console.error('❌ Certificate test failed:', err);
  process.exit(1);
});
