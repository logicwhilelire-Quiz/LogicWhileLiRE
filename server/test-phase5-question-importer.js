/**
 * test-phase5-question-importer.js
 * Verification test for Phase 5: Question Bank and Excel Importer
 * Tests:
 * 1. Admin login & token acquisition
 * 2. GET /api/admin/questions/sample-template (2-sheet .xlsx generation, header checks)
 * 3. POST /api/admin/questions/validate-preview with valid mixed question paper (MCQ, Coding, Diagram, Aptitude)
 * 4. POST /api/admin/questions/validate-preview with invalid question rows (missing fields, bad MCQ options, bad coding test cases, bad diagram URL)
 * 5. POST /api/admin/questions/confirm-import (only valid saved, invalid reported)
 * 6. Question Bank multi-dimensional filtering (college, topic, difficulty, question_type)
 * 7. Question Bank full CRUD (Create, View, Update, Delete)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const XLSX = require('xlsx');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';

async function runTests() {
  console.log('====================================================');
  console.log('   PHASE 5: QUESTION BANK & EXCEL IMPORTER TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // Helper to extract cookies
  function getCookieHeader(response) {
    const raw = response.headers.get('set-cookie');
    if (!raw) return '';
    return raw.split(',').map((c) => c.split(';')[0]).join('; ');
  }

  try {
    // ----------------------------------------------------
    // TEST 1: Admin Authentication
    // ----------------------------------------------------
    console.log('--- TEST 1: Admin Login & Session Setup ---');
    const csrfRes = await fetch(`${BASE_URL}/api/csrf-token`);
    const csrfData = await csrfRes.json();
    const csrfCookie = getCookieHeader(csrfRes);

    const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfData.csrfToken,
        'Cookie': csrfCookie,
      },
      body: JSON.stringify({
        username: process.env.ADMIN_USERNAME || 'admin',
        password: process.env.ADMIN_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD || 'LiREAdmin@2026!',
      }),
    });

    const loginData = await loginRes.json();
    assert(loginRes.status === 200 && loginData.success, 'Admin authenticated successfully with Super Admin role');
    const adminToken = loginData.token;
    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
      'x-csrf-token': csrfData.csrfToken,
      'Cookie': `${csrfCookie}; ${getCookieHeader(loginRes)}`,
    };

    // ----------------------------------------------------
    // TEST 2: Download 2-Sheet Excel Sample Template (.xlsx)
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Download Sample Excel Template (.xlsx) ---');
    const templateRes = await fetch(`${BASE_URL}/api/admin/questions/sample-template`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    assert(templateRes.status === 200, 'GET /api/admin/questions/sample-template returns HTTP 200');
    const contentType = templateRes.headers.get('content-type') || '';
    assert(
      contentType.includes('spreadsheetml.sheet'),
      `Content-Type is openxmlformats spreadsheet (.xlsx): ${contentType}`
    );

    const templateArrayBuffer = await templateRes.arrayBuffer();
    const templateBuffer = Buffer.from(templateArrayBuffer);
    const wb = XLSX.read(templateBuffer, { type: 'buffer' });

    assert(wb.SheetNames.includes('Questions'), 'Workbook contains "Questions" master sheet');
    assert(wb.SheetNames.includes('Instructions'), 'Workbook contains "Instructions" guide sheet');

    const wsQuestions = wb.Sheets['Questions'];
    const sampleRows = XLSX.utils.sheet_to_json(wsQuestions);
    assert(sampleRows.length >= 4, `Sample template has ${sampleRows.length} demonstration rows across types`);

    const colKeys = Object.keys(sampleRows[0]);
    assert(
      colKeys.includes('Type') &&
      colKeys.includes('Question') &&
      colKeys.includes('Option A') &&
      colKeys.includes('Correct Answer') &&
      colKeys.includes('Diagram URL') &&
      colKeys.includes('Test Cases'),
      'Questions sheet contains all required columns: Type, Question, Options, Correct Answer, Diagram URL, Test Cases'
    );

    // ----------------------------------------------------
    // TEST 3: Validate & Preview with VALID Question Paper
    // ----------------------------------------------------
    console.log('\n--- TEST 3: Validate & Preview with Valid Questions ---');
    const validBatch = [
      {
        Type: 'MCQ',
        Question: 'What is the worst-case time complexity of searching in a Red-Black Tree with N nodes?',
        'Option A': 'O(1)',
        'Option B': 'O(log N)',
        'Option C': 'O(N)',
        'Option D': 'O(N log N)',
        'Correct Answer': 'B',
        Marks: 2,
        Penalty: 0.5,
        Topic: 'Data Structures',
        Difficulty: 'Medium',
      },
      {
        Type: 'Coding',
        Question: 'Write a function twoSum(nums, target) that returns the two indices summing to target.',
        'Correct Answer': 'def twoSum(nums, target): ...',
        Marks: 10,
        Penalty: 0,
        Topic: 'Algorithms',
        Difficulty: 'Easy',
        'Test Cases': JSON.stringify([
          { input: '[2, 7, 11, 15], 9', output: '[0, 1]' },
          { input: '[3, 2, 4], 6', output: '[1, 2]' },
        ]),
      },
      {
        Type: 'Diagram',
        Question: 'In the Kubernetes cluster architecture below, which component directs traffic to pods?',
        'Option A': 'Kube-proxy',
        'Option B': 'Kube-scheduler',
        'Option C': 'Etcd state store',
        'Option D': 'Kubelet daemon',
        'Correct Answer': 'A',
        Marks: 3,
        Penalty: 0.75,
        Topic: 'Cloud Architecture',
        Difficulty: 'Hard',
        'Diagram URL': 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800',
      },
      {
        Type: 'Aptitude',
        Question: 'If 8 workers build a wall in 10 hours, how many hours will 5 workers take at equal rate?',
        'Option A': '12 hours',
        'Option B': '14 hours',
        'Option C': '16 hours',
        'Option D': '18 hours',
        'Correct Answer': 'C',
        Marks: 2,
        Penalty: 0,
        Topic: 'Time and Work',
        Difficulty: 'Easy',
      },
    ];

    const validPreviewRes = await fetch(`${BASE_URL}/api/admin/questions/validate-preview`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ questions: validBatch }),
    });

    const validPreviewData = await validPreviewRes.json();
    assert(validPreviewRes.status === 200 && validPreviewData.success, 'Validation preview endpoint accepted payload');
    assert(validPreviewData.valid_count === 4, `All 4 rows verified valid (valid_count: ${validPreviewData.valid_count})`);
    assert(validPreviewData.invalid_count === 0, 'No invalid rows reported for valid batch');
    assert(validPreviewData.can_import === true, 'can_import flag is true');

    const previewTypes = validPreviewData.preview.map((p) => p.type);
    assert(
      previewTypes.includes('MCQ') &&
      previewTypes.includes('Coding') &&
      previewTypes.includes('Diagram') &&
      previewTypes.includes('Aptitude'),
      'Preview accurately classified MCQ, Coding, Diagram, and Aptitude types'
    );

    // ----------------------------------------------------
    // TEST 4: Validate & Preview with INVALID Question Rows
    // ----------------------------------------------------
    console.log('\n--- TEST 4: Validate & Preview with Invalid Rows & Clear Errors ---');
    const invalidBatch = [
      {
        // Missing Question text
        Type: 'MCQ',
        Question: '',
        'Option A': 'Opt A',
        'Option B': 'Opt B',
        'Option C': 'Opt C',
        'Option D': 'Opt D',
        'Correct Answer': 'A',
      },
      {
        // Missing Correct Answer
        Type: 'MCQ',
        Question: 'What is HTTP status 404?',
        'Option A': 'OK',
        'Option B': 'Not Found',
        'Option C': 'Error',
        'Option D': 'Timeout',
        'Correct Answer': '',
      },
      {
        // MCQ with missing Option D and invalid answer 'Z'
        Type: 'MCQ',
        Question: 'Which data structure uses LIFO ordering?',
        'Option A': 'Queue',
        'Option B': 'Stack',
        'Option C': 'Array',
        'Option D': '',
        'Correct Answer': 'Z',
      },
      {
        // Coding question with missing/invalid test cases
        Type: 'Coding',
        Question: 'Implement reverseLinkedList(head)',
        'Correct Answer': 'def reverseLinkedList...',
        'Test Cases': 'invalid-test-case-string-not-json-or-pairs',
      },
      {
        // Diagram question with missing Diagram URL
        Type: 'Diagram',
        Question: 'Identify the failing component in the diagram',
        'Option A': 'A',
        'Option B': 'B',
        'Option C': 'C',
        'Option D': 'D',
        'Correct Answer': 'A',
        'Diagram URL': '',
      },
    ];

    const invalidPreviewRes = await fetch(`${BASE_URL}/api/admin/questions/validate-preview`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ questions: invalidBatch }),
    });

    const invalidPreviewData = await invalidPreviewRes.json();
    assert(invalidPreviewRes.status === 200, 'Invalid batch validation handled gracefully');
    assert(
      invalidPreviewData.invalid_count === 5,
      `All 5 malformed rows flagged invalid (invalid_count: ${invalidPreviewData.invalid_count})`
    );
    assert(invalidPreviewData.valid_count === 0, 'valid_count is 0 for completely invalid batch');
    assert(invalidPreviewData.can_import === false, 'can_import is false when valid_count === 0');

    // Check specific error messages
    const row1Errors = invalidPreviewData.preview[0].errors.join(' ');
    assert(row1Errors.includes('Question text is required'), 'Row 1 flagged: Question text is required');

    const row2Errors = invalidPreviewData.preview[1].errors.join(' ');
    assert(row2Errors.includes('Correct Answer is required'), 'Row 2 flagged: Correct Answer is required');

    const row3Errors = invalidPreviewData.preview[2].errors.join(' ');
    assert(
      row3Errors.includes('Option D is required') && row3Errors.includes('must be A, B, C, or D'),
      'Row 3 flagged: Option D is required and Correct option must be A/B/C/D'
    );

    const row4Errors = invalidPreviewData.preview[3].errors.join(' ');
    assert(
      row4Errors.includes('Test cases must be a valid JSON array'),
      'Row 4 flagged: Coding test cases format error'
    );

    const row5Errors = invalidPreviewData.preview[4].errors.join(' ');
    assert(
      row5Errors.includes('Diagram URL is required'),
      'Row 5 flagged: Diagram URL required for Diagram question'
    );

    // ----------------------------------------------------
    // TEST 5: Confirm Import (Only Valid Saved, Invalid Skipped & Reported)
    // ----------------------------------------------------
    console.log('\n--- TEST 5: Confirm Import & Reporting of Skipped Rows ---');
    const mixedBatchForImport = [
      ...validPreviewData.preview.map((p) => ({ ...p, valid: true, errors: [] })),
      {
        row_number: 99,
        valid: false,
        type: 'MCQ',
        question: 'Bad row that should NOT be imported',
        errors: ['Corrupted test row'],
      },
    ];

    const confirmRes = await fetch(`${BASE_URL}/api/admin/questions/confirm-import`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        examCode: 'CS2026',
        questions: mixedBatchForImport,
      }),
    });

    const confirmData = await confirmRes.json();
    assert(confirmRes.status === 200 && confirmData.success, 'Confirm import executed successfully');
    assert(
      confirmData.imported_count === 4,
      `Exactly 4 valid questions imported (imported_count: ${confirmData.imported_count})`
    );
    assert(
      confirmData.invalid_count === 1 && confirmData.invalid_rows?.length === 1,
      'Invalid row skipped and reported back to admin in invalid_rows'
    );

    // ----------------------------------------------------
    // TEST 6: Question Bank Filtering (College, Topic, Difficulty, Type)
    // ----------------------------------------------------
    console.log('\n--- TEST 6: Question Bank Multi-Dimensional Filtering ---');

    // Filter by Question Type = coding
    const codingFilterRes = await fetch(`${BASE_URL}/api/admin/questions?question_type=coding`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });
    const codingFilterData = await codingFilterRes.json();
    assert(
      codingFilterRes.status === 200 && codingFilterData.questions.length > 0,
      `Filter question_type=coding returned ${codingFilterData.questions.length} questions`
    );
    assert(
      codingFilterData.questions.every((q) => q.question_type === 'coding' || q.question_type === 'code'),
      'All returned questions match type coding'
    );

    // Filter by Difficulty = Easy
    const diffFilterRes = await fetch(`${BASE_URL}/api/admin/questions?difficulty=Easy`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });
    const diffFilterData = await diffFilterRes.json();
    assert(
      diffFilterRes.status === 200 && diffFilterData.questions.length > 0,
      `Filter difficulty=Easy returned ${diffFilterData.questions.length} questions`
    );
    assert(
      diffFilterData.questions.every((q) => q.difficulty === 'Easy'),
      'All returned questions have difficulty Easy'
    );

    // Filter by College ID = 1 (VRSEC)
    const collegeFilterRes = await fetch(`${BASE_URL}/api/admin/questions?college_id=1`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });
    const collegeFilterData = await collegeFilterRes.json();
    assert(
      collegeFilterRes.status === 200 && collegeFilterData.questions.length > 0,
      `Filter college_id=1 returned ${collegeFilterData.questions.length} questions associated with VRSEC exams`
    );

    // ----------------------------------------------------
    // TEST 7: Question Bank Full CRUD (Create, View, Update, Delete)
    // ----------------------------------------------------
    console.log('\n--- TEST 7: Question Bank Full CRUD ---');

    // Create a Diagram Question
    const createRes = await fetch(`${BASE_URL}/api/admin/questions`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        exam_code: 'CS2026',
        question: 'CRUD TEST: Identify the active database cluster node from the diagram',
        question_type: 'diagram',
        diagram_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475',
        option_a: 'Leader Replica 01',
        option_b: 'Follower Read-Pool',
        option_c: 'Arbiter Node',
        option_d: 'Witness Sentry',
        correct_answer: 'A',
        marks: 5,
        penalty: 1,
        topic: 'Distributed Database Systems',
        difficulty: 'Hard',
      }),
    });

    const createData = await createRes.json();
    assert(createRes.status === 201 && createData.success, 'POST /api/admin/questions created question successfully');
    const createdId = createData.question.id;
    assert(Boolean(createdId), `Created question ID: ${createdId}`);

    // Read/View question
    const viewRes = await fetch(`${BASE_URL}/api/admin/questions?search=CRUD TEST`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });
    const viewData = await viewRes.json();
    const foundQuestion = viewData.questions.find((q) => q.id === createdId);
    assert(Boolean(foundQuestion), 'Found newly created question in listQuestions via search filter');
    assert(foundQuestion.diagram_url?.includes('518770660439'), 'Diagram URL preserved in question bank record');

    // Update question
    const updateRes = await fetch(`${BASE_URL}/api/admin/questions/${createdId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        marks: 8,
        difficulty: 'Medium',
        correct_answer: 'B',
      }),
    });
    const updateData = await updateRes.json();
    assert(updateRes.status === 200 && updateData.success, 'PATCH /api/admin/questions/:id updated marks and difficulty');
    assert(updateData.question.marks === 8, `Marks updated to 8 (was ${foundQuestion.marks})`);

    // Delete question
    const deleteRes = await fetch(`${BASE_URL}/api/admin/questions/${createdId}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    const deleteData = await deleteRes.json();
    assert(deleteRes.status === 200 && deleteData.success, 'DELETE /api/admin/questions/:id deleted question successfully');

    // Confirm deletion
    const verifyDelRes = await fetch(`${BASE_URL}/api/admin/questions?search=CRUD TEST`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });
    const verifyDelData = await verifyDelRes.json();
    assert(
      !verifyDelData.questions.some((q) => q.id === createdId),
      'Question successfully purged from database'
    );

    console.log('\n====================================================');
    console.log(`PHASE 5 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution failed with unexpected error:', err);
    process.exit(1);
  }
}

runTests();
