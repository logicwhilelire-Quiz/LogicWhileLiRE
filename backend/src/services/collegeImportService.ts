import * as XLSX from 'xlsx';
import { supabase } from '../db/supabase';

export interface CollegeImportRow {
  college_name: string;
  college_code: string;
  city?: string;
  state?: string;
  contact_email?: string;
  contact_phone?: string;
  registration_enabled?: boolean;
}

export interface CollegeImportResult {
  valid: boolean;
  total_rows: number;
  inserted_count: number;
  skipped_count: number;
  errors: Array<{ row: number; college_code?: string; error: string }>;
  colleges: Array<{ id: number; college_name: string; college_code: string }>;
}

/**
 * Parses and validates CSV or XLSX buffer for bulk college import.
 */
export function parseAndValidateCollegeFile(buffer: Buffer): {
  validRows: CollegeImportRow[];
  errors: Array<{ row: number; college_code?: string; error: string }>;
} {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: 'buffer' });
  } catch {
    return { validRows: [], errors: [{ row: 0, error: 'Could not read spreadsheet file. Please upload a valid .xlsx or .csv file.' }] };
  }

  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { validRows: [], errors: [{ row: 0, error: 'Empty file: No sheets found.' }] };
  }

  const sheet = wb.Sheets[sheetName];
  const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (rawRows.length === 0) {
    return { validRows: [], errors: [{ row: 0, error: 'The uploaded spreadsheet contains no data rows.' }] };
  }

  const validRows: CollegeImportRow[] = [];
  const errors: Array<{ row: number; college_code?: string; error: string }> = [];
  const seenCodes = new Set<string>();

  rawRows.forEach((raw, idx) => {
    const rowNum = idx + 2;

    const normalized: Record<string, string> = {};
    for (const key of Object.keys(raw)) {
      const cleanKey = key.toLowerCase().replace(/[\s_\-]+/g, '');
      normalized[cleanKey] = String(raw[key] ?? '').trim();
    }

    const collegeName = normalized['collegename'] || normalized['name'] || normalized['college'] || normalized['institution'] || '';
    const collegeCode = (normalized['collegecode'] || normalized['code'] || normalized['shortname'] || '').toUpperCase();
    const city = normalized['city'] || normalized['district'] || normalized['location'] || 'Vijayawada';
    const state = normalized['state'] || 'Andhra Pradesh';
    const contactEmail = normalized['contactemail'] || normalized['email'] || '';
    const contactPhone = normalized['contactphone'] || normalized['phone'] || normalized['mobile'] || '';
    const regRaw = normalized['registrationenabled'] || normalized['registration'] || normalized['status'] || 'true';
    const registrationEnabled = !['false', '0', 'no', 'disabled'].includes(regRaw.toLowerCase());

    if (!collegeName || collegeName.length < 2) {
      errors.push({ row: rowNum, college_code: collegeCode, error: 'College Name is required and must be at least 2 characters.' });
      return;
    }

    if (!collegeCode || collegeCode.length < 2) {
      errors.push({ row: rowNum, college_code: collegeCode, error: 'College Code is required and must be at least 2 characters.' });
      return;
    }

    if (seenCodes.has(collegeCode)) {
      errors.push({ row: rowNum, college_code: collegeCode, error: `Duplicate college code in spreadsheet: ${collegeCode}` });
      return;
    }
    seenCodes.add(collegeCode);

    validRows.push({
      college_name: collegeName,
      college_code: collegeCode,
      city,
      state,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      registration_enabled: registrationEnabled,
    });
  });

  return { validRows, errors };
}

/**
 * Bulk-inserts validated colleges into Supabase.
 */
export async function bulkInsertColleges(
  rows: CollegeImportRow[]
): Promise<CollegeImportResult> {
  const result: CollegeImportResult = {
    valid: true,
    total_rows: rows.length,
    inserted_count: 0,
    skipped_count: 0,
    errors: [],
    colleges: [],
  };

  if (rows.length === 0) return result;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    try {
      // Check if college_code already exists
      const { data: existing } = await supabase
        .from('colleges')
        .select('id, college_name, college_code')
        .eq('college_code', r.college_code)
        .maybeSingle();

      if (existing) {
        // Update existing college details
        const { data: updated, error: updateErr } = await supabase
          .from('colleges')
          .update({
            college_name: r.college_name,
            city: r.city,
            state: r.state,
            contact_email: r.contact_email,
            contact_phone: r.contact_phone,
            registration_enabled: r.registration_enabled,
            is_active: true,
          })
          .eq('id', existing.id)
          .select('id, college_name, college_code')
          .single();

        if (updateErr) {
          result.errors.push({ row: i + 2, college_code: r.college_code, error: updateErr.message });
          result.skipped_count++;
        } else if (updated) {
          result.inserted_count++;
          result.colleges.push(updated);
        }
      } else {
        // Insert new college
        const { data: inserted, error: insertErr } = await supabase
          .from('colleges')
          .insert({
            college_name: r.college_name,
            college_code: r.college_code,
            city: r.city,
            state: r.state,
            contact_email: r.contact_email,
            contact_phone: r.contact_phone,
            registration_enabled: r.registration_enabled,
            is_active: true,
          })
          .select('id, college_name, college_code')
          .single();

        if (insertErr) {
          result.errors.push({ row: i + 2, college_code: r.college_code, error: insertErr.message });
          result.skipped_count++;
        } else if (inserted) {
          result.inserted_count++;
          result.colleges.push(inserted);
        }
      }
    } catch (err: any) {
      result.errors.push({ row: i + 2, college_code: r.college_code, error: err.message || 'Insert error' });
      result.skipped_count++;
    }
  }

  result.valid = result.errors.length === 0;
  return result;
}
