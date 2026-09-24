const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { z } = require('zod');

const QuestionRowSchema = z.object({
  question_text: z.string().min(5, 'Question text must be at least 5 characters'),
  option_a: z.string().min(1, 'Option A cannot be empty'),
  option_b: z.string().min(1, 'Option B cannot be empty'),
  option_c: z.string().min(1, 'Option C cannot be empty'),
  option_d: z.string().min(1, 'Option D cannot be empty'),
  correct_option: z
    .string()
    .transform((val) => val.trim().toLowerCase())
    .pipe(z.enum(['a', 'b', 'c', 'd'])),
  topic: z.string().optional().default('General'),
  difficulty: z
    .string()
    .transform((val) => val.trim().toLowerCase())
    .pipe(z.enum(['easy', 'medium', 'hard']))
    .optional()
    .default('medium'),
});

const filePath = path.join(__dirname, 'sample_questions.xlsx');
const buf = fs.readFileSync(filePath);
const workbook = xlsx.read(buf, { type: 'buffer' });
const sheetName = workbook.SheetNames[0];
const rawRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

console.log('Read rows count:', rawRows.length);
let validCount = 0;
rawRows.forEach((r, idx) => {
  const parsed = QuestionRowSchema.safeParse(r);
  if (parsed.success) {
    validCount++;
    console.log(`Row ${idx + 2} valid: "${parsed.data.question_text.slice(0, 35)}..." [Correct: ${parsed.data.correct_option}] [Topic: ${parsed.data.topic}]`);
  } else {
    console.error(`Row ${idx + 2} error:`, parsed.error.issues);
  }
});

if (validCount === 5) {
  console.log('\n SUCCESS: All 5 sample questions parsed and validated according to strict schema specifications!');
} else {
  console.error('\n FAILED: Some questions failed validation.');
  process.exit(1);
}
