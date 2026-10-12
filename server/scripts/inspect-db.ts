import 'dotenv/config';
import { supabase } from '../src/db/supabase';

async function check() {
  const tables = [
    'staff',
    'students',
    'exams',
    'exam_codes',
    'questions',
    'questions_ec',
    'colleges',
    'sections',
    'batches',
    'cohorts',
    'exam_sessions',
    'results',
    'audit_log',
    'mail_logs',
    'violations'
  ];

  console.log('=== TABLE RECORD COUNTS ===');
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    console.log(`${t}: ${count} rows ${error ? `(Error: ${error.message})` : ''}`);
  }

  console.log('\n=== STAFF ACCOUNTS ===');
  const { data: staffList } = await supabase.from('staff').select('id, name, email, username, role, is_active, created_at');
  console.log(JSON.stringify(staffList, null, 2));

  console.log('\n=== EXAMS ===');
  const { data: examsList } = await supabase.from('exams').select('id, exam_code, title, status, college_id, branch, section_id');
  console.log(JSON.stringify(examsList, null, 2));

  console.log('\n=== EXAM CODES ===');
  const { data: ecList } = await supabase.from('exam_codes').select('id, exam_code, exam_name, status, college_id, branch, section_id');
  console.log(JSON.stringify(ecList, null, 2));

  console.log('\n=== STUDENTS ===');
  const { data: studentsList, error: sErr } = await supabase.from('students').select('id, name, email, roll_number, hall_ticket, created_at');
  if (sErr) console.error('Students error:', sErr.message);
  console.log(JSON.stringify(studentsList, null, 2));

  console.log('\n=== COLLEGES ===');
  const { data: collegesList } = await supabase.from('colleges').select('id, college_name, college_code, city, state');
  console.log(JSON.stringify(collegesList, null, 2));

  console.log('\n=== SECTIONS ===');
  const { data: sectionsList } = await supabase.from('sections').select('*');
  console.log(JSON.stringify(sectionsList, null, 2));
}

check().catch(console.error);
