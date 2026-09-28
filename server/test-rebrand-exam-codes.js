/**
 * test-rebrand-exam-codes.js
 * PHASE R: Verify dual-prefix exam code validation (GR- and LW-)
 */
const assert = require('assert');
const { generateExamCode, isValidExamCodeFormat } = require('./dist/controllers/examCodeController');

console.log('================================================================');
console.log('🔑 GROWTHRAN — EXAM CODE SYSTEM DUAL-PREFIX TEST SUITE');
console.log('================================================================\n');

// Test 1: New codes generate with GR- prefix
console.log('[1/4] Testing generateExamCode generates GR- prefix...');
const newCode = generateExamCode('VRSEC');
console.log(`  Generated: ${newCode}`);
assert(newCode.startsWith('GR-VRSEC-'), 'New exam codes must start with GR-');
assert.strictEqual(newCode.length, 'GR-VRSEC-XXXXXX'.length);
console.log('  ✅ New exam code generated with GR- prefix.\n');

// Test 2: Validates new GR- format
console.log('[2/4] Testing validator accepts GR- format...');
assert.strictEqual(isValidExamCodeFormat('GR-VRSEC-8X9P2Q'), true, 'GR-VRSEC-8X9P2Q must be valid');
assert.strictEqual(isValidExamCodeFormat('GR-TECH-2026'), true, 'GR-TECH-2026 must be valid');
console.log('  ✅ Validator cleanly accepts GR- exam codes.\n');

// Test 3: Backward compatibility — validator MUST keep accepting existing LW- codes
console.log('[3/4] Testing validator continues accepting legacy LW- format...');
assert.strictEqual(isValidExamCodeFormat('LW-VRSEC-2026'), true, 'Legacy LW-VRSEC-2026 must be valid');
assert.strictEqual(isValidExamCodeFormat('LW-APCRT-2026'), true, 'Legacy LW-APCRT-2026 must be valid');
assert.strictEqual(isValidExamCodeFormat('LW-KLU-994422'), true, 'Legacy LW-KLU-994422 must be valid');
console.log('  ✅ Validator preserves 100% backward compatibility for legacy LW- codes.\n');

// Test 4: Reject malformed codes
console.log('[4/4] Testing malformed code rejection...');
assert.strictEqual(isValidExamCodeFormat(''), false, 'Empty string must be invalid');
assert.strictEqual(isValidExamCodeFormat('!@#$$%^'), false, 'Special symbols must be invalid');
console.log('  ✅ Malformed inputs rejected as expected.\n');

console.log('================================================================');
console.log('🎉 ALL EXAM CODE DUAL-PREFIX TESTS PASSED! (GR- & LW- ACTIVE)');
console.log('================================================================');
