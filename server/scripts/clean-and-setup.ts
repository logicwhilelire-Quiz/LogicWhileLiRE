import 'dotenv/config';
import bcrypt from 'bcrypt';
import { supabase } from '../src/db/supabase';

async function cleanAndSetup() {
  console.log('================================================================');
  console.log('🧹 1. PURGING ALL DEMO & TEST DATA');
  console.log('================================================================');

  // 1. Delete test/demo students
  const { error: delStuErr } = await supabase.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Cleared students table:', delStuErr ? delStuErr.message : 'Clean (0 remaining)');

  // 2. Clear any lingering exam sessions, answers, results
  await supabase.from('session_answers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('exam_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('results').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('violations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('exam_code_attempts').delete().neq('id', 0);
  await supabase.from('questions_ec').delete().neq('id', '0');
  await supabase.from('questions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('exams').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('exam_codes').delete().neq('id', 0);
  await supabase.from('audit_log').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('mail_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('✅ Cleared all sessions, results, questions, exams, audit logs, and mail logs.');

  console.log('\n================================================================');
  console.log('🔒 2. ENSURING ONLY THE SINGLE DEFINITIVE CREDENTIAL PAIR');
  console.log('================================================================');

  // Purge any extraneous staff accounts
  const { data: allStaff } = await supabase.from('staff').select('id, username, email');
  const validUsernames = ['admin', 'inspector'];

  if (allStaff) {
    for (const s of allStaff) {
      if (!validUsernames.includes(s.username?.toLowerCase() || '')) {
        console.log(`Removing extra staff account: ${s.username} (${s.email})`);
        await supabase.from('staff').delete().eq('id', s.id);
      }
    }
  }

  // Update Admin credentials strictly to Charansai@2366R
  const adminHash = await bcrypt.hash('Charansai@2366R', 12);
  const { error: admErr } = await supabase
    .from('staff')
    .update({
      password_hash: adminHash,
      must_change_password: false,
      failed_attempts: 0,
      locked_until: null,
      is_active: true,
      permissions: ['user:admin', 'all'],
    })
    .eq('username', 'admin');
  console.log('Updated Admin password to permanent Charansai@2366R:', admErr ? admErr.message : 'OK');

  // Update Inspector credentials strictly to Charansai@2366C
  const inspectorHash = await bcrypt.hash('Charansai@2366C', 12);
  const { error: inspErr } = await supabase
    .from('staff')
    .update({
      password_hash: inspectorHash,
      must_change_password: false,
      failed_attempts: 0,
      locked_until: null,
      is_active: true,
      college_id: 75,
      permissions: ['user:inspector', 'inspect_all'],
    })
    .eq('username', 'inspector');
  console.log('Updated Inspector password to permanent Charansai@2366C:', inspErr ? inspErr.message : 'OK');

  console.log('\n================================================================');
  console.log('🏛️ 3. SETTING UP ACTIVE SECTIONS & ACADEMIC HIERARCHY');
  console.log('================================================================');

  // Clean old hierarchy tables
  await supabase.from('batches').delete().neq('id', 'none');
  await supabase.from('sections').delete().neq('id', 'none');
  await supabase.from('cohorts').delete().neq('id', 'none');
  await supabase.from('academic_years').delete().neq('id', 'none');

  const collegeId = 75; // RVIT
  const code = 'RVIT';

  // 1. Academic Year 2026-27
  const ayId = `ay-${code.toLowerCase()}-2026`;
  await supabase.from('academic_years').upsert({
    id: ayId,
    college_id: String(collegeId),
    year: '2026-27',
    year_name: 'Academic Session 2026-2027',
    yop: 2026,
    start_date: '2025-06-01',
    end_date: '2026-05-31',
    is_active: true,
    updated_at: new Date().toISOString(),
  });
  console.log('✅ Academic Year 2026-27 active');

  // 2. Cohorts
  const cohorts = [
    {
      id: `coh-${code.toLowerCase()}-2026-cse`,
      name: 'Class of 2026 (CSE)',
      degree: 'B.Tech',
      branch: 'CSE',
      yop: 2026,
    },
    {
      id: `coh-${code.toLowerCase()}-2026-csm`,
      name: 'Class of 2026 (CSM)',
      degree: 'B.Tech',
      branch: 'CSM',
      yop: 2026,
    },
    {
      id: `coh-${code.toLowerCase()}-2026-ece`,
      name: 'Class of 2026 (ECE)',
      degree: 'B.Tech',
      branch: 'ECE',
      yop: 2026,
    },
  ];

  for (const c of cohorts) {
    await supabase.from('cohorts').upsert({
      id: c.id,
      college_id: String(collegeId),
      academic_year_id: ayId,
      name: c.name,
      degree: c.degree,
      branch: c.branch,
      year_of_passing: c.yop,
      yop: c.yop,
      is_active: true,
      updated_at: new Date().toISOString(),
    });
  }
  console.log(`✅ ${cohorts.length} Cohorts created (CSE, CSM, ECE)`);

  // 3. Sections
  const sections = [
    { id: `sec-${code.toLowerCase()}-cse-a`, cohort_id: `coh-${code.toLowerCase()}-2026-cse`, name: 'Section A', section_name: 'CSE Section A', branch: 'CSE', room: 'Lab 101', cap: 66 },
    { id: `sec-${code.toLowerCase()}-cse-b`, cohort_id: `coh-${code.toLowerCase()}-2026-cse`, name: 'Section B', section_name: 'CSE Section B', branch: 'CSE', room: 'Lab 102', cap: 66 },
    { id: `sec-${code.toLowerCase()}-cse-c`, cohort_id: `coh-${code.toLowerCase()}-2026-cse`, name: 'Section C', section_name: 'CSE Section C', branch: 'CSE', room: 'Lab 103', cap: 66 },
    { id: `sec-${code.toLowerCase()}-csm-a`, cohort_id: `coh-${code.toLowerCase()}-2026-csm`, name: 'Section A', section_name: 'CSM Section A', branch: 'CSM', room: 'Lab 201', cap: 66 },
    { id: `sec-${code.toLowerCase()}-csm-b`, cohort_id: `coh-${code.toLowerCase()}-2026-csm`, name: 'Section B', section_name: 'CSM Section B', branch: 'CSM', room: 'Lab 202', cap: 66 },
    { id: `sec-${code.toLowerCase()}-ece-a`, cohort_id: `coh-${code.toLowerCase()}-2026-ece`, name: 'Section A', section_name: 'ECE Section A', branch: 'ECE', room: 'Lab 301', cap: 66 },
    { id: `sec-${code.toLowerCase()}-ece-b`, cohort_id: `coh-${code.toLowerCase()}-2026-ece`, name: 'Section B', section_name: 'ECE Section B', branch: 'ECE', room: 'Lab 302', cap: 66 },
  ];

  for (const s of sections) {
    await supabase.from('sections').upsert({
      id: s.id,
      college_id: String(collegeId),
      cohort_id: s.cohort_id,
      academic_year_id: ayId,
      name: s.name,
      section_name: s.section_name,
      room_number: s.room,
      capacity: s.cap,
      is_active: true,
      updated_at: new Date().toISOString(),
    });

    // Batches
    await supabase.from('batches').upsert([
      {
        id: `bat-${s.id}-1`,
        college_id: String(collegeId),
        cohort_id: s.cohort_id,
        section_id: s.id,
        name: `${s.section_name} - Batch 1`,
        batch_name: 'Batch 1',
        batch_code: 'B1',
        max_capacity: 33,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      {
        id: `bat-${s.id}-2`,
        college_id: String(collegeId),
        cohort_id: s.cohort_id,
        section_id: s.id,
        name: `${s.section_name} - Batch 2`,
        batch_name: 'Batch 2',
        batch_code: 'B2',
        max_capacity: 33,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
    ]);
  }
  console.log(`✅ ${sections.length} Academic Sections configured (CSE A-C, CSM A-B, ECE A-B) with Batches!`);

  console.log('\n================================================================');
  console.log('🎉 CLEAN SLATE SETUP COMPLETE!');
  console.log('================================================================\n');
}

cleanAndSetup().catch(console.error);
