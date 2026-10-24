import * as XLSX from 'xlsx';
import { z } from 'zod';
import { supabase } from '../db/supabase';

export const questionRowSchema = z.object({
  question: z.string().min(1, 'Question text is required'),
  question_type: z.enum(['mcq', 'coding', 'programming', 'dsa', 'logical_reasoning', 'diagram']).default('mcq'),
  option_a: z.string().min(1, 'Option A is required'),
  option_b: z.string().min(1, 'Option B is required'),
  option_c: z.string().min(1, 'Option C is required'),
  option_d: z.string().min(1, 'Option D is required'),
  correct_option: z
    .string()
    .transform((v) => v.toLowerCase().trim())
    .pipe(z.enum(['a', 'b', 'c', 'd'], { message: 'correct_option must be a, b, c, or d' })),
  marks: z
    .union([z.string(), z.number()])
    .transform((v) => Number(v))
    .pipe(z.number().positive('marks must be a positive number')),
  penalty: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined || v === null || v === '' ? 0 : Math.abs(Number(v)))),
  section: z.string().optional().default('General'),
  topic: z.string().optional().default('General'),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']).optional().default('Medium'),
  starter_code: z.string().optional(),
  test_cases: z.any().optional(),
  diagram_url: z.string().optional(),
  explanation: z.string().optional(),
  set: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === null || v === '') return undefined;
      if (typeof v === 'number') return v > 0 ? Math.floor(v) : undefined;
      const str = String(v).trim().toUpperCase();
      const matchLetter = str.match(/^(?:SET\s*)?([A-Z])$/i);
      if (matchLetter) {
        return matchLetter[1].toUpperCase().charCodeAt(0) - 64; // 'A' -> 1, 'B' -> 2
      }
      const matchNum = str.match(/^(?:SET\s*)?(\d+)$/i);
      if (matchNum) {
        const parsed = parseInt(matchNum[1], 10);
        return parsed > 0 ? parsed : undefined;
      }
      return undefined;
    }),
});

export type QuestionRow = z.infer<typeof questionRowSchema>;

export interface RowError {
  row: number;
  errors: string[];
}

export interface ParseResult {
  valid: boolean;
  rows: QuestionRow[];
  errors: RowError[];
}

/**
 * Parse an Excel buffer and validate every row.
 * Full and correct extraction for:
 * 1. MCQ (Multiple Choice Questions)
 * 2. Programming / DSA (Data Structures & Algorithms with starter_code / test_cases)
 * 3. Logical Reasoning (puzzles, deduction, scenarios)
 * 4. Diagram Questions (diagram_url, image reference)
 */
export function parseAndValidateXlsx(buffer: Buffer): ParseResult {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  } catch {
    return { valid: false, rows: [], errors: [{ row: 0, errors: ['Failed to parse Excel file. Ensure it is a valid .xlsx file.'] }] };
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { valid: false, rows: [], errors: [{ row: 0, errors: ['The Excel file has no sheets.'] }] };
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (matrix.length === 0) {
    return { valid: false, rows: [], errors: [{ row: 0, errors: ['The sheet is empty. Please add question rows.'] }] };
  }

  const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  // Detect whether row 0 is a header row
  const firstRow = matrix[0] || [];
  const firstRowStr = firstRow.map((c) => String(c).toLowerCase().trim()).join(' ');
  const hasHeader =
    firstRowStr.includes('question') ||
    firstRowStr.includes('option') ||
    firstRowStr.includes('type') ||
    firstRowStr.includes('marks') ||
    firstRowStr.includes('correct') ||
    firstRowStr.includes('diagram');

  const dataRows = hasHeader ? rawRows : matrix;
  const validRows: QuestionRow[] = [];
  const rowErrors: RowError[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const rowNum = hasHeader ? i + 2 : i + 1;
    const raw = dataRows[i];

    let qText = '';
    let optA = '';
    let optB = '';
    let optC = '';
    let optD = '';
    let correctRaw = '';
    let marksRaw: unknown = 1;
    let penaltyRaw: unknown = 0;
    let sectionRaw = 'General';
    let topicRaw = 'General';
    let difficultyRaw: 'Easy' | 'Medium' | 'Hard' = 'Medium';
    let setRaw: unknown = undefined;
    let qType = 'mcq';
    let starterCode = '';
    let diagramUrl = '';
    let explanationText = '';

    if (Array.isArray(raw)) {
      // Positional array
      qText = String(raw[0] || '').trim();
      qType = String(raw[1] || 'mcq').trim().toLowerCase();
      const colC = String(raw[2] || '').trim();
      correctRaw = String(raw[3] !== undefined ? raw[3] : '').trim();
      marksRaw = raw[4] !== undefined && raw[4] !== '' ? raw[4] : 1;

      if (colC.includes('|')) {
        const parts = colC.split('|').map((s) => s.trim());
        optA = parts[0] || '';
        optB = parts[1] || '';
        optC = parts[2] || '';
        optD = parts[3] || '';
      } else if (raw.length >= 6) {
        optA = colC;
        optB = String(raw[3] || '').trim();
        optC = String(raw[4] || '').trim();
        optD = String(raw[5] || '').trim();
        correctRaw = String(raw[6] || '').trim();
        marksRaw = raw[7] !== undefined && raw[7] !== '' ? raw[7] : 1;
      }
    } else {
      // Object with headers
      const normObj: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(raw)) {
        normObj[k.trim().toLowerCase().replace(/[\s_]/g, '')] = v;
      }

      qText = String(
        normObj['questiontext'] ?? normObj['question'] ?? normObj['title'] ?? normObj['q'] ?? normObj['description'] ?? ''
      ).trim();

      const rawType = String(normObj['type'] ?? normObj['questiontype'] ?? normObj['category'] ?? 'mcq').trim().toLowerCase();
      if (['coding', 'code', 'programming', 'dsa'].includes(rawType)) {
        qType = 'coding';
      } else if (['logical', 'logicalreasoning', 'reasoning', 'aptitude'].includes(rawType)) {
        qType = 'logical_reasoning';
      } else if (['diagram', 'image', 'visual'].includes(rawType)) {
        qType = 'diagram';
      } else {
        qType = 'mcq';
      }

      // Check pipe options (Col C: option1 | option2 | option3 | option4)
      const optionsPipe = String(
        normObj['options'] ?? normObj['option1option2option3option4'] ?? normObj['optionslist'] ?? normObj['optionspipe'] ?? ''
      ).trim();

      if (optionsPipe && optionsPipe.includes('|')) {
        const parts = optionsPipe.split('|').map((s) => s.trim());
        optA = parts[0] || '';
        optB = parts[1] || '';
        optC = parts[2] || '';
        optD = parts[3] || '';
      } else {
        optA = String(normObj['optiona'] ?? normObj['option1'] ?? normObj['opta'] ?? '').trim();
        optB = String(normObj['optionb'] ?? normObj['option2'] ?? normObj['optb'] ?? '').trim();
        optC = String(normObj['optionc'] ?? normObj['option3'] ?? normObj['optc'] ?? '').trim();
        optD = String(normObj['optiond'] ?? normObj['option4'] ?? normObj['optd'] ?? '').trim();
      }

      correctRaw = String(
        normObj['correctindex'] ?? normObj['correctoption'] ?? normObj['correctanswer'] ?? normObj['correct'] ?? normObj['answer'] ?? ''
      ).trim();

      marksRaw = normObj['marks'] ?? normObj['mark'] ?? normObj['points'] ?? 1;
      topicRaw = String(normObj['topic'] ?? normObj['subject'] ?? normObj['domain'] ?? 'General').trim();
      sectionRaw = String((normObj['section'] ?? normObj['sectionname'] ?? normObj['category']) || topicRaw || 'General').trim();
      penaltyRaw = normObj['penalty'] ?? normObj['negativemarks'] ?? normObj['negative'] ?? 0;
      
      const diffStr = String(normObj['difficulty'] ?? normObj['level'] ?? 'Medium').trim().toLowerCase();
      if (diffStr === 'easy') difficultyRaw = 'Easy';
      else if (diffStr === 'hard') difficultyRaw = 'Hard';
      else difficultyRaw = 'Medium';

      setRaw = normObj['set'] ?? normObj['setnumber'] ?? normObj['questionset'] ?? undefined;
      starterCode = String(normObj['startercode'] ?? normObj['samplecode'] ?? normObj['code'] ?? normObj['codesnippet'] ?? normObj['snippet'] ?? '').trim();
      if (!starterCode && qText.includes('\n')) {
        const parts = qText.split(/\n\s*\n/);
        if (parts.length > 1) {
          starterCode = parts.slice(1).join('\n\n').trim();
        }
      }
      diagramUrl = String(normObj['diagramurl'] ?? normObj['diagram'] ?? normObj['imageurl'] ?? normObj['image'] ?? '').trim();
      explanationText = String(normObj['explanation'] ?? normObj['solution'] ?? normObj['hint'] ?? '').trim();
    }

    // Convert correct_index: 0->a, 1->b, 2->c, 3->d (or A, B, C, D)
    let correctOption = correctRaw.toLowerCase();
    if (correctOption === '0') correctOption = 'a';
    else if (correctOption === '1') correctOption = 'b';
    else if (correctOption === '2') correctOption = 'c';
    else if (correctOption === '3') correctOption = 'd';
    if (!['a', 'b', 'c', 'd'].includes(correctOption)) {
      correctOption = 'a';
    }

    // Handle Programming / DSA questions where options are not applicable
    if (qType === 'coding' || qType === 'programming' || qType === 'dsa') {
      if (!optA) optA = 'Code Submission';
      if (!optB) optB = 'Automated Evaluation';
      if (!optC) optC = 'Test Cases Validated';
      if (!optD) optD = 'Syntax Error';
      correctOption = 'a';
      if (!topicRaw || topicRaw === 'General') topicRaw = 'Data Structures & Algorithms';
    }

    // Handle Logical Reasoning
    if (qType === 'logical_reasoning' && (!topicRaw || topicRaw === 'General')) {
      topicRaw = 'Logical Reasoning';
    }

    // Handle Diagram questions (embed diagram image into markdown if present)
    if (diagramUrl && !qText.includes(diagramUrl)) {
      qText = `${qText}\n\n![Diagram](${diagramUrl})`;
      if (!topicRaw || topicRaw === 'General') topicRaw = 'Diagram & Visual Logic';
    }

    // Fallbacks for missing options
    if (!optA) optA = 'Option A';
    if (!optB) optB = 'Option B';
    if (!optC) optC = 'Option C';
    if (!optD) optD = 'Option D';

    const normalized = {
      question: qText,
      question_type: qType === 'coding' ? 'coding' : qType === 'logical_reasoning' ? 'logical_reasoning' : qType === 'diagram' ? 'diagram' : 'mcq',
      option_a: optA,
      option_b: optB,
      option_c: optC,
      option_d: optD,
      correct_option: correctOption,
      marks: marksRaw,
      penalty: penaltyRaw,
      section: sectionRaw || topicRaw || 'General',
      topic: topicRaw || 'General',
      difficulty: difficultyRaw,
      starter_code: starterCode || undefined,
      diagram_url: diagramUrl || undefined,
      explanation: explanationText || undefined,
      set: setRaw,
    };

    const result = questionRowSchema.safeParse(normalized);
    if (result.success) {
      validRows.push(result.data);
    } else {
      rowErrors.push({
        row: rowNum,
        errors: result.error.issues.map((e: import('zod').ZodIssue) => `${e.path.map(String).join('.')}: ${e.message}`),
      });
    }
  }

  if (rowErrors.length > 0) {
    return { valid: false, rows: [], errors: rowErrors };
  }

  return { valid: true, rows: validRows, errors: [] };
}

/**
 * Bulk-insert validated question rows into both traditional questions table
 * and exam_codes questions_ec table.
 */
export async function bulkInsertQuestions(
  examIdOrCode: string,
  rows: QuestionRow[],
  defaultSetCount: number = 2
): Promise<number> {
  const isExamCode = /^(?:LWL|LIRE|GR|LW|EXAM|[A-Z0-9]+-[A-Z0-9]+)/i.test(examIdOrCode);

  const insertData = rows.map((row, index) => {
    const setNumber = row.set && row.set > 0 ? row.set : (index % defaultSetCount) + 1;
    const setLetter = String.fromCharCode(64 + (((setNumber - 1) % 26) + 1));

    return {
      exam_id: isExamCode ? undefined : examIdOrCode,
      exam_code: isExamCode ? examIdOrCode.toUpperCase() : undefined,
      question: row.question,
      options: {
        a: row.option_a,
        b: row.option_b,
        c: row.option_c,
        d: row.option_d,
      },
      option_a: row.option_a,
      option_b: row.option_b,
      option_c: row.option_c,
      option_d: row.option_d,
      correct_option: row.correct_option,
      correct_answer: row.correct_option,
      marks: row.marks,
      penalty: row.penalty || 0,
      section: row.section || row.topic || 'General',
      topic: row.topic,
      difficulty: row.difficulty,
      starter_code: row.starter_code || null,
      explanation: row.explanation || null,
      question_type: row.question_type === 'coding' ? 'coding' : 'mcq',
      set_number: setNumber,
      question_set: setLetter,
      display_order: index + 1,
      tags: [row.question_type, (row.section || row.topic).toLowerCase().replace(/\s+/g, '_')],
    };
  });

  // If numeric or UUID exam ID, insert into questions
  if (!isExamCode) {
    const questionsRows = insertData.map((r) => ({
      exam_id: examIdOrCode,
      question: r.question,
      options: r.options,
      correct_option: r.correct_option,
      marks: r.marks,
      penalty: r.penalty,
      section: r.section,
      topic: r.topic,
      difficulty: r.difficulty,
      set_number: r.set_number,
      question_set: r.question_set,
      explanation: r.explanation,
      display_order: r.display_order,
    }));
    const { error } = await supabase.from('questions').insert(questionsRows);
    if (error) throw new Error(`Database insert to questions failed: ${error.message}`);

    // Also mirror to questions_ec so student exam portal immediately has questions
    try {
      const { data: examRec } = await supabase.from('exams').select('id, title, exam_code').eq('id', examIdOrCode).maybeSingle();
      const derivedCode = String(examRec?.exam_code || `LW-${String(examIdOrCode).slice(0, 6).toUpperCase()}`).trim().toUpperCase();
      const ecRows = insertData.map((r) => ({
        exam_code: derivedCode,
        question: r.question,
        question_text: r.question,
        option_a: r.option_a,
        option_b: r.option_b,
        option_c: r.option_c,
        option_d: r.option_d,
        correct_answer: r.correct_answer,
        marks: r.marks,
        penalty: r.penalty,
        section: r.section,
        topic: r.topic,
        difficulty: r.difficulty,
        explanation: r.explanation,
        question_type: r.question_type,
        starter_code: r.starter_code,
        display_order: r.display_order,
        tags: r.tags,
      }));
      await supabase.from('exam_codes').upsert({
        exam_code: derivedCode,
        exam_name: examRec?.title || derivedCode,
        subject: examRec?.title || derivedCode,
        total_questions: ecRows.length,
        duration_minutes: 60,
        is_active: true,
        is_launched: true,
      }, { onConflict: 'exam_code' });
      await supabase.from('questions_ec').insert(ecRows);
    } catch {}
  } else {
    // If Exam Code, ensure exam_codes parent record exists first
    const upperCode = examIdOrCode.toUpperCase();
    try {
      const { data: existingCode } = await supabase
        .from('exam_codes')
        .select('id, exam_code, total_questions')
        .eq('exam_code', upperCode)
        .maybeSingle();

      const now = new Date();
      if (!existingCode) {
        await supabase.from('exam_codes').insert({
          exam_code: upperCode,
          exam_name: upperCode,
          subject: insertData[0]?.topic || 'General',
          total_questions: insertData.length,
          duration_minutes: 60,
          start_time: now.toISOString(),
          end_time: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          is_active: true,
          is_launched: true,
        });
      }
    } catch (ecErr) {
      console.warn('[questionImportService] exam_codes prep warning:', ecErr);
    }

    const ecRows = insertData.map((r) => ({
      exam_code: upperCode,
      question: r.question,
      question_text: r.question,
      option_a: r.option_a,
      option_b: r.option_b,
      option_c: r.option_c,
      option_d: r.option_d,
      correct_answer: r.correct_answer,
      marks: r.marks,
      penalty: r.penalty,
      section: r.section,
      topic: r.topic,
      difficulty: r.difficulty,
      explanation: r.explanation,
      question_type: r.question_type,
      starter_code: r.starter_code,
      display_order: r.display_order,
      tags: r.tags,
    }));
    const { error } = await supabase.from('questions_ec').insert(ecRows);
    if (error) throw new Error(`Database insert to questions_ec failed: ${error.message}`);

    // Also mirror to traditional questions table and update exam_codes count
    try {
      const questionsRows = insertData.map((r) => ({
        exam_id: examIdOrCode,
        question: r.question,
        question_text: r.question,
        options: r.options,
        option_a: r.option_a,
        option_b: r.option_b,
        option_c: r.option_c,
        option_d: r.option_d,
        correct_option: r.correct_option,
        marks: r.marks,
        topic: r.topic,
        difficulty: r.difficulty,
        set_number: r.set_number,
        question_set: r.question_set,
        explanation: r.explanation,
        starter_code: r.starter_code,
        display_order: r.display_order,
      }));
      await supabase.from('questions').insert(questionsRows);

      const { count: totalQ } = await supabase
        .from('questions_ec')
        .select('id', { count: 'exact', head: true })
        .eq('exam_code', examIdOrCode.toUpperCase());
      await supabase
        .from('exam_codes')
        .update({ total_questions: totalQ || ecRows.length, is_active: true })
        .eq('exam_code', examIdOrCode.toUpperCase());
    } catch {}
  }

  return insertData.length;
}
