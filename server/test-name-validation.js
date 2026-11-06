const { candidateRegisterSchema } = require('./dist/middleware/validate');

console.log('═══════════════════════════════════════════════════════════════════════════════');
console.log('📝 NAME VALIDATION REGEX ENFORCEMENT AUDIT');
console.log('Allowed characters: Letters, spaces, dots, apostrophes, and hyphens only');
console.log('═══════════════════════════════════════════════════════════════════════════════\n');

const validNames = [
  'John',
  'Mary Jane',
  "O'Connor",
  'Anne-Marie',
  'Dr. R. C. Sai',
  'St. John-Smythe',
];

const invalidNames = [
  'TEST_User',
  'Student_01',
  'User123',
  'Jane#Doe',
  'User@Logic',
  'Name!Alert',
  'Test_Candidate',
];

console.log('TEST 1: Valid Names (Must pass validation):');
let validPassCount = 0;
for (const name of validNames) {
  const result = candidateRegisterSchema.safeParse({
    first_name: name,
    last_name: 'Candidate',
    college_id: 'col-1',
    year_of_passing: 2026,
    roll_number: '2201A0501',
    branch_code: 'CSE',
    section: 'A',
    contact_number: '9876543210',
    email: 'student@college.edu',
    password: 'Password@123',
  });
  if (result.success) {
    validPassCount++;
    console.log(`  ✓ "${name}" -> PASSED (Transformed: "${result.data.first_name}")`);
  } else {
    console.error(`  ❌ "${name}" -> FAILED:`, result.error.issues[0].message);
  }
}

console.log(`\nTEST 2: Invalid Names (Must be strictly rejected):`);
let invalidRejectCount = 0;
for (const name of invalidNames) {
  const result = candidateRegisterSchema.safeParse({
    first_name: name,
    last_name: 'Candidate',
    college_id: 'col-1',
    year_of_passing: 2026,
    roll_number: '2201A0501',
    branch_code: 'CSE',
    section: 'A',
    contact_number: '9876543210',
    email: 'student@college.edu',
    password: 'Password@123',
  });
  if (!result.success) {
    invalidRejectCount++;
    console.log(`  ✓ "${name}" -> REJECTED: ${result.error.issues[0].message}`);
  } else {
    console.error(`  ❌ "${name}" -> UNEXPECTED PASS`);
  }
}

console.log('\n═══════════════════════════════════════════════════════════════════════════════');
console.log(`RESULTS: Valid Passed: ${validPassCount}/${validNames.length} | Invalid Rejected: ${invalidRejectCount}/${invalidNames.length}`);
console.log('VERDICT: Name validation strictly enforced (/^[A-Za-z\\s.\'-]+$/).');
console.log('═══════════════════════════════════════════════════════════════════════════════');

if (validPassCount !== validNames.length || invalidRejectCount !== invalidNames.length) {
  process.exit(1);
}
