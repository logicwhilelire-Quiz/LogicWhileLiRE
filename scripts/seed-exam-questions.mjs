import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envLines = fs.readFileSync(path.resolve(__dirname, '../server/.env'), 'utf8').split('\n');
const env = {};
for (const line of envLines) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const idx = trimmed.indexOf('=');
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
  }
}

const { createClient } = await import('../server/node_modules/@supabase/supabase-js/dist/index.mjs');
const XLSX = (await import('../server/node_modules/xlsx/xlsx.mjs')).default;
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const excelPath = path.resolve(__dirname, '../../LogicWhileLiRE_Questions_Template.xlsx');
console.log('Reading:', excelPath);

const buf = fs.readFileSync(excelPath);
const wb = XLSX.read(buf, { type: 'buffer' });
const sheet = wb.Sheets[wb.SheetNames[0]];
const rawQuestions = XLSX.utils.sheet_to_json(sheet);
console.log(`Loaded ${rawQuestions.length} questions from Excel`);

function formatDifficulty(d) {
  if (!d) return 'Medium';
  const lower = String(d).toLowerCase().trim();
  if (lower === 'easy') return 'Easy';
  if (lower === 'hard') return 'Hard';
  return 'Medium';
}

async function seed() {
  const examCodesToSeed = ['GR-RVIT-FKFYUF', 'DEMO123', 'CS2026', 'GR-LOGICWHILE-GZ3FZZ'];

  // Ensure these exam codes exist first in exam_codes table
  const now = new Date();
  const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const defaultCodes = [
    {
      exam_code: 'DEMO123',
      exam_name: 'Interactive Demo Assessment',
      subject: 'Computer Science',
      college_id: 80,
    },
    {
      exam_code: 'CS2026',
      exam_name: 'CS 2026 Qualifier Exam',
      subject: 'Computer Science',
      college_id: 80,
    },
    {
      exam_code: 'GR-LOGICWHILE-GZ3FZZ',
      exam_name: 'LogicWhile Core Engineering Assessment',
      subject: 'Computer Science',
      college_id: 80,
    }
  ];

  for (const def of defaultCodes) {
    await sb.from('exam_codes').upsert({
      exam_code: def.exam_code,
      exam_name: def.exam_name,
      subject: def.subject,
      college_id: def.college_id,
      total_questions: rawQuestions.length,
      duration_minutes: 45,
      passing_percentage: 40,
      start_time: now.toISOString(),
      end_time: future.toISOString(),
      is_launched: true,
      is_active: true,
      total_marks: 100,
    }, { onConflict: 'exam_code' });
  }

  for (const code of examCodesToSeed) {
    await sb.from('questions_ec').delete().eq('exam_code', code);

    const rows = rawQuestions.map((q, idx) => ({
      exam_code: code,
      question: q['Question'] || q.question || `Question ${idx + 1}`,
      question_text: q['Question'] || q.question || `Question ${idx + 1}`,
      option_a: String(q['Option A'] || q.option_a || 'Option A'),
      option_b: String(q['Option B'] || q.option_b || 'Option B'),
      option_c: String(q['Option C'] || q.option_c || 'Option C'),
      option_d: String(q['Option D'] || q.option_d || 'Option D'),
      correct_answer: String(q['Correct Answer'] || q.correct_answer || 'A').toUpperCase().trim(),
      marks: Number(q['Marks'] || q.marks || 1),
      penalty: Number(q['Penalty'] || q.penalty || 0),
      topic: q['Topic'] || q.topic || 'Linear Search & Binary Search',
      section: q['Section'] || q.section || 'Searching Algorithms',
      difficulty: formatDifficulty(q['Difficulty'] || q.difficulty),
      display_order: idx + 1,
      order_index: idx + 1,
      question_type: 'mcq',
    }));

    const { error } = await sb.from('questions_ec').insert(rows);
    if (error) {
      console.error(`Error inserting questions for ${code}:`, error.message);
    } else {
      console.log(`✓ Inserted ${rows.length} questions for exam code: ${code}`);
    }
  }

  // Also update GR-RVIT-FKFYUF
  await sb.from('exam_codes').update({
    total_questions: rawQuestions.length,
    is_active: true,
    is_launched: true,
  }).eq('exam_code', 'GR-RVIT-FKFYUF');

  console.log('Done!');
}

seed();
