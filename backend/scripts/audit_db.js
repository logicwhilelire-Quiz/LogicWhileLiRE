require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Connecting to Supabase at:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const tables = [
    'colleges',
    'academic_years',
    'batches',
    'cohorts',
    'sections',
    'students',
    'student_roster',
    'exams',
    'exam_codes',
    'questions',
    'questions_ec',
    'participants',
    'exam_sessions',
    'exam_code_attempts',
    'results',
    'leaderboard',
    'staff',
    'audit_log',
    'proctor_logs',
    'violations',
    'suspicious_activity',
    'email_queue',
    'platform_settings'
  ];

  console.log('=== SUPABASE DATABASE AUDIT ===');
  for (const t of tables) {
    try {
      const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
      if (error) {
        console.log(`[TABLE] ${t}: ERROR -> ${error.message}`);
      } else {
        console.log(`[TABLE] ${t}: ${count} rows`);
      }
    } catch (e) {
      console.log(`[TABLE] ${t}: EXCEPTION -> ${e.message}`);
    }
  }
}

check().catch(console.error);
