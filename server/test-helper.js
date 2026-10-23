/**
 * test-helper.js
 * LogicWhileLiRE — Unified Test Environment & Database Cleanup Helper
 *
 * Supports two execution modes:
 * 1. Mock (Default): Fast, in-memory mock Supabase (no credentials needed).
 * 2. Real Supabase: When TEST_SUPABASE_URL and TEST_SUPABASE_SERVICE_KEY are present (DEMO_MODE=false).
 */
require('dotenv').config();

const testUrl = process.env.TEST_SUPABASE_URL || process.env.SUPABASE_URL || '';
const testKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || process.env.TEST_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const isRealSupabase = Boolean(
  testUrl &&
  !testUrl.includes('your-project') &&
  !testUrl.includes('actual-project') &&
  !testUrl.includes('placeholder') &&
  testKey &&
  !testKey.includes('your-service-role-key') &&
  !testKey.includes('real-service-key-xyz') &&
  process.env.TEST_MOCK_ONLY !== 'true'
);

function setupTestEnv() {
  if (isRealSupabase) {
    process.env.SUPABASE_URL = testUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = testKey;
    process.env.DEMO_MODE = 'false';
    console.log(`🔗 [Test Mode] Running against REAL Supabase at ${process.env.SUPABASE_URL}`);
  } else {
    process.env.DEMO_MODE = 'true';
    if (!process.env.SUPABASE_URL) {
      process.env.SUPABASE_URL = 'https://your-project.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'your-service-role-key';
    }
  }

  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-32chars-min-length-2026';
  process.env.ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'test-admin-jwt-secret-key-32chars-2026';
}

// Execute immediately when imported
setupTestEnv();

/**
 * Cleans up all test entities created during test execution
 */
async function cleanupTestData(supabase) {
  if (!isRealSupabase || !supabase) return;
  try {
    console.log('[Cleanup] 🧹 Purging test records from real Supabase...');

    // 1. Delete test attempts, results, and sessions
    await supabase.from('results').delete().ilike('exam_id', '%TEST%');
    await supabase.from('results').delete().ilike('exam_id', 'GR-VRSEC%');
    await supabase.from('results').delete().eq('exam_id', 'CS2026-FINAL');

    await supabase.from('exam_code_attempts').delete().ilike('exam_code', '%TEST%');
    await supabase.from('exam_code_attempts').delete().ilike('exam_code', 'GR-VRSEC%');
    await supabase.from('exam_code_attempts').delete().eq('exam_code', 'CS2026-FINAL');

    await supabase.from('questions_ec').delete().ilike('exam_code', '%TEST%');
    await supabase.from('questions_ec').delete().ilike('exam_code', 'GR-VRSEC%');
    await supabase.from('questions_ec').delete().eq('exam_code', 'CS2026-FINAL');

    await supabase.from('exam_codes').delete().ilike('exam_code', '%TEST%');
    await supabase.from('exam_codes').delete().ilike('exam_code', 'GR-VRSEC%');
    await supabase.from('exam_codes').delete().eq('exam_code', 'CS2026-FINAL');

    // 2. Delete test students and rosters
    await supabase.from('students').delete().ilike('email', '%@testcollege.edu');
    await supabase.from('students').delete().ilike('email', '%@campus.edu');
    await supabase.from('students').delete().ilike('email', '%@example.com');
    await supabase.from('students').delete().ilike('roll_number', 'TEST%');
    await supabase.from('students').delete().ilike('roll_number', 'HT2026%');
    await supabase.from('students').delete().eq('roll_number', '2201A0501');

    await supabase.from('student_roster').delete().ilike('roll_number', 'TEST%');
    await supabase.from('student_roster').delete().ilike('roll_number', 'HT2026%');
    await supabase.from('student_roster').delete().eq('roll_number', '2201A0501');

    // 3. Delete test staff
    await supabase.from('staff').delete().ilike('email', '%@testcollege.edu');
    await supabase.from('staff').delete().ilike('email', '%@othertest.edu');
    await supabase.from('staff').delete().ilike('email', 'super_audit_%');
    await supabase.from('staff').delete().ilike('email', '%test-staff%');

    // 4. Delete test hierarchy
    await supabase.from('batches').delete().ilike('name', '%Test%');
    await supabase.from('sections').delete().ilike('name', '%Test%');
    await supabase.from('cohorts').delete().ilike('name', '%Test%');
    await supabase.from('academic_years').delete().ilike('year', '%Test%');

    // 5. Delete test colleges
    await supabase.from('colleges').delete().ilike('college_code', '%TEST%');
    await supabase.from('colleges').delete().ilike('college_code', 'ATC%');
    await supabase.from('colleges').delete().ilike('college_name', '%Test%');

    // 6. Delete test email queue records
    await supabase.from('email_queue').delete().ilike('id', 'job_%');

    console.log('[Cleanup] ✅ Cleanup completed cleanly');
  } catch (err) {
    console.warn('[Cleanup] Non-fatal cleanup warning:', err?.message || err);
  }
}

module.exports = {
  isRealSupabase,
  setupTestEnv,
  cleanupTestData,
};
