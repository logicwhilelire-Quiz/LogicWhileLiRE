/**
 * LogicWhile QUIZ — Bulk Enrollment Test Suite
 * Validates roster CSV generation, validation, duplicate handling, and faculty exam ownership guards.
 */

const http = require('http');

const BASE_URL = 'http://localhost:3001';
const DEMO_EXAM_1_ID = 'e1000000-0000-0000-0000-000000000001'; // Faculty 1's exam
const DEMO_EXAM_2_ID = 'e2000000-0000-0000-0000-000000000002'; // Faculty 2's exam

function request(path, options = {}, body = null, isMultipart = false) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = http.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json || data,
        });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

function buildMultipartFormData(boundary, fieldName, filename, fileContent, contentType = 'text/csv') {
  return Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`),
    Buffer.from(fileContent),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
}

async function runTests() {
  console.log('================================================================');
  console.log('📋 LogicWhile QUIZ — BULK ENROLLMENT TEST SUITE');
  console.log('Target:', BASE_URL);
  console.log('================================================================\n');

  try {
    // 1. Authenticate Super Admin and Faculty 1
    console.log('[1/6] Authenticating Super Admin & Faculty 1...');
    const adminLoginRes = await request('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, JSON.stringify({ username: 'admin', password: 'admin123' }));

    if (adminLoginRes.status !== 200 || !adminLoginRes.data.token) {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLoginRes.data)}`);
    }
    const adminToken = adminLoginRes.data.token;

    const facultyLoginRes = await request('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, JSON.stringify({ username: 'suresh@logicwhile.com', password: 'admin123' }));

    if (facultyLoginRes.status !== 200 || !facultyLoginRes.data.token) {
      throw new Error(`Faculty login failed: ${JSON.stringify(facultyLoginRes.data)}`);
    }
    const faculty1Token = facultyLoginRes.data.token;
    console.log('  ✅ Admin and Faculty 1 authenticated successfully\n');

    // 2. Download sample CSV roster template
    console.log('[2/6] Testing CSV Template Download (GET /api/admin/bulk-enroll/template)...');
    const templateRes = await request('/api/admin/bulk-enroll/template', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (templateRes.status !== 200) {
      throw new Error(`Template download failed with status ${templateRes.status}`);
    }
    if (!templateRes.data.includes('Full Name') || !templateRes.data.includes('Hall Ticket')) {
      throw new Error(`Template missing expected headers: ${templateRes.data}`);
    }
    console.log('  ✅ CSV template verified with standard candidate columns\n');

    // 3. Upload valid candidate roster via Super Admin
    console.log('[3/6] Testing Valid Roster Upload (Super Admin)...');
    const runId = Date.now().toString().slice(-6);
    const validCsv = [
      'Full Name,Hall Ticket,Mobile Number,Email Address',
      `Kavya Rao,LW2026-B01-${runId},9848012345,kavya.${runId}@example.com`,
      `Manish Verma,LW2026-B02-${runId},9848012346,manish.${runId}@example.com`,
      `Deepa Nair,LW2026-B03-${runId},9848012347,deepa.${runId}@example.com`,
    ].join('\r\n');

    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const multipartBody = buildMultipartFormData(boundary, 'file', 'roster.csv', validCsv);

    const uploadRes = await request(`/api/admin/exams/${DEMO_EXAM_1_ID}/bulk-enroll`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
    }, multipartBody);

    if (uploadRes.status !== 200 || !uploadRes.data.success) {
      throw new Error(`Upload failed (${uploadRes.status}): ${JSON.stringify(uploadRes.data)}`);
    }
    if (uploadRes.data.inserted_count !== 3) {
      throw new Error(`Expected 3 enrolled candidates, got ${uploadRes.data.inserted_count}`);
    }
    console.log(`  ✅ Successfully bulk enrolled ${uploadRes.data.inserted_count} candidates into Exam 1\n`);

    // 4. Duplicate prevention test: re-uploading the same roster
    console.log('[4/6] Testing Duplicate Re-enrollment Handling...');
    const dupRes = await request(`/api/admin/exams/${DEMO_EXAM_1_ID}/bulk-enroll`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
    }, multipartBody);

    if (dupRes.status !== 200 || !dupRes.data.success) {
      throw new Error(`Duplicate handling failed: ${JSON.stringify(dupRes.data)}`);
    }
    if (dupRes.data.inserted_count !== 0 || dupRes.data.skipped_count !== 3) {
      throw new Error(`Expected 0 inserted and 3 skipped, got inserted=${dupRes.data.inserted_count}, skipped=${dupRes.data.skipped_count}`);
    }
    console.log(`  ✅ Duplicates correctly detected and skipped (0 inserted, ${dupRes.data.skipped_count} skipped)\n`);

    // 5. Validation rejection test: malformed email and short hall ticket
    console.log('[5/6] Testing Validation Error Reporting on Malformed CSV...');
    const invalidCsv = [
      'Full Name,Hall Ticket,Mobile Number,Email Address',
      'X,1,not-a-phone,bad-email',
    ].join('\r\n');

    const invalidBody = buildMultipartFormData(boundary, 'file', 'invalid.csv', invalidCsv);
    const invalidRes = await request(`/api/admin/exams/${DEMO_EXAM_1_ID}/bulk-enroll`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
    }, invalidBody);

    if (invalidRes.status !== 400 || invalidRes.data.success) {
      throw new Error(`Expected status 400 for invalid data, got ${invalidRes.status}`);
    }
    console.log(`  ✅ Validation error rejected cleanly (status 400) with row-level error details\n`);

    // 6. Cross-faculty ownership guard: Faculty 1 cannot bulk-enroll into Faculty 2's Exam
    console.log('[6/6] Testing Faculty Ownership Guard on Bulk Enrollment (Faculty 1 -> Exam 2)...');
    const facultyCrossRes = await request(`/api/admin/exams/${DEMO_EXAM_2_ID}/bulk-enroll`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${faculty1Token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
    }, multipartBody);

    if (facultyCrossRes.status !== 403) {
      throw new Error(`Expected status 403 Forbidden for cross-faculty enrollment, got ${facultyCrossRes.status}`);
    }
    console.log('  ✅ 403 Forbidden correctly returned when Faculty 1 attempts bulk-enrollment on Exam 2\n');

    console.log('================================================================');
    console.log('🎉 ALL BULK ENROLLMENT TESTS PASSED CLEANLY! 🎉');
    console.log('================================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ BULK ENROLLMENT TEST FAILED:', err.message);
    process.exit(1);
  }
}

runTests();
