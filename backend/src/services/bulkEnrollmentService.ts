import * as XLSX from 'xlsx';
import { supabase } from '../db/supabase';
import { v4 as uuidv4 } from 'uuid';

export interface BulkEnrollRow {
  name: string;
  hall_ticket: string;
  mobile: string;
  email: string;
}

export interface BulkEnrollResult {
  valid: boolean;
  total_rows: number;
  inserted_count: number;
  skipped_count: number;
  errors: Array<{ row: number; hall_ticket?: string; error: string }>;
  enrolled: Array<{ id: string; name: string; hall_ticket: string; email: string }>;
}

const HALL_TICKET_REGEX = /^[A-Za-z0-9\-_]+$/;
const MOBILE_REGEX = /^\+?[0-9]{7,15}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Parses and validates CSV or XLSX buffer for roster pre-enrollment.
 */
export function parseAndValidateEnrollmentFile(buffer: Buffer): {
  validRows: BulkEnrollRow[];
  errors: Array<{ row: number; hall_ticket?: string; error: string }>;
} {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { validRows: [], errors: [{ row: 0, error: 'Empty file: No sheets found.' }] };
  }

  const sheet = wb.Sheets[sheetName];
  const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (rawRows.length === 0) {
    return { validRows: [], errors: [{ row: 0, error: 'The uploaded sheet contains no data rows.' }] };
  }

  const validRows: BulkEnrollRow[] = [];
  const errors: Array<{ row: number; hall_ticket?: string; error: string }> = [];
  const seenHallTickets = new Set<string>();
  const seenEmails = new Set<string>();

  rawRows.forEach((raw, idx) => {
    const rowNum = idx + 2; // header is row 1

    // Normalize keys (case-insensitive, remove spaces/underscores)
    const normalized: Record<string, string> = {};
    for (const key of Object.keys(raw)) {
      const cleanKey = key.toLowerCase().replace(/[\s_\-]+/g, '');
      normalized[cleanKey] = String(raw[key] ?? '').trim();
    }

    const name = normalized['name'] || normalized['fullname'] || normalized['candidatename'] || '';
    const hallTicket =
      normalized['hallticket'] ||
      normalized['hallticketnumber'] ||
      normalized['rollnumber'] ||
      normalized['rollno'] ||
      normalized['studentid'] ||
      '';
    const mobile =
      normalized['mobile'] ||
      normalized['mobilenumber'] ||
      normalized['phone'] ||
      normalized['contact'] ||
      '';
    const email = normalized['email'] || normalized['emailaddress'] || '';

    // Field-level validation
    if (!name || name.length < 2) {
      errors.push({ row: rowNum, hall_ticket: hallTicket, error: 'Name must be at least 2 characters.' });
      return;
    }
    if (!hallTicket || hallTicket.length < 3 || hallTicket.length > 30 || !HALL_TICKET_REGEX.test(hallTicket)) {
      errors.push({
        row: rowNum,
        hall_ticket: hallTicket,
        error: 'Hall ticket must be 3-30 alphanumeric characters (hyphens and underscores allowed).',
      });
      return;
    }
    if (!mobile || !MOBILE_REGEX.test(mobile.replace(/[\s\-]/g, ''))) {
      errors.push({ row: rowNum, hall_ticket: hallTicket, error: `Invalid mobile number: "${mobile}".` });
      return;
    }
    if (!email || !EMAIL_REGEX.test(email)) {
      errors.push({ row: rowNum, hall_ticket: hallTicket, error: `Invalid email address: "${email}".` });
      return;
    }

    // In-file duplicate detection
    const htLower = hallTicket.toLowerCase();
    if (seenHallTickets.has(htLower)) {
      errors.push({ row: rowNum, hall_ticket: hallTicket, error: `Duplicate hall ticket "${hallTicket}" in file.` });
      return;
    }
    seenHallTickets.add(htLower);

    const emailLower = email.toLowerCase();
    if (seenEmails.has(emailLower)) {
      errors.push({ row: rowNum, hall_ticket: hallTicket, error: `Duplicate email "${email}" in file.` });
      return;
    }
    seenEmails.add(emailLower);

    validRows.push({
      name,
      hall_ticket: hallTicket,
      mobile: mobile.replace(/[\s\-]/g, ''),
      email: emailLower,
    });
  });

  return { validRows, errors };
}

/**
 * Bulk inserts validated participant rows for an assessment.
 */
export async function bulkInsertParticipants(
  examId: string,
  rows: BulkEnrollRow[]
): Promise<{
  inserted: Array<{ id: string; name: string; hall_ticket: string; email: string }>;
  skipped: Array<{ hall_ticket: string; reason: string }>;
}> {
  // Query existing participants for this exam
  const { data: existing } = await supabase
    .from('participants')
    .select('hall_ticket, email')
    .eq('exam_id', examId);

  const existingHT = new Set((existing || []).map((p: any) => p.hall_ticket.toLowerCase()));
  const existingEmails = new Set((existing || []).map((p: any) => p.email.toLowerCase()));

  const toInsert: any[] = [];
  const skipped: Array<{ hall_ticket: string; reason: string }> = [];

  for (const row of rows) {
    if (existingHT.has(row.hall_ticket.toLowerCase())) {
      skipped.push({ hall_ticket: row.hall_ticket, reason: 'Already enrolled in this exam.' });
      continue;
    }
    if (existingEmails.has(row.email.toLowerCase())) {
      skipped.push({ hall_ticket: row.hall_ticket, reason: `Email "${row.email}" already registered.` });
      continue;
    }

    toInsert.push({
      id: uuidv4(),
      exam_id: examId,
      name: row.name,
      hall_ticket: row.hall_ticket,
      mobile: row.mobile,
      email: row.email,
      otp_verified: true, // Pre-verified roster registration
      enrolled_at: new Date().toISOString(),
    });
  }

  if (toInsert.length === 0) {
    return { inserted: [], skipped };
  }

  const { data: insertedData, error } = await supabase
    .from('participants')
    .insert(toInsert)
    .select('id, name, hall_ticket, email');

  if (error) {
    throw new Error(`Database bulk insert failed: ${error.message}`);
  }

  return {
    inserted: (insertedData || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      hall_ticket: p.hall_ticket,
      email: p.email,
    })),
    skipped,
  };
}
