const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
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

async function reuploadAndUpdateAll() {
  console.log('🚀 Re-uploading and updating all exam codes and questions...');

  // 1. Read Excel template
  const excelPath = 'c:/Users/chara/OneDrive/Desktop/LogicWhileLire/LogicWhileLiRE_Questions_Template.xlsx';
  const wb = XLSX.readFile(excelPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawQuestions = XLSX.utils.sheet_to_json(sheet);
  console.log(`Loaded ${rawQuestions.length} questions from Excel template.`);

  // 2. Target exam codes
  const examCodesToUpdate = [
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

  const now = new Date();
  const future = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year ahead

  // 3. Upsert exam codes
  for (const ec of examCodesToUpdate) {
    const payload = {
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
      college_id: 80,
    };

    const { error: ecErr } = await supabase.from('exam_codes').upsert(payload, { onConflict: 'exam_code' });
    if (ecErr) {
      console.error(`Error updating exam_code ${ec.exam_code}:`, ecErr.message);
    } else {
      console.log(`✓ Activated & launched exam code: ${ec.exam_code}`);
    }

    // 4. Delete existing questions for this exam_code and re-insert fresh
    await supabase.from('questions_ec').delete().eq('exam_code', ec.exam_code);

    const questionsToInsert = rawQuestions.map((q, idx) => ({
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

    const { error: insErr } = await supabase.from('questions_ec').insert(questionsToInsert);
    if (insErr) {
      console.error(`Error inserting questions for ${ec.exam_code}:`, insErr.message);
    } else {
      console.log(`✓ Inserted ${questionsToInsert.length} questions for ${ec.exam_code}`);
    }
  }

  // 5. Ensure candidate students are eligible for all sections and verified
  const candidateRolls = ['24HU1A05F9', 'RVACJ31411', '2201A0501'];
  for (const roll of candidateRolls) {
    const { data: existing } = await supabase.from('students').select('*').eq('roll_number', roll);
    if (!existing || existing.length === 0) {
      await supabase.from('students').insert({
        name: 'R. Charan Sai Krishna',
        roll_number: roll,
        hall_ticket: roll,
        email: `${roll.toLowerCase()}@logicwhilelire.com`,
        college_id: 80,
        branch: 'CSE',
        section: 'A',
        section_id: 'A',
        passout_year: 2028,
        is_verified: true,
      });
      console.log(`✓ Seeded student candidate: ${roll}`);
    } else {
      await supabase.from('students').update({
        is_verified: true,
        section_id: 'A',
        section: 'A',
        branch: 'CSE',
        passout_year: 2028,
      }).eq('roll_number', roll);
      console.log(`✓ Updated candidate eligibility & verified status: ${roll}`);
    }
  }

  console.log('\n🎉 ALL EXAM CODES & QUESTIONS RE-UPLOADED & ACTIVATED SUCCESSFULLY!');
}

reuploadAndUpdateAll().catch(err => {
  console.error('Fatal reupload error:', err);
  process.exit(1);
});
