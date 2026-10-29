require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectQuestions() {
  const { data: questions, error } = await supabase
    .from('questions_ec')
    .select('*')
    .eq('exam_code', 'CS2026')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching questions:', error);
    return;
  }

  questions.forEach((q, i) => {
    console.log(`\n--- Q${i + 1} [${q.id}] (${q.question_type}) ---`);
    console.log('Keys:', Object.keys(q));
    console.log('Options:', q.options || q.options_json || q.choices);
    console.log('Option A:', q.option_a);
    console.log('Option B:', q.option_b);
    console.log('Option C:', q.option_c);
    console.log('Option D:', q.option_d);
    console.log('Correct Answer:', q.correct_answer);
  });
}

inspectQuestions();
