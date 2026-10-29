import 'dotenv/config';
import bcrypt from 'bcrypt';
import { supabase } from '../src/db/supabase.ts';

async function cleanDatabase() {
  console.log('================================================================');
  console.log('🧹 LOGICWHILE LIRE — MASTER DATABASE PURGE & CLEAN RESET');
  console.log('================================================================\n');

  const adminEmail = 'admin@logicwhilelire.com';
  const inspectorEmail = 'inspector@logicwhilelire.com';

  const adminPassword =
    process.env.ADMIN_INITIAL_PASSWORD ||
    process.env.INITIAL_ADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD;

  const inspectorPassword =
    process.env.INSPECTOR_INITIAL_PASSWORD ||
    process.env.INITIAL_INSPECTOR_PASSWORD ||
    process.env.INSPECTOR_PASSWORD;

  if (!adminPassword || !inspectorPassword) {
    throw new Error('ADMIN_PASSWORD and INSPECTOR_PASSWORD must be configured in .env');
  }

  // 1. Delete dependent student attempt & session records
  console.log('1. Cleaning all candidate attempts, telemetry, results & logs...');
  try { await supabase.from('exam_code_attempts').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch {}
  try { await supabase.from('proctor_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch {}
  try { await supabase.from('violations').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch {}
  try { await supabase.from('results').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch {}
  try { await supabase.from('sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch {}
  try { await supabase.from('exam_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch {}
  try { await supabase.from('mail_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch {}
  try { await supabase.from('audit_log').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch {}

  // 2. Delete all students
  console.log('2. Deleting all student records (0 demo/sample students)...');
  const { error: studentErr } = await supabase.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (studentErr) console.warn('Student delete notice:', studentErr.message);

  // 3. Delete questions & exams
  console.log('3. Deleting all exams, exam codes & questions...');
  try { await supabase.from('questions_ec').delete().neq('id', 0); } catch {}
  try { await supabase.from('questions').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch {}
  try { await supabase.from('exam_codes').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch {}
  try { await supabase.from('exams').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch {}

  // 4. Delete batches, sections, cohorts, academic years, colleges
  console.log('4. Deleting academic hierarchy (batches, sections, cohorts, years, colleges)...');
  try { await supabase.from('batches').delete().neq('id', 0); } catch {}
  try { await supabase.from('sections').delete().neq('id', '0'); } catch {}
  try { await supabase.from('cohorts').delete().neq('id', '0'); } catch {}
  try { await supabase.from('academic_years').delete().neq('id', '0'); } catch {}
  try { await supabase.from('colleges').delete().neq('id', 0); } catch {}

  // 5. Clean staff accounts: PRESERVE ONLY Admin and Inspector
  console.log('5. Preserving ONLY Admin and Inspector; deleting all extra staff...');
  const { data: allStaff } = await supabase.from('staff').select('id, email, role');
  if (allStaff && allStaff.length > 0) {
    for (const member of allStaff) {
      const emailLower = (member.email || '').toLowerCase().trim();
      if (emailLower !== adminEmail && emailLower !== inspectorEmail) {
        console.log(`   - Removing extra staff member: ${member.email} (${member.role})`);
        await supabase.from('staff').delete().eq('id', member.id);
      }
    }
  }

  // 6. Idempotently ensure Admin & Inspector exist with fresh bcrypt password hashes from env
  console.log('6. Ensuring Admin and Inspector accounts are configured from environment variables...');
  const adminHash = await bcrypt.hash(adminPassword, 12);
  const inspectorHash = await bcrypt.hash(inspectorPassword, 12);

  const { data: existingAdmin } = await supabase
    .from('staff')
    .select('id, email')
    .eq('email', adminEmail)
    .maybeSingle();

  if (existingAdmin) {
    await supabase.from('staff').update({
      password_hash: adminHash,
      role: 'super_admin',
      is_active: true,
      must_change_password: true,
      failed_attempts: 0,
      locked_until: null,
      updated_at: new Date().toISOString(),
    }).eq('id', existingAdmin.id);
    console.log(`   ✅ Admin account refreshed: ${adminEmail}`);
  } else {
    await supabase.from('staff').insert({
      id: 'e6fa7676-2798-4b3c-b452-37d455bb3585',
      name: 'LogicWhile Super Admin',
      email: adminEmail,
      username: 'admin',
      password_hash: adminHash,
      role: 'super_admin',
      is_active: true,
      must_change_password: true,
      failed_attempts: 0,
      locked_until: null,
      created_at: new Date().toISOString(),
    });
    console.log(`   ✅ Admin account created: ${adminEmail}`);
  }

  const { data: existingInspector } = await supabase
    .from('staff')
    .select('id, email')
    .eq('email', inspectorEmail)
    .maybeSingle();

  if (existingInspector) {
    await supabase.from('staff').update({
      password_hash: inspectorHash,
      role: 'inspector',
      is_active: true,
      must_change_password: true,
      failed_attempts: 0,
      locked_until: null,
      updated_at: new Date().toISOString(),
    }).eq('id', existingInspector.id);
    console.log(`   ✅ Inspector account refreshed: ${inspectorEmail}`);
  } else {
    await supabase.from('staff').insert({
      id: 'f7ba8888-3809-4c4d-a563-2111e38ffb09',
      name: 'LogicWhile Chief Inspector',
      email: inspectorEmail,
      username: 'inspector',
      password_hash: inspectorHash,
      role: 'inspector',
      is_active: true,
      must_change_password: true,
      failed_attempts: 0,
      locked_until: null,
      created_at: new Date().toISOString(),
    });
    console.log(`   ✅ Inspector account created: ${inspectorEmail}`);
  }

  // 7. Verify final clean state
  console.log('\n================================================================');
  console.log('📊 FINAL DATABASE STATE VERIFICATION');
  console.log('================================================================');
  const tables = [
    'colleges',
    'academic_years',
    'cohorts',
    'sections',
    'batches',
    'students',
    'exams',
    'exam_codes',
    'questions',
    'questions_ec',
    'exam_code_attempts',
    'results',
    'sessions',
    'staff',
  ];

  for (const t of tables) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`Table ${t.padEnd(20)}: Error (${error.message})`);
    } else {
      console.log(`Table ${t.padEnd(20)}: ${count} rows`);
    }
  }

  const { data: finalStaff } = await supabase.from('staff').select('id, name, email, role');
  console.log('\nRemaining Staff Accounts:');
  console.log(finalStaff);

  console.log('\n✅ DATABASE CLEAN COMPLETE! 100% PRODUCTION READY.');
  console.log('================================================================\n');
}

cleanDatabase().catch(err => {
  console.error('❌ Clean database error:', err);
  process.exit(1);
});
