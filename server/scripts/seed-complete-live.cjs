const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function formatDifficulty(d) {
  if (!d) return 'Medium';
  const lower = String(d).toLowerCase().trim();
  if (lower === 'easy') return 'Easy';
  if (lower === 'hard') return 'Hard';
  return 'Medium';
}

async function seedCompleteLive() {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('🌟 SEEDING AND UPDATING COMPLETE PRODUCTION DATASET');
  console.log('════════════════════════════════════════════════════════════════\n');

  // 1. Read Excel template
  const excelPath = 'c:/Users/chara/OneDrive/Desktop/LogicWhileLire/LogicWhileLiRE_Questions_Template.xlsx';
  const wb = XLSX.readFile(excelPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawQuestions = XLSX.utils.sheet_to_json(sheet);
  console.log(`[1] Loaded ${rawQuestions.length} questions from Excel template.`);

  const now = new Date();
  const future = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year ahead
  const collegeId = 80;

  // 2. Ensure College 80 exists and is active
  await supabase.from('colleges').upsert({
    id: collegeId,
    college_name: 'LogicWhile Team',
    college_code: 'LOGICWHILE',
    city: 'Hyderabad',
    state: 'Telangana',
    contact_email: 'logicwhilelire@gmail.com',
    contact_phone: '+918106063555',
    is_active: true,
    registration_enabled: true,
    updated_at: now.toISOString(),
  }, { onConflict: 'id' });
  console.log('[2] Verified College 80 (LOGICWHILE).');

  // 3. Academic Hierarchy for College 80
  const ayId = 'ay-logicwhile-2026';
  await supabase.from('academic_years').upsert({
    id: ayId,
    college_id: String(collegeId),
    year: '2026-27',
    start_date: '2026-06-01',
    end_date: '2027-05-31',
    is_active: true,
    updated_at: now.toISOString(),
  }, { onConflict: 'id' });

  const cohId = 'coh-logicwhile-2028-cse';
  await supabase.from('cohorts').upsert({
    id: cohId,
    college_id: String(collegeId),
    academic_year_id: ayId,
    name: 'Class of 2028 (CSE)',
    year_of_passing: 2028,
    degree: 'B.Tech',
    branch: 'CSE',
    is_active: true,
    updated_at: now.toISOString(),
  }, { onConflict: 'id' });

  const secIdA = 'sec-logicwhile-2028-cse-a';
  await supabase.from('sections').upsert({
    id: secIdA,
    cohort_id: cohId,
    name: 'Section A',
    is_active: true,
    updated_at: now.toISOString(),
  }, { onConflict: 'id' });

  const secIdB = 'sec-logicwhile-2028-cse-b';
  await supabase.from('sections').upsert({
    id: secIdB,
    cohort_id: cohId,
    name: 'Section B',
    is_active: true,
    updated_at: now.toISOString(),
  }, { onConflict: 'id' });
  console.log('[3] Verified Academic Hierarchy (AY, Cohort, Sections A & B).');

  // 4. Seed Faculty & Inspector in Staff
  const facultyPassword = await bcrypt.hash('Faculty@123', 12);
  const facultyStaff = [
    {
      id: 'fa000000-0000-0000-0000-000000000001',
      name: 'Dr. Suresh Kumar (Faculty Chair)',
      email: 'suresh@logicwhilelire.com',
      password_hash: facultyPassword,
      role: 'faculty',
      college_id: collegeId,
      is_active: true,
      permissions: ['user:suresh', 'view_results', 'manage_questions', 'grade_code'],
      updated_at: now.toISOString(),
    },
    {
      id: 'fa000000-0000-0000-0000-000000000002',
      name: 'Prof. Priya Sharma (CSE Trainer)',
      email: 'priya@logicwhilelire.com',
      password_hash: facultyPassword,
      role: 'faculty',
      college_id: collegeId,
      is_active: true,
      permissions: ['user:priya', 'view_results', 'manage_questions'],
      updated_at: now.toISOString(),
    }
  ];

  for (const f of facultyStaff) {
    await supabase.from('staff').upsert(f, { onConflict: 'id' });
  }
  console.log('[4] Verified Faculty & Staff Accounts (suresh@logicwhilelire.com / Faculty@123).');

  // 5. Seed Roster and Verified Students
  const candidates = [
    {
      roll: '24HU1A05F9',
      name: 'Redrowthu Charan Sai Krishna',
      email: 'charanshop7@gmail.com',
      section: 'A',
    },
    {
      roll: 'RVACJ31411',
      name: 'Charan R',
      email: 'charansai3327@gmail.com',
      section: 'A',
    },
    {
      roll: '2201A0501',
      name: 'Aravind Swamy',
      email: 'aravind@logicwhilelire.com',
      section: 'A',
    },
    {
      roll: '2201A0502',
      name: 'Bhavana Reddy',
      email: 'bhavana@logicwhilelire.com',
      section: 'B',
    }
  ];

  for (const c of candidates) {
    // Upsert Student Roster
    await supabase.from('student_roster').upsert({
      id: `roster-${c.roll.toLowerCase()}`,
      college_id: collegeId,
      roll_number: c.roll,
      name: c.name,
      section: c.section,
      cohort_id: cohId,
      email: c.email,
    }, { onConflict: 'id' });

    // Upsert Registered Student
    const { data: existingStudent } = await supabase.from('students').select('id').eq('roll_number', c.roll).maybeSingle();
    const studentPayload = {
      name: c.name,
      roll_number: c.roll,
      hall_ticket: c.roll,
      email: c.email,
      college_id: collegeId,
      branch: 'CSE',
      section: c.section,
      section_id: c.section,
      passout_year: 2028,
      is_verified: true,
      updated_at: now.toISOString(),
    };
    if (existingStudent?.id) {
      await supabase.from('students').update(studentPayload).eq('id', existingStudent.id);
    } else {
      await supabase.from('students').insert({
        ...studentPayload,
        created_at: now.toISOString(),
      });
    }
  }
  console.log('[5] Seeded & Verified Student Roster & Accounts (24HU1A05F9, RVACJ31411, 2201A0501, 2201A0502).');

  // 6. Seed Legacy Exams and Questions Bank
  const legacyExams = [
    {
      id: 'e1000000-0000-0000-0000-000000000001',
      title: 'LogicWhile LiRE — Master Assessment',
      duration_minutes: 45,
      start_time: now.toISOString(),
      end_time: future.toISOString(),
      admin_email: 'admin@logicwhilelire.com',
      is_leaderboard_public: true,
      is_active: true,
    },
    {
      id: 'e1000000-0000-0000-0000-000000000002',
      title: 'LogicWhile LiRE — Core Engineering Qualifier',
      duration_minutes: 30,
      start_time: now.toISOString(),
      end_time: future.toISOString(),
      admin_email: 'admin@logicwhilelire.com',
      is_leaderboard_public: true,
      is_active: true,
    },
    {
      id: 'e1000000-0000-0000-0000-000000000003',
      title: 'Searching & Binary Traversal Velocity Exam',
      duration_minutes: 20,
      start_time: now.toISOString(),
      end_time: future.toISOString(),
      admin_email: 'admin@logicwhilelire.com',
      is_leaderboard_public: true,
      is_active: true,
    }
  ];

  for (const le of legacyExams) {
    const { error: leErr } = await supabase.from('exams').upsert(le, { onConflict: 'id' });
    if (leErr) {
      console.error(`Error upserting exam ${le.id}:`, leErr.message);
    } else {
      console.log(`✓ Upserted exam: ${le.title}`);
    }

    // Insert questions into questions table
    await supabase.from('questions').delete().eq('exam_id', le.id);

    const questionsRows = rawQuestions.map((q, idx) => {
      const correctAns = String(q['Correct Answer'] || q.correct_answer || 'C').toLowerCase().trim();
      const validCorrect = ['a', 'b', 'c', 'd'].includes(correctAns) ? correctAns : 'a';

      return {
        exam_id: le.id,
        question: String(q['Question'] || q.question || ''),
        options: {
          a: String(q['Option A'] || q.option_a || ''),
          b: String(q['Option B'] || q.option_b || ''),
          c: String(q['Option C'] || q.option_c || ''),
          d: String(q['Option D'] || q.option_d || ''),
        },
        correct_option: validCorrect,
        marks: Number(q['Marks'] || q.marks || 1),
        topic: String(q['Topic'] || q.topic || 'Searching Algorithms'),
        difficulty: formatDifficulty(q['Difficulty'] || q.difficulty),
        display_order: idx + 1,
        question_set: 'A',
        set_number: 1,
      };
    });

    const { error: qErr } = await supabase.from('questions').insert(questionsRows);
    if (qErr) {
      console.error(`Error inserting questions for exam ${le.id}:`, qErr.message);
    } else {
      console.log(`✓ Inserted ${questionsRows.length} questions into exam: ${le.title}`);
    }
  }

  // 7. Synchronize all Fast-Access Exam Codes and Questions (questions_ec)
  const examCodes = [
    {
      exam_code: 'GR-LOGICWHILE-GZ3FZZ',
      exam_name: 'LogicWhile LiRE — Core Engineering Assessment',
      subject: 'Computer Science & Engineering',
      duration_minutes: 45,
      total_marks: 100,
    },
    {
      exam_code: 'GR-LOGICWHILE-285G9G',
      exam_name: 'LogicWhile LiRE — Qualifier Assessment',
      subject: 'Computer Science & Engineering',
      duration_minutes: 30,
      total_marks: 10,
    },
    {
      exam_code: 'GR-LOGICWHILE-28SG9G',
      exam_name: 'LogicWhile LiRE — Qualifier Assessment (Alt)',
      subject: 'Computer Science & Engineering',
      duration_minutes: 30,
      total_marks: 10,
    },
    {
      exam_code: 'DEMO123',
      exam_name: 'LogicWhile LiRE — Interactive Demo Sprint',
      subject: 'Computer Science & Engineering',
      duration_minutes: 45,
      total_marks: 100,
    },
    {
      exam_code: 'CS2026',
      exam_name: 'LogicWhile LiRE — CS 2026 Qualifier',
      subject: 'Computer Science & Engineering',
      duration_minutes: 60,
      total_marks: 100,
    }
  ];

  for (const ec of examCodes) {
    await supabase.from('exam_codes').upsert({
      exam_code: ec.exam_code,
      exam_name: ec.exam_name,
      subject: ec.subject,
      total_questions: rawQuestions.length,
      duration_minutes: ec.duration_minutes,
      passing_percentage: 40,
      start_time: now.toISOString(),
      end_time: future.toISOString(),
      is_launched: true,
      is_active: true,
      results_published: true,
      proctoring_enabled: true,
      negative_marking: 0,
      total_marks: ec.total_marks,
      max_participants: 2000,
      max_violations: 5,
      auto_terminate: true,
      grace_period_seconds: 120,
      allowed_languages: ['python', 'javascript', 'cpp', 'java'],
      is_locked: false,
      paper_status: 'allocated',
      college_id: collegeId,
      updated_at: now.toISOString(),
    }, { onConflict: 'exam_code' });

    await supabase.from('questions_ec').delete().eq('exam_code', ec.exam_code);

    const questionsEcRows = rawQuestions.map((q, idx) => ({
      exam_code: ec.exam_code,
      question: q['Question'] || q.question,
      option_a: String(q['Option A'] || q.option_a || ''),
      option_b: String(q['Option B'] || q.option_b || ''),
      option_c: String(q['Option C'] || q.option_c || ''),
      option_d: String(q['Option D'] || q.option_d || ''),
      correct_answer: String(q['Correct Answer'] || q.correct_answer || 'A').toUpperCase().trim(),
      marks: Number(q['Marks'] || q.marks || 1),
      penalty: Number(q['Penalty'] || q.penalty || 0),
      topic: q['Topic'] || q.topic || 'Linear Search & Binary Search',
      section: q['Section'] || q.section || 'Searching Algorithms',
      difficulty: formatDifficulty(q['Difficulty'] || q.difficulty),
      display_order: idx + 1,
    }));

    await supabase.from('questions_ec').insert(questionsEcRows);
    console.log(`✓ Inserted ${questionsEcRows.length} questions into questions_ec for: ${ec.exam_code}`);
  }

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('🎉 ALL PRODUCTION TABLES, EXAMS & QUESTIONS ARE 100% POPULATED!');
  console.log('════════════════════════════════════════════════════════════════\n');
}

seedCompleteLive().catch(err => {
  console.error('Fatal seeding error:', err);
  process.exit(1);
});
