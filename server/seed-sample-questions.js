/**
 * seed-sample-questions.js
 * Imports questions from sample_questions.xlsx plus a coding question
 * into questions_ec and questions tables for both GR-RVIT-8P2NCU and CS2026,
 * and updates total_questions count on exam_codes.
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const xlsx = require('xlsx');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[FATAL] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('=== SEEDING QUESTIONS FROM EXCEL & CODING CHALLENGES ===');

  // 1. Read sample_questions.xlsx
  const wb = xlsx.readFile('sample_questions.xlsx');
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet);
  console.log(`Read ${rows.length} questions from sample_questions.xlsx`);

  const examCodesToSeed = ['GR-RVIT-8P2NCU', 'CS2026'];

  // Ensure CS2026 exists in exam_codes
  const { data: existingCS2026 } = await supabase
    .from('exam_codes')
    .select('id, exam_code')
    .eq('exam_code', 'CS2026')
    .maybeSingle();

  if (!existingCS2026) {
    const { error: insErr } = await supabase.from('exam_codes').insert({
      exam_code: 'CS2026',
      exam_name: 'Core Computer Science & Systems 2026',
      subject: 'Computer Science & Engineering',
      duration_minutes: 30,
      total_questions: 6,
      college_id: 89,
      is_active: true,
      is_launched: false,
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    });
    if (insErr) console.warn('CS2026 insert notice:', insErr.message);
    else console.log('✅ Created exam code: CS2026');
  }

  // Ensure GR-RVIT-8P2NCU is configured
  await supabase
    .from('exam_codes')
    .update({
      exam_name: 'RVIT CSE Live Examination 2026',
      duration_minutes: 30,
      is_active: true,
      college_id: 89,
      end_time: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    })
    .eq('exam_code', 'GR-RVIT-8P2NCU');

  for (const ec of examCodesToSeed) {
    console.log(`\nProcessing Exam Code: ${ec}...`);

    // Clean prior questions for this code to guarantee exact match
    await supabase.from('questions_ec').delete().eq('exam_code', ec);

    const questionsToInsert = [];

    // Map 5 Excel MCQs
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      questionsToInsert.push({
        exam_code: ec,
        question: r.question_text,
        question_text: r.question_text,
        question_type: 'mcq',
        option_a: r.option_a,
        option_b: r.option_b,
        option_c: r.option_c,
        option_d: r.option_d,
        correct_answer: String(r.correct_option).toUpperCase(),
        marks: 2,
        topic: r.topic || 'Core CS',
        section: 'Section 1 · Objective Evaluation',
        display_order: i + 1,
      });
    }

    // Add 1 Coding Question with starter code & test cases
    questionsToInsert.push({
      exam_code: ec,
      question: 'Implement a function solution() that reads an array of integers and returns the length of the longest strictly increasing contiguous subarray.',
      question_text: 'Implement a function solution() that reads an array of integers and returns the length of the longest strictly increasing contiguous subarray.',
      question_type: 'coding',
      option_a: 'Submission',
      option_b: '-',
      option_c: '-',
      option_d: '-',
      correct_answer: 'CODE',
      marks: 10,
      topic: 'Algorithms & Dynamic Programming',
      section: 'Section 2 · Practical Coding Implementation',
      starter_code: '# Write your solution in Python 3\nimport sys\n\ndef solution(nums):\n    if not nums:\n        return 0\n    max_len = 1\n    curr = 1\n    for i in range(1, len(nums)):\n        if nums[i] > nums[i-1]:\n            curr += 1\n            max_len = max(max_len, curr)\n        else:\n            curr = 1\n    return max_len\n\nif __name__ == "__main__":\n    # Test execution scaffold\n    print("True")\n',
      test_cases: [
        { id: 'tc-1', input_text: '[1, 3, 5, 4, 7]', expected_output: '3', marks: 5, is_hidden: false },
        { id: 'tc-2', input_text: '[2, 2, 2, 2, 2]', expected_output: '1', marks: 5, is_hidden: true },
      ],
      display_order: 6,
    });

    const { error: insErr } = await supabase.from('questions_ec').insert(questionsToInsert);
    if (insErr) {
      console.warn(`  ⚠️ Error inserting questions into questions_ec:`, insErr.message);
    } else {
      console.log(`  ✅ Successfully seeded ${questionsToInsert.length} questions into questions_ec for ${ec}`);
    }

    // Update total_questions count on exam_codes
    await supabase
      .from('exam_codes')
      .update({ total_questions: questionsToInsert.length, is_active: true })
      .eq('exam_code', ec);
    console.log(`  ✅ Updated exam_codes.total_questions = ${questionsToInsert.length} for ${ec}`);
  }

  // Ensure student 24HU1A05F9 is registered and enrolled in college 89
  const { data: stu } = await supabase
    .from('students')
    .select('id, roll_number')
    .eq('roll_number', '24HU1A05F9')
    .maybeSingle();

  if (stu) {
    await supabase
      .from('students')
      .update({
        college_id: 89,
        college_name: 'RVIT',
        is_verified: true,
        is_active: true,
      })
      .eq('id', stu.id);
    console.log('✅ Verified student 24HU1A05F9 enrolled in RVIT');
  }

  console.log('\n=== SEEDING COMPLETE ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('[FATAL SEED ERROR]:', err);
  process.exit(1);
});
