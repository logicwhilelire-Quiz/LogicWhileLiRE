/**
 * test-section-eligibility-rejection.js
 * Verification of strict section-eligibility matching in academicYear.ts
 *
 * Rules:
 * A student must match college + branch + year + section exactly.
 * Students from another college, branch, year, or section MUST be rejected.
 */

require('dotenv').config();
const assert = require('assert');
const { deriveStudyYear, isStudentEligibleForExam } = require('./dist/utils/academicYear');

async function runEligibilityTests() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🧪 VERIFYING ACADEMIC YEAR & SECTION ELIGIBILITY RULES');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  function testCase(description, fn) {
    try {
      fn();
      console.log(`  ✅ PASS: ${description}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${description}`);
      console.error(`     ${err.message}`);
      failed++;
    }
  }

  // Define target exam: College 101, Branch CSE, Passout 2026, Section A
  const targetExam = {
    college_id: '101',
    branch: 'CSE',
    passout_year: 2026,
    section_id: 'sec-101-cse-a',
    section_ids: ['sec-101-cse-a'],
  };

  // 1. Exact match
  testCase('1. Student matching college + branch + year + section exactly is ELIGIBLE', () => {
    const student = {
      college_id: '101',
      branch_code: 'CSE',
      year_of_passing: 2026,
      section: 'A',
      section_id: 'sec-101-cse-a',
    };
    const eligible = isStudentEligibleForExam(student, targetExam);
    assert.strictEqual(eligible, true, 'Student should be eligible');
  });

  // 2. Different College
  testCase('2. Student from ANOTHER COLLEGE (102 vs 101) is REJECTED', () => {
    const student = {
      college_id: '102',
      branch_code: 'CSE',
      year_of_passing: 2026,
      section: 'A',
      section_id: 'sec-101-cse-a',
    };
    const eligible = isStudentEligibleForExam(student, targetExam);
    assert.strictEqual(eligible, false, 'Student from different college must be rejected');
  });

  // 3. Different Section
  testCase('3. Student from ANOTHER SECTION (Section B vs Section A) is REJECTED', () => {
    const student = {
      college_id: '101',
      branch_code: 'CSE',
      year_of_passing: 2026,
      section: 'B',
      section_id: 'sec-101-cse-b',
    };
    const eligible = isStudentEligibleForExam(student, targetExam);
    assert.strictEqual(eligible, false, 'Student from different section must be rejected');
  });

  // 4. Different Section (Section C vs Section A)
  testCase('4. Student from ANOTHER SECTION (Section C vs Section A) is REJECTED', () => {
    const student = {
      college_id: '101',
      branch_code: 'CSE',
      year_of_passing: 2026,
      section: 'C',
      section_id: 'sec-101-cse-c',
    };
    const eligible = isStudentEligibleForExam(student, targetExam);
    assert.strictEqual(eligible, false, 'Student from different section must be rejected');
  });

  // 5. Different Branch
  testCase('5. Student from ANOTHER BRANCH (ECE vs CSE) is REJECTED', () => {
    const student = {
      college_id: '101',
      branch_code: 'ECE',
      year_of_passing: 2026,
      section: 'A',
      section_id: 'sec-101-cse-a',
    };
    const eligible = isStudentEligibleForExam(student, targetExam);
    assert.strictEqual(eligible, false, 'Student from different branch must be rejected');
  });

  // 6. Different Graduation Year
  testCase('6. Student from ANOTHER GRADUATION YEAR (2027 vs 2026) is REJECTED', () => {
    const student = {
      college_id: '101',
      branch_code: 'CSE',
      year_of_passing: 2027,
      section: 'A',
      section_id: 'sec-101-cse-a',
    };
    const eligible = isStudentEligibleForExam(student, targetExam);
    assert.strictEqual(eligible, false, 'Student from different year must be rejected');
  });

  // 7. Multi-section target (Targeting A & B, student in C)
  testCase('7. Exam targeting Sections A and B REJECTS student in Section C', () => {
    const multiExam = {
      college_id: '101',
      branch: 'CSE',
      passout_year: 2026,
      section_ids: ['sec-101-cse-a', 'sec-101-cse-b'],
    };
    const studentC = {
      college_id: '101',
      branch_code: 'CSE',
      year_of_passing: 2026,
      section: 'C',
      section_id: 'sec-101-cse-c',
    };
    const eligible = isStudentEligibleForExam(studentC, multiExam);
    assert.strictEqual(eligible, false, 'Student in section C must be rejected');
  });

  // 8. Multi-section target (Targeting A & B, student in A is ELIGIBLE)
  testCase('8. Exam targeting Sections A and B ALLOWS student in Section A', () => {
    const multiExam = {
      college_id: '101',
      branch: 'CSE',
      passout_year: 2026,
      section_ids: ['sec-101-cse-a', 'sec-101-cse-b'],
    };
    const studentA = {
      college_id: '101',
      branch_code: 'CSE',
      year_of_passing: 2026,
      section: 'A',
      section_id: 'sec-101-cse-a',
    };
    const eligible = isStudentEligibleForExam(studentA, multiExam);
    assert.strictEqual(eligible, true, 'Student in section A must be allowed');
  });

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('═══════════════════════════════════════════════════════════════════');

  if (failed > 0) process.exit(1);
}

runEligibilityTests().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
