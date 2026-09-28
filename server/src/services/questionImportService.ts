import * as XLSX from 'xlsx';
import { z } from 'zod';
import { supabase } from '../db/supabase';

const questionRowSchema = z.object({
  question: z.string().min(1, 'Question text is required'),
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
  topic: z.string().optional().default('General'),
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

type QuestionRow = z.infer<typeof questionRowSchema>;

interface RowError {
  row: number;
  errors: string[];
}

interface ParseResult {
  valid: boolean;
  rows: QuestionRow[];
  errors: RowError[];
}

/**
 * Parse an Excel buffer and validate every row.
 * Supports:
 * 1. GROWRAN 1-Click 5-Column Format:
 *    Column A: question_text
 *    Column B: type (mcq/code)
 *    Column C: option1 | option2 | option3 | option4
 *    Column D: correct_index (0, 1, 2, 3 or A, B, C, D)
 *    Column E: marks
 * 2. Multi-column format (question, option_a..d, correct_option, marks, topic, set)
 * Returns all rows on success, or row-indexed errors on any failure.
 * Does NOT partially import — all-or-nothing.
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
  const firstRowStr = firstRow.map(c => String(c).toLowerCase().trim()).join(' ');
  const hasHeader = firstRowStr.includes('question') ||
                    firstRowStr.includes('option') ||
                    firstRowStr.includes('type') ||
                    firstRowStr.includes('marks') ||
                    firstRowStr.includes('correct');

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
    let topicRaw = 'General';
    let setRaw: unknown = undefined;
    let qType = 'mcq';

    if (Array.isArray(raw)) {
      // Positional array
      qText = String(raw[0] || '').trim();
      qType = String(raw[1] || 'mcq').trim().toLowerCase();
      const colC = String(raw[2] || '').trim();
      correctRaw = String(raw[3] !== undefined ? raw[3] : '').trim();
      marksRaw = raw[4] !== undefined && raw[4] !== '' ? raw[4] : 1;

      if (colC.includes('|')) {
        const parts = colC.split('|').map(s => s.trim());
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
        normObj['questiontext'] ?? normObj['question'] ?? normObj['title'] ?? normObj['q'] ?? ''
      ).trim();

      qType = String(normObj['type'] ?? normObj['questiontype'] ?? 'mcq').trim().toLowerCase();

      // Check pipe options (Col C: option1 | option2 | option3 | option4)
      const optionsPipe = String(
        normObj['options'] ?? normObj['option1option2option3option4'] ?? normObj['optionslist'] ?? normObj['optionspipe'] ?? ''
      ).trim();

      if (optionsPipe && optionsPipe.includes('|')) {
        const parts = optionsPipe.split('|').map(s => s.trim());
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
        normObj['correctindex'] ?? normObj['correctoption'] ?? normObj['correctanswer'] ?? normObj['correct'] ?? ''
      ).trim();

      marksRaw = normObj['marks'] ?? normObj['mark'] ?? normObj['points'] ?? 1;
      topicRaw = String(normObj['topic'] ?? normObj['subject'] ?? 'General').trim();
      setRaw = normObj['set'] ?? normObj['setnumber'] ?? normObj['questionset'] ?? undefined;
    }

    // Convert correct_index: 0->a, 1->b, 2->c, 3->d (or A, B, C, D)
    let correctOption = correctRaw.toLowerCase();
    if (correctOption === '0') correctOption = 'a';
    else if (correctOption === '1') correctOption = 'b';
    else if (correctOption === '2') correctOption = 'c';
    else if (correctOption === '3') correctOption = 'd';

    // Handle code question type where options may be blank
    if (qType === 'code' && (!optA || !optB)) {
      optA = 'Submission';
      optB = '-';
      optC = '-';
      optD = '-';
      correctOption = 'a';
    }

    const normalized = {
      question: qText,
      option_a: optA,
      option_b: optB,
      option_c: optC,
      option_d: optD,
      correct_option: correctOption,
      marks: marksRaw,
      topic: topicRaw || 'General',
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
 * Bulk-insert validated question rows into the questions table.
 * Uses parameterized Supabase client inserts (no raw SQL).
 * Auto-distributes questions evenly across N sets if not specified.
 */
export async function bulkInsertQuestions(
  examId: string,
  rows: QuestionRow[],
  defaultSetCount: number = 2
): Promise<number> {
  const anySetSpecified = rows.some((r) => r.set !== undefined && r.set > 0);

  const insertData = rows.map((row, index) => {
    // If tagged into sets, use tagged set_number.
    // If not specified, auto-distribute evenly across defaultSetCount sets.
    const setNumber = row.set && row.set > 0
      ? row.set
      : anySetSpecified
        ? 1
        : (index % defaultSetCount) + 1;

    const setLetter = String.fromCharCode(64 + (((setNumber - 1) % 26) + 1));

    return {
      exam_id: examId,
      question: row.question,
      options: {
        a: row.option_a,
        b: row.option_b,
        c: row.option_c,
        d: row.option_d,
      },
      correct_option: row.correct_option,
      marks: row.marks,
      topic: row.topic,
      set_number: setNumber,
      question_set: setLetter,
    };
  });

  const { error } = await supabase.from('questions').insert(insertData);
  if (error) throw new Error(`Database insert failed: ${error.message}`);

  return insertData.length;
}
