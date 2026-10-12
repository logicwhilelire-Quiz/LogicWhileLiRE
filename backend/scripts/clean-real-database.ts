import 'dotenv/config';
import { supabase } from '../src/db/supabase.ts';

async function cleanDatabase() {
  console.log('==================================================');
  console.log('🚀 CLEANING DATABASE FOR LAUNCH (PRESERVING 1 SUPER ADMIN)');
  console.log('==================================================');

  const superAdminId = 'e6fa7676-2798-4b3c-b452-37d455bb3585';

  // 1. Delete dependent student attempt & session records
  console.log('Cleaning exam attempts, sessions, results, audit logs...');
  await supabase.from('results').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('audit_log').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // 2. Delete all students
  console.log('Deleting all student records...');
  const { error: studentErr } = await supabase.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (studentErr) console.warn('Student delete notice:', studentErr.message);

  // 3. Delete non-admin staff
  console.log('Deleting faculty, inspectors and extra staff (preserving Super Admin)...');
  const { error: staffErr } = await supabase.from('staff').delete().neq('id', superAdminId);
  if (staffErr) console.warn('Staff delete notice:', staffErr.message);

  // 4. Delete exams, exam codes, questions
  console.log('Deleting exam codes, questions, exams...');
  await supabase.from('exam_codes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('questions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('exams').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // 5. Delete batches, sections, cohorts, academic years, colleges
  console.log('Deleting batches, sections, cohorts, academic years, colleges...');
  await supabase.from('batches').delete().neq('id', 0);
  await supabase.from('sections').delete().neq('id', 0);
  await supabase.from('cohorts').delete().neq('id', 0);
  await supabase.from('academic_years').delete().neq('id', 0);
  await supabase.from('colleges').delete().neq('id', 0);

  // 6. Verify final state
  console.log('\n--- VERIFYING CLEAN STATE ---');
  const tables = [
    'colleges',
    'academic_years',
    'cohorts',
    'sections',
    'batches',
    'staff',
    'students',
    'exams',
    'questions',
    'exam_codes',
    'sessions',
    'results',
    'audit_log',
  ];

  for (const t of tables) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`Table ${t}: Error (${error.message})`);
    } else {
      console.log(`Table ${t}: ${count} rows`);
    }
  }

  const { data: remainingStaff } = await supabase.from('staff').select('id, name, email, role');
  console.log('\nRemaining Staff (Super Admin):', remainingStaff);
  console.log('✅ DATABASE CLEAN COMPLETE!');
}

cleanDatabase();
