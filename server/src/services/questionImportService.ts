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
  const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (rawRows.length === 0) {
    return { valid: false, rows: [], errors: [{ row: 0, errors: ['The sheet is empty. Please add question rows.'] }] };
  }

  const validRows: QuestionRow[] = [];
  const rowErrors: RowError[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const rowNum = i + 2; // 1-indexed + header row
    const raw = rawRows[i];

    // Normalize column names: trim whitespace, lowercase
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw)) {
      const cleanKey = key.trim().toLowerCase().replace(/\s+/g, '_');
      if (['set', 'set_number', 'question_set', 'questionset', 'set_no'].includes(cleanKey)) {
        normalized['set'] = value;
      } else {
        normalized[cleanKey] = value;
      }
    }

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
