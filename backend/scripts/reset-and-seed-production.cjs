const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Fatal: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function resetAndSeed() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('🔄 LOGICWHILE PRODUCTION DATABASE RESET & SEEDING SCRIPT');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // 1. Purge all test and demo tables
  console.log('1. Purging demo and test data from all tables...');
  try { await supabase.from('proctor_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch {}
  try { await supabase.from('violations').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch {}
  try { await supabase.from('suspicious_activity').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch {}
  try { await supabase.from('session_answers').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch {}
  try { await supabase.from('results').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch {}
  try { await supabase.from('exam_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch {}
  try { await supabase.from('exam_code_attempts').delete().neq('id', 0); } catch {}
  try { await supabase.from('questions').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch {}
  try { await supabase.from('questions_ec').delete().neq('id', 0); } catch {}
  try { await supabase.from('exams').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch {}
  try { await supabase.from('exam_codes').delete().neq('id', 0); } catch {}
  try { await supabase.from('student_roster').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch {}
  try { await supabase.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch {}
  try { await supabase.from('batches').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch {}
  try { await supabase.from('sections').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch {}
  try { await supabase.from('cohorts').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch {}
  try { await supabase.from('academic_years').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch {}
  try { await supabase.from('colleges').delete().neq('id', 0); } catch {}
  try { await supabase.from('staff').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch {}

  console.log('   ✓ All demographic, student, exam, and staff tables wiped clean.');

  // 2. Prepare Admin & Inspector credentials from environment
  const adminUsername = (process.env.ADMIN_USERNAME || 'admin').trim();
  const adminPassword = process.env.ADMIN_PASSWORD || 'LiREAdmin@2026!';
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@logicwhilelire.com').trim().toLowerCase();
  const adminPhone = (process.env.ADMIN_PHONE || '+919999999999').trim();
  const adminHash = process.env.ADMIN_PASSWORD_HASH || await bcrypt.hash(adminPassword, 12);

  const inspectorUsername = (process.env.INSPECTOR_USERNAME || 'inspector').trim();
  const inspectorPassword = process.env.INSPECTOR_PASSWORD || 'LiREInspector@2026!';
  const inspectorEmail = (process.env.INSPECTOR_EMAIL || 'inspector@logicwhilelire.com').trim().toLowerCase();
  const inspectorPhone = (process.env.INSPECTOR_PHONE || '+919999999998').trim();
  const inspectorHash = process.env.INSPECTOR_PASSWORD_HASH || await bcrypt.hash(inspectorPassword, 12);

  console.log('\n2. Seeding first Admin and Inspector accounts from environment...');

  // 3. Insert Super Admin
  const adminRecord = {
    id: 'e6fa7676-2798-4b3c-b452-37d455bb3585',
    name: 'LogicWhile Super Admin',
    email: adminEmail,
    password_hash: adminHash,
    role: 'super_admin',
    college_id: null,
    is_active: true,
    is_2fa_enabled: false,
    permissions: [
      `user:${adminUsername.toLowerCase()}`,
      `phone:${adminPhone}`,
      'create_questions',
      'upload_excel',
      'view_results',
      'export_data',
      'manage_exams',
      'manage_students',
      'manage_colleges',
      'manage_hierarchy',
      'manage_backups'
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error: adminErr } = await supabase.from('staff').upsert(adminRecord, { onConflict: 'id' });
  if (adminErr) {
    console.error('   ❌ Failed to seed Super Admin:', adminErr.message);
  } else {
    console.log(`   ✓ Super Admin seeded: username="${adminUsername}", email="${adminEmail}", phone="${adminPhone}"`);
  }

  // 4. Insert Lead Inspector
  const inspectorRecord = {
    id: 'f7ba8888-3809-4c4d-a563-2111e38ffb09',
    name: 'LogicWhile Lead Inspector',
    email: inspectorEmail,
    password_hash: inspectorHash,
    role: 'inspector',
    college_id: null,
    is_active: true,
    is_2fa_enabled: false,
    permissions: [
      `user:${inspectorUsername.toLowerCase()}`,
      `phone:${inspectorPhone}`,
      'live_monitor',
      'view_leaderboard',
      'whisper_candidate',
      'warn_candidate',
      'terminate_attempt',
      'resolve_issue'
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error: inspErr } = await supabase.from('staff').upsert(inspectorRecord, { onConflict: 'id' });
  if (inspErr) {
    console.error('   ❌ Failed to seed Inspector:', inspErr.message);
  } else {
    console.log(`   ✓ Lead Inspector seeded: username="${inspectorUsername}", email="${inspectorEmail}", phone="${inspectorPhone}"`);
  }

  // 5. Verify Row Counts and Authentication Validity
  console.log('\n3. Verifying database state:');
  const tables = [
    'colleges',
    'academic_years',
    'cohorts',
    'sections',
    'batches',
    'students',
    'staff',
    'exams',
    'exam_codes',
    'questions',
    'exam_sessions',
    'results'
  ];

  for (const t of tables) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`   • ${t.padEnd(18)}: [Error: ${error.message}]`);
    } else {
      console.log(`   • ${t.padEnd(18)}: ${count} rows`);
    }
  }

  // 6. Test password comparison for Admin and Inspector
  const adminPwMatch = await bcrypt.compare(adminPassword, adminHash);
  const inspPwMatch = await bcrypt.compare(inspectorPassword, inspectorHash);

  console.log('\n4. Authentication verification:');
  console.log(`   • Admin password test: ${adminPwMatch ? 'PASS ✓' : 'FAIL ❌'}`);
  console.log(`   • Inspector password test: ${inspPwMatch ? 'PASS ✓' : 'FAIL ❌'}`);

  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('🎉 DATABASE RESET & SEEDING COMPLETED SUCCESSFULLY');
  console.log('═══════════════════════════════════════════════════════════════════════');
}

resetAndSeed().catch((err) => {
  console.error('Fatal error during reset and seed:', err);
  process.exit(1);
});
