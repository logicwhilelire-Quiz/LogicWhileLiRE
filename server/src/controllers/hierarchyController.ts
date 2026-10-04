import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getAdminJwtSecret } from '../middleware/adminAuth';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../db/supabase';
import { sendWelcomeEmail } from '../services/emailService';
import { executeSystemBackup, BACKUP_DIR } from '../services/backupService';
import { executeGoogleDriveBackup, getBackupHistoryList } from '../services/driveBackupService';
import { getGoogleDrivePublicStatus } from '../services/googleDriveService';
import {
  generateTotpSecret,
  generateTotpQrDataUrl,
  verifyTotpCode,
  encryptTotpSecret,
  isEncryptedTotpSecret,
  generateBackupCodes,
} from '../utils/totp';
import { recordAuditLog } from '../middleware/auditLog';
import { isStrongPassword } from '../middleware/validate';

// ─────────────────────────────────────────────────────────────────────────────
// DATA MODEL HIERARCHY: College -> Academic Year -> Cohort -> Section -> Batch
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Helper to extract college_id from request (considering inspector college scoping)
 */
function resolveCollegeScope(req: Request): { isScoped: boolean; collegeId: number | string | null } {
  const admin = req.admin;
  if (!admin) return { isScoped: false, collegeId: null };

  const isSuper = admin.role === 'super_admin' || (admin.role as string) === 'admin';
  if (!isSuper && admin.college_id) {
    return { isScoped: true, collegeId: admin.college_id };
  }

  // Super admin can specify college_id via query or body
  const specified = req.query.college_id || req.body?.college_id;
  return { isScoped: false, collegeId: specified ? String(specified) : null };
}

// ── 1. ACADEMIC YEARS ──

export async function listAcademicYears(req: Request, res: Response): Promise<void> {
  const { isScoped, collegeId } = resolveCollegeScope(req);
  let query = supabase.from('academic_years').select('*').order('year', { ascending: false });

  if (isScoped && collegeId) {
    query = query.eq('college_id', collegeId);
  } else if (collegeId) {
    query = query.eq('college_id', collegeId);
  }

  const { data, error } = await query;
  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }
  const enriched = (data || []).map((ay: any) => ({
    ...ay,
    year_name: ay.year || ay.year_name,
    is_current: Boolean(ay.is_active),
  }));
  res.json({ success: true, academic_years: enriched });
}

export async function createAcademicYear(req: Request, res: Response): Promise<void> {
  const { college_id, year, year_name, start_date, end_date, is_active = true } = req.body;
  const { isScoped, collegeId: scopedCollegeId } = resolveCollegeScope(req);

  const effectiveCollegeId = isScoped ? scopedCollegeId : college_id;
  const effectiveYear = year || year_name;
  if (!effectiveCollegeId || !effectiveYear) {
    res.status(400).json({ success: false, error: 'college_id and year (e.g. 2025-2026) are required' });
    return;
  }

  const id = `ay-${String(effectiveCollegeId).toLowerCase()}-${String(effectiveYear).replace(/[^a-zA-Z0-9]/g, '-')}`;
  const newRecord = {
    id,
    college_id: effectiveCollegeId,
    year: String(effectiveYear).trim(),
    start_date: start_date || null,
    end_date: end_date || null,
    is_active: Boolean(is_active),
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('academic_years').insert(newRecord).select().single();
  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }
  res.status(201).json({
    success: true,
    academic_year: {
      ...data,
      year_name: data.year || data.year_name,
      is_current: Boolean(data.is_active),
    },
  });
}

export async function updateAcademicYear(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { year, year_name, start_date, end_date, is_active } = req.body;

  const updatePayload: Record<string, unknown> = {};
  const effectiveYear = year !== undefined ? year : year_name;
  if (effectiveYear !== undefined) updatePayload.year = String(effectiveYear).trim();
  if (start_date !== undefined) updatePayload.start_date = start_date;
  if (end_date !== undefined) updatePayload.end_date = end_date;
  if (is_active !== undefined) updatePayload.is_active = Boolean(is_active);

  const { data, error } = await supabase
    .from('academic_years')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    res.status(404).json({ success: false, error: 'Academic year not found' });
    return;
  }
  res.json({
    success: true,
    academic_year: {
      ...data,
      year_name: data.year || data.year_name,
      is_current: Boolean(data.is_active),
    },
  });
}

export async function deleteAcademicYear(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { error } = await supabase.from('academic_years').delete().eq('id', id);
  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }
  res.json({ success: true, message: 'Academic year deleted' });
}

// ── 2. COHORTS (YOP COHORTS) ──

export async function listCohorts(req: Request, res: Response): Promise<void> {
  const { isScoped, collegeId } = resolveCollegeScope(req);
  const { academic_year_id } = req.query;

  let query = supabase.from('cohorts').select('*').order('yop', { ascending: true });
  if (isScoped && collegeId) {
    query = query.eq('college_id', collegeId);
  } else if (collegeId) {
    query = query.eq('college_id', collegeId);
  }
  if (academic_year_id) {
    query = query.eq('academic_year_id', String(academic_year_id));
  }

  const { data, error } = await query;
  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }
  const enriched = (data || []).map((c: any) => ({
    ...c,
    cohort_name: c.name || c.cohort_name,
  }));
  res.json({ success: true, cohorts: enriched });
}

export async function createCohort(req: Request, res: Response): Promise<void> {
  const { college_id, academic_year_id, yop, name, cohort_name, degree, branch, is_active = true } = req.body;
  const { isScoped, collegeId: scopedCollegeId } = resolveCollegeScope(req);

  const effectiveCollegeId = isScoped ? scopedCollegeId : college_id;
  const effectiveName = name || cohort_name;
  if (!effectiveCollegeId || !yop) {
    res.status(400).json({ success: false, error: 'college_id and yop (year of passing, e.g. 2026) are required' });
    return;
  }

  const numYop = parseInt(String(yop), 10);
  const id = `coh-${String(effectiveCollegeId).toLowerCase()}-${numYop}`;
  const record = {
    id,
    college_id: effectiveCollegeId,
    academic_year_id: academic_year_id || null,
    yop: numYop,
    name: effectiveName ? String(effectiveName).trim() : `Class of ${numYop}`,
    is_active: Boolean(is_active),
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('cohorts').insert(record).select().single();
  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }
  res.status(201).json({
    success: true,
    cohort: {
      ...data,
      cohort_name: data.name || data.cohort_name,
    },
  });
}

export async function updateCohort(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { name, cohort_name, yop, academic_year_id, is_active } = req.body;

  const updatePayload: Record<string, unknown> = {};
  const effectiveName = name !== undefined ? name : cohort_name;
  if (effectiveName !== undefined) updatePayload.name = String(effectiveName).trim();
  if (yop !== undefined) updatePayload.yop = parseInt(String(yop), 10);
  if (academic_year_id !== undefined) updatePayload.academic_year_id = academic_year_id;
  if (is_active !== undefined) updatePayload.is_active = Boolean(is_active);

  const { data, error } = await supabase.from('cohorts').update(updatePayload).eq('id', id).select().single();
  if (error || !data) {
    res.status(404).json({ success: false, error: 'Cohort not found' });
    return;
  }
  res.json({
    success: true,
    cohort: {
      ...data,
      cohort_name: data.name || data.cohort_name,
    },
  });
}

export async function deleteCohort(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { error } = await supabase.from('cohorts').delete().eq('id', id);
  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }
  res.json({ success: true, message: 'Cohort deleted' });
}

// ── 3. SECTIONS ──

export async function listSections(req: Request, res: Response): Promise<void> {
  const { isScoped, collegeId } = resolveCollegeScope(req);
  const { cohort_id, academic_year_id } = req.query;

  let query = supabase.from('sections').select('*').order('name', { ascending: true });
  if (isScoped && collegeId) {
    query = query.eq('college_id', collegeId);
  } else if (collegeId) {
    query = query.eq('college_id', collegeId);
  }
  if (cohort_id) query = query.eq('cohort_id', String(cohort_id));
  if (academic_year_id) query = query.eq('academic_year_id', String(academic_year_id));

  const { data, error } = await query;
  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }
  const enriched = (data || []).map((sec: any) => ({
    ...sec,
    section_name: sec.name || sec.section_name,
  }));
  res.json({ success: true, sections: enriched });
}

export async function createSection(req: Request, res: Response): Promise<void> {
  const { college_id, academic_year_id, cohort_id, name, section_name, branch = 'CSE', is_active = true } = req.body;
  const { isScoped, collegeId: scopedCollegeId } = resolveCollegeScope(req);

  const effectiveCollegeId = isScoped ? scopedCollegeId : college_id;
  const effectiveName = name || section_name;
  if (!effectiveCollegeId || !effectiveName || !cohort_id) {
    res.status(400).json({ success: false, error: 'college_id, cohort_id, and name (e.g. A, B, C) are required' });
    return;
  }

  const cleanName = String(effectiveName).trim().toUpperCase();
  const id = `sec-${String(effectiveCollegeId).toLowerCase()}-${String(cohort_id).toLowerCase()}-${cleanName.toLowerCase()}`;
  const record = {
    id,
    college_id: effectiveCollegeId,
    academic_year_id: academic_year_id || null,
    cohort_id: String(cohort_id),
    name: cleanName,
    branch: String(branch).trim().toUpperCase(),
    is_active: Boolean(is_active),
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('sections').insert(record).select().single();
  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }
  res.status(201).json({
    success: true,
    section: {
      ...data,
      section_name: data.name || data.section_name,
    },
  });
}

export async function updateSection(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { name, section_name, branch, is_active } = req.body;

  const updatePayload: Record<string, unknown> = {};
  const effectiveName = name !== undefined ? name : section_name;
  if (effectiveName !== undefined) updatePayload.name = String(effectiveName).trim().toUpperCase();
  if (branch !== undefined) updatePayload.branch = String(branch).trim().toUpperCase();
  if (is_active !== undefined) updatePayload.is_active = Boolean(is_active);

  const { data, error } = await supabase.from('sections').update(updatePayload).eq('id', id).select().single();
  if (error || !data) {
    res.status(404).json({ success: false, error: 'Section not found' });
    return;
  }
  res.json({
    success: true,
    section: {
      ...data,
      section_name: data.name || data.section_name,
    },
  });
}

export async function deleteSection(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { error } = await supabase.from('sections').delete().eq('id', id);
  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }
  res.json({ success: true, message: 'Section deleted' });
}

// ── 4. BATCHES ──

export async function listBatches(req: Request, res: Response): Promise<void> {
  const { isScoped, collegeId } = resolveCollegeScope(req);
  const { section_id, cohort_id } = req.query;

  let query = supabase.from('batches').select('*').order('name', { ascending: true });
  if (isScoped && collegeId) {
    query = query.eq('college_id', collegeId);
  } else if (collegeId) {
    query = query.eq('college_id', collegeId);
  }
  if (section_id) query = query.eq('section_id', String(section_id));
  if (cohort_id) query = query.eq('cohort_id', String(cohort_id));

  const { data, error } = await query;
  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }
  const enriched = (data || []).map((bat: any) => ({
    ...bat,
    batch_name: bat.name || bat.batch_name,
  }));
  res.json({ success: true, batches: enriched });
}

export async function createBatch(req: Request, res: Response): Promise<void> {
  const { college_id, academic_year_id, cohort_id, section_id, name, batch_name, capacity = 40, is_active = true } = req.body;
  const { isScoped, collegeId: scopedCollegeId } = resolveCollegeScope(req);

  const effectiveCollegeId = isScoped ? scopedCollegeId : college_id;
  const effectiveName = name || batch_name;
  if (!effectiveCollegeId || !section_id || !effectiveName) {
    res.status(400).json({ success: false, error: 'college_id, section_id, and name (e.g. Batch 1) are required' });
    return;
  }

  const cleanName = String(effectiveName).trim();
  const id = `bat-${String(section_id).toLowerCase()}-${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  const record = {
    id,
    college_id: effectiveCollegeId,
    academic_year_id: academic_year_id || null,
    cohort_id: cohort_id || null,
    section_id: String(section_id),
    name: cleanName,
    capacity: Number(capacity) || 40,
    is_active: Boolean(is_active),
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('batches').insert(record).select().single();
  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }
  res.status(201).json({
    success: true,
    batch: {
      ...data,
      batch_name: data.name || data.batch_name,
    },
  });
}

export async function updateBatch(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { name, batch_name, capacity, is_active } = req.body;

  const updatePayload: Record<string, unknown> = {};
  const effectiveName = name !== undefined ? name : batch_name;
  if (effectiveName !== undefined) updatePayload.name = String(effectiveName).trim();
  if (capacity !== undefined) updatePayload.capacity = Number(capacity);
  if (is_active !== undefined) updatePayload.is_active = Boolean(is_active);

  const { data, error } = await supabase.from('batches').update(updatePayload).eq('id', id).select().single();
  if (error || !data) {
    res.status(404).json({ success: false, error: 'Batch not found' });
    return;
  }
  res.json({
    success: true,
    batch: {
      ...data,
      batch_name: data.name || data.batch_name,
    },
  });
}

export async function deleteBatch(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { error } = await supabase.from('batches').delete().eq('id', id);
  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }
  res.json({ success: true, message: 'Batch deleted' });
}

// ── 5. HIERARCHY OVERVIEW TREE (College -> Academic Year -> Cohort -> Section -> Batch) ──

export async function getHierarchyOverview(req: Request, res: Response): Promise<void> {
  const { isScoped, collegeId } = resolveCollegeScope(req);

  // Fetch all entities
  let collegesQuery = supabase.from('colleges').select('id, college_name, college_code, city, state, is_active');
  if (isScoped && collegeId) {
    collegesQuery = collegesQuery.eq('id', collegeId);
  } else if (collegeId) {
    collegesQuery = collegesQuery.eq('id', collegeId);
  }
  const { data: colleges } = await collegesQuery;

  let ayQuery = supabase.from('academic_years').select('*');
  let cohQuery = supabase.from('cohorts').select('*');
  let secQuery = supabase.from('sections').select('*');
  let batQuery = supabase.from('batches').select('*');

  if (collegeId) {
    ayQuery = ayQuery.eq('college_id', collegeId);
    cohQuery = cohQuery.eq('college_id', collegeId);
    secQuery = secQuery.eq('college_id', collegeId);
    batQuery = batQuery.eq('college_id', collegeId);
  }

  const [ays, cohs, secs, bats] = await Promise.all([
    ayQuery.then((r) => r.data || []),
    cohQuery.then((r) => r.data || []),
    secQuery.then((r) => r.data || []),
    batQuery.then((r) => r.data || []),
  ]);

  res.json({
    success: true,
    colleges: colleges || [],
    academic_years: ays,
    cohorts: cohs,
    sections: secs,
    batches: bats,
  });
}

// ── 6. STUDENT MANAGEMENT (Belongs to exactly one section and batch) ──

export async function listStudents(req: Request, res: Response): Promise<void> {
  const { isScoped, collegeId } = resolveCollegeScope(req);
  const { academic_year_id, cohort_id, section_id, batch_id, search } = req.query;

  let query = supabase
    .from('students')
    .select('id, name, first_name, last_name, email, roll_number, hall_ticket, college_id, college_name, academic_year_id, cohort_id, section_id, batch_id, section, batch, year_of_passing, is_active, is_blocked, must_change_password, created_at')
    .order('created_at', { ascending: false });

  if (isScoped && collegeId) {
    query = query.eq('college_id', collegeId);
  } else if (collegeId) {
    query = query.eq('college_id', collegeId);
  }
  if (academic_year_id) query = query.eq('academic_year_id', String(academic_year_id));
  if (cohort_id) query = query.eq('cohort_id', String(cohort_id));
  if (section_id) query = query.eq('section_id', String(section_id));
  if (batch_id) query = query.eq('batch_id', String(batch_id));

  const { data: students, error } = await query;
  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }

  let filtered = students || [];
  if (search) {
    const s = String(search).toLowerCase();
    filtered = filtered.filter(
      (st: any) =>
        (st.name || '').toLowerCase().includes(s) ||
        (st.email || '').toLowerCase().includes(s) ||
        (st.roll_number || '').toLowerCase().includes(s) ||
        (st.hall_ticket || '').toLowerCase().includes(s)
    );
  }

  res.json({ success: true, count: filtered.length, students: filtered });
}

export async function createStudent(req: Request, res: Response): Promise<void> {
  const {
    name,
    first_name,
    last_name,
    email,
    roll_number,
    hall_ticket,
    college_id,
    academic_year_id,
    cohort_id,
    section_id,
    batch_id,
    year_of_passing,
    branch_code = 'CSE',
    contact_number,
    mobile,
    password,
  } = req.body;

  const { isScoped, collegeId: scopedCollegeId } = resolveCollegeScope(req);
  const effectiveCollegeId = isScoped ? scopedCollegeId : college_id;

  if (!email || !roll_number || !effectiveCollegeId) {
    res.status(400).json({ success: false, error: 'email, roll_number, and college_id are required' });
    return;
  }

  // Exactly one section and batch required
  if (!section_id || !batch_id) {
    res.status(400).json({
      success: false,
      error: 'Data model policy violation: A student must belong to exactly one section and batch.',
      code: 'SECTION_BATCH_REQUIRED',
    });
    return;
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const cleanRoll = String(roll_number).trim().toUpperCase();
  const cleanHallTicket = hall_ticket ? String(hall_ticket).trim().toUpperCase() : cleanRoll;

  // Check duplicate email
  const { data: existing } = await supabase
    .from('students')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (existing) {
    res.status(409).json({ success: false, error: 'A student with this email already exists' });
    return;
  }

  // Generate temporary password if not provided
  const tempPassword = password || `Student#${Math.floor(100000 + Math.random() * 900000)}!`;
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  const studentId = uuidv4();
  const fullName = name ? String(name).trim() : `${first_name || ''} ${last_name || ''}`.trim() || cleanRoll;

  // Resolve section and batch names if possible
  const { data: secRec } = await supabase.from('sections').select('name').eq('id', section_id).maybeSingle();
  const { data: batRec } = await supabase.from('batches').select('name').eq('id', batch_id).maybeSingle();

  const newStudent = {
    id: studentId,
    name: fullName,
    first_name: first_name || fullName.split(' ')[0] || '',
    last_name: last_name || fullName.split(' ').slice(1).join(' ') || '',
    email: normalizedEmail,
    roll_number: cleanRoll,
    hall_ticket: cleanHallTicket,
    college_id: effectiveCollegeId,
    academic_year_id: academic_year_id || null,
    cohort_id: cohort_id || null,
    section_id: String(section_id),
    batch_id: String(batch_id),
    section: secRec?.name || 'A',
    batch: batRec?.name || 'Batch 1',
    year_of_passing: year_of_passing ? parseInt(String(year_of_passing), 10) : 2026,
    branch_code: String(branch_code).toUpperCase(),
    contact_number: contact_number || mobile || null,
    mobile: mobile || contact_number || null,
    password_hash: passwordHash,
    failed_attempts: 0,
    locked_until: null,
    reset_token_hash: null,
    reset_token_expires: null,
    must_change_password: true, // Mandatory password change on first login
    is_active: true,
    is_blocked: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: created, error } = await supabase.from('students').insert(newStudent).select().single();
  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }

  // Send welcome email with temporary password
  sendWelcomeEmail(normalizedEmail, fullName, 'student', tempPassword).catch((e) =>
    console.warn('[WelcomeEmail] Failed to send to student:', e)
  );

  res.status(201).json({
    success: true,
    message: 'Student created successfully. Welcome email dispatched with temporary password.',
    student: {
      ...created,
      temporary_password: tempPassword,
    },
  });
}

// ── 7. BULK EXCEL/CSV IMPORT OF STUDENTS ──

export async function bulkImportStudents(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    res.status(400).json({ success: false, error: 'Excel (.xlsx) or CSV file is required' });
    return;
  }

  const { isScoped, collegeId: scopedCollegeId } = resolveCollegeScope(req);
  const defaultCollegeId = isScoped ? scopedCollegeId : (req.body.college_id || '1');
  const defaultAyId = req.body.academic_year_id || null;
  const defaultCohortId = req.body.cohort_id || null;
  const defaultSectionId = req.body.section_id || null;
  const defaultBatchId = req.body.batch_id || null;

  try {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(workbook.Sheets[sheetName]);

    if (!rows || rows.length === 0) {
      res.status(400).json({ success: false, error: 'File is empty or contains no valid rows' });
      return;
    }

    const importedStudents = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // header is row 1

      const rawEmail = row['Email'] || row['email'] || row['Student Email'] || '';
      const rawRoll = row['Roll Number'] || row['roll_number'] || row['Roll'] || row['Hall Ticket'] || row['hall_ticket'] || '';
      const rawName = row['Name'] || row['name'] || row['Student Name'] || `${row['First Name'] || ''} ${row['Last Name'] || ''}`.trim();
      const rawSectionId = row['Section ID'] || row['section_id'] || row['Section'] || defaultSectionId;
      const rawBatchId = row['Batch ID'] || row['batch_id'] || row['Batch'] || defaultBatchId;
      const rawCollegeId = isScoped ? scopedCollegeId : (row['College ID'] || row['college_id'] || defaultCollegeId);
      const rawAyId = row['Academic Year ID'] || row['academic_year_id'] || defaultAyId;
      const rawCohortId = row['Cohort ID'] || row['cohort_id'] || row['YOP'] || defaultCohortId;

      if (!rawEmail || !rawRoll) {
        errors.push({ row: rowNum, error: 'Email and Roll Number are required' });
        continue;
      }

      if (!rawSectionId || !rawBatchId) {
        errors.push({
          row: rowNum,
          error: 'Student must belong to exactly one section and batch. Both section and batch are required.',
        });
        continue;
      }

      const email = String(rawEmail).trim().toLowerCase();
      const rollNumber = String(rawRoll).trim().toUpperCase();
      const name = rawName ? String(rawName).trim() : rollNumber;

      // Temporary password per student
      const tempPassword = `Student#${Math.floor(100000 + Math.random() * 900000)}!`;
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      const studentId = uuidv4();

      const studentRec = {
        id: studentId,
        name,
        first_name: name.split(' ')[0] || '',
        last_name: name.split(' ').slice(1).join(' ') || '',
        email,
        roll_number: rollNumber,
        hall_ticket: rollNumber,
        college_id: rawCollegeId,
        academic_year_id: rawAyId,
        cohort_id: rawCohortId,
        section_id: String(rawSectionId),
        batch_id: String(rawBatchId),
        section: String(row['Section'] || rawSectionId),
        batch: String(row['Batch'] || rawBatchId),
        year_of_passing: parseInt(String(row['YOP'] || row['year_of_passing'] || '2026'), 10),
        branch_code: String(row['Branch'] || row['branch_code'] || 'CSE').toUpperCase(),
        password_hash: passwordHash,
        failed_attempts: 0,
        must_change_password: true,
        is_active: true,
        is_blocked: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: created, error: insertErr } = await supabase.from('students').insert(studentRec).select().single();
      if (insertErr) {
        errors.push({ row: rowNum, error: insertErr.message });
      } else {
        importedStudents.push({ ...created, temporary_password: tempPassword });
        // Async send welcome email
        sendWelcomeEmail(email, name, 'student', tempPassword).catch((e) =>
          console.warn('[WelcomeEmail] Failed to send during bulk import:', e)
        );
      }
    }

    res.json({
      success: true,
      message: `Bulk import completed: ${importedStudents.length} students enrolled, ${errors.length} skipped.`,
      imported_count: importedStudents.length,
      errors_count: errors.length,
      errors,
      students: importedStudents,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to process bulk import file' });
  }
}

// ── 8. BATCH-WISE STUDENT LIST EXPORT (Excel / CSV) ──

export async function exportBatchStudents(req: Request, res: Response): Promise<void> {
  const { batch_id, section_id, format = 'xlsx' } = req.query;
  const { isScoped, collegeId } = resolveCollegeScope(req);

  if (!batch_id && !section_id) {
    res.status(400).json({ success: false, error: 'batch_id or section_id is required for batch-wise export' });
    return;
  }

  let query = supabase.from('students').select('*').order('roll_number', { ascending: true });

  if (isScoped && collegeId) {
    query = query.eq('college_id', collegeId);
  }
  if (batch_id) query = query.eq('batch_id', String(batch_id));
  if (section_id) query = query.eq('section_id', String(section_id));

  const { data: students, error } = await query;
  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }

  const exportRows = (students || []).map((s: any, idx: number) => ({
    'S.No': idx + 1,
    'Roll Number': s.roll_number || s.hall_ticket || '',
    'Hall Ticket': s.hall_ticket || s.roll_number || '',
    'Student Name': s.name || '',
    'Email Address': s.email || '',
    'College ID': s.college_id || '',
    'Academic Year ID': s.academic_year_id || '',
    'Cohort': s.year_of_passing || s.cohort_id || '',
    'Section': s.section || s.section_id || '',
    'Batch': s.batch || s.batch_id || '',
    'Active Status': s.is_active ? 'Active' : 'Inactive',
    'Password Status': s.must_change_password ? 'Temporary (Change Pending)' : 'Permanent',
    'Created At': s.created_at || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Students_Roster');

  const fileFormat = String(format).toLowerCase() === 'csv' ? 'csv' : 'xlsx';
  const fileName = `batch_students_${batch_id || section_id || 'all'}_${Date.now()}.${fileFormat}`;

  if (req.admin) {
    recordAuditLog(req.admin, 'EXPORT_BATCH_STUDENTS', 'students', String(batch_id || section_id || 'all'), { batch_id, section_id, format: fileFormat, count: exportRows.length }, req).catch(() => {});
  }

  if (fileFormat === 'csv') {
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(csvContent);
  } else {
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }
}

// ── 9. ADMIN & INSPECTOR PASSWORD RESETS ──

export async function resetStudentPassword(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { new_password } = req.body;
  const admin = req.admin;

  // First fetch the student to verify college scoping if caller is inspector
  const { data: existingStudent } = await supabase.from('students').select('*').eq('id', id).maybeSingle();
  if (!existingStudent) {
    res.status(404).json({ success: false, error: 'Student not found' });
    return;
  }

  if (admin?.role === 'inspector' || admin?.role === 'college_admin') {
    if (admin.college_id && existingStudent.college_id && String(existingStudent.college_id) !== String(admin.college_id)) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: You can only reset passwords for students in your assigned college.',
        code: 'CROSS_COLLEGE_FORBIDDEN',
      });
      return;
    }
  }

  const tempPassword = new_password || `TempStudent#${Math.floor(100000 + Math.random() * 900000)}!`;
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const { data: student, error } = await supabase
    .from('students')
    .update({
      password_hash: passwordHash,
      failed_attempts: 0,
      locked_until: null,
      must_change_password: true,
      reset_token_hash: null,
      reset_token_expires: null,
    })
    .eq('id', id)
    .select('id, name, email, roll_number')
    .single();

  if (error || !student) {
    res.status(404).json({ success: false, error: 'Student not found' });
    return;
  }

  sendWelcomeEmail(student.email, student.name, 'student', tempPassword).catch((e) =>
    console.warn('[WelcomeEmail] Failed to send student reset notification:', e)
  );

  res.json({
    success: true,
    message: `Password reset successfully for ${student.name}. Temporary password sent via email.`,
    temporary_password: tempPassword,
  });
}

export async function resetStaffPassword(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { new_password } = req.body;

  const tempPassword = new_password || `TempStaff#${Math.floor(100000 + Math.random() * 900000)}!`;
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const { data: staff, error } = await supabase
    .from('staff')
    .update({
      password_hash: passwordHash,
      failed_attempts: 0,
      locked_until: null,
      must_change_password: true,
      reset_token_hash: null,
      reset_token_expires: null,
    })
    .eq('id', id)
    .select('id, name, email, role')
    .single();

  if (error || !staff) {
    res.status(404).json({ success: false, error: 'Staff member not found' });
    return;
  }

  sendWelcomeEmail(staff.email, staff.name, staff.role, tempPassword).catch((e) =>
    console.warn('[WelcomeEmail] Failed to send staff reset notification:', e)
  );

  res.json({
    success: true,
    message: `Password reset successfully for ${staff.name}. Temporary password sent via email.`,
    temporary_password: tempPassword,
  });
}

// ── 10. FORCE PASSWORD CHANGE (FIRST LOGIN OR USER SETTINGS) ──

export async function changePassword(req: Request, res: Response): Promise<void> {
  const { new_password, current_password } = req.body;
  const admin = req.admin;

  if (!admin || !admin.staff_id) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  if (!new_password || String(new_password).length < 8) {
    res.status(400).json({ success: false, error: 'New password must be at least 8 characters long' });
    return;
  }

  const strengthCheck = isStrongPassword(new_password);
  if (!strengthCheck.valid) {
    res.status(400).json({ success: false, error: `Password policy violation: ${strengthCheck.error}` });
    return;
  }

  // Fetch staff record
  const { data: staff, error } = await supabase
    .from('staff')
    .select('*')
    .eq('id', admin.staff_id)
    .maybeSingle();

  if (error || !staff) {
    res.status(404).json({ success: false, error: 'Staff account not found' });
    return;
  }

  // If current_password is provided and account is not on forced change, verify current password
  if (current_password && staff.password_hash) {
    const valid = await bcrypt.compare(current_password, staff.password_hash);
    if (!valid) {
      res.status(401).json({ success: false, error: 'Current password does not match' });
      return;
    }
  }

  const newHash = await bcrypt.hash(new_password, 12);
  await supabase
    .from('staff')
    .update({
      password_hash: newHash,
      must_change_password: false,
      failed_attempts: 0,
      locked_until: null,
    })
    .eq('id', admin.staff_id);

  // Issue refreshed token with must_change_password: false
  const token = jwt.sign(
    {
      sub: staff.email,
      role: staff.role,
      staff_id: staff.id,
      name: staff.name,
      college_id: staff.college_id || null,
      must_change_password: false,
    },
    getAdminJwtSecret(),
    { expiresIn: '8h' }
  );

  res.json({
    success: true,
    message: 'Password changed successfully. You may now continue using the platform.',
    token,
  });
}

// ── 11. 2FA (TOTP) MANAGEMENT FOR ADMIN & INSPECTOR ──

// Helper to extract admin context from either authenticated session or enrollment token
function resolveAdminFromRequest(req: Request): { sub: string; staff_id: string; role: string; college_id?: any; college_scope?: any } | null {
  if (req.admin) return req.admin;
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || (req.body?.enrollment_token as string);
  if (token) {
    try {
      const decoded = jwt.verify(
        token,
        getAdminJwtSecret()
      ) as any;
      if (decoded && (decoded.purpose === 'totp_enrollment' || decoded.staff_id)) {
        return {
          sub: decoded.sub,
          staff_id: decoded.staff_id,
          role: decoded.role || 'staff',
          college_id: decoded.college_id,
          college_scope: decoded.college_scope,
        };
      }
    } catch (_) {}
  }
  return null;
}

export async function setup2fa(req: Request, res: Response): Promise<void> {
  const admin = resolveAdminFromRequest(req);
  if (!admin) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  const secret = generateTotpSecret();
  const issuer = 'LogicWhileLiRE';
  const qrCodeDataUrl = await generateTotpQrDataUrl(admin.sub, issuer, secret);
  const encryptedSecret = encryptTotpSecret(secret);

  // Temporarily stage totp_secret on staff record (AES-256-CTR encrypted at rest)
  await supabase.from('staff').update({ totp_secret: encryptedSecret }).eq('id', admin.staff_id);

  res.json({
    success: true,
    secret,
    qr_code: qrCodeDataUrl,
    otpauth_url: `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(admin.sub)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`,
    instructions: 'Scan the QR code with Google Authenticator, Authy, or Microsoft Authenticator, then enter the 6-digit code to verify.',
  });
}

export async function verifyAndEnable2fa(req: Request, res: Response): Promise<void> {
  const admin = resolveAdminFromRequest(req);
  const { code, secret } = req.body;

  if (!admin || !code) {
    res.status(400).json({ success: false, error: 'Verification code is required' });
    return;
  }

  // Look up staged or passed secret
  const { data: staff } = await supabase.from('staff').select('*').eq('id', admin.staff_id).maybeSingle();
  const effectiveSecret = secret || staff?.totp_secret;

  if (!effectiveSecret) {
    res.status(400).json({ success: false, error: 'No 2FA setup in progress. Call /2fa/setup first.' });
    return;
  }

  const isValid = verifyTotpCode(String(code), effectiveSecret, 1);
  if (!isValid) {
    res.status(400).json({ success: false, error: 'Invalid 2FA code. Please check your authenticator clock and try again.' });
    return;
  }

  // Ensure secret is encrypted at rest in the database
  const encryptedSecret = isEncryptedTotpSecret(effectiveSecret)
    ? effectiveSecret
    : encryptTotpSecret(effectiveSecret);

  const backupCodes = generateBackupCodes(8);

  // Enable 2FA on account
  await supabase
    .from('staff')
    .update({
      totp_secret: encryptedSecret,
      totp_enabled: true,
      two_factor_backup_codes: backupCodes.hashed,
    })
    .eq('id', admin.staff_id);

  // If this was an enrollment token flow, issue full session token immediately
  let authToken: string | undefined;
  if (!req.admin) {
    authToken = jwt.sign(
      {
        sub: admin.sub,
        staff_id: admin.staff_id,
        role: staff?.role || admin.role,
        college_id: staff?.college_id || admin.college_id || null,
        college_scope: staff?.college_scope || admin.college_scope || null,
      },
      getAdminJwtSecret(),
      { expiresIn: '8h' }
    );
  }

  res.json({
    success: true,
    token: authToken,
    user: !req.admin ? { id: admin.staff_id, email: admin.sub, role: admin.role, name: staff?.name } : undefined,
    backup_codes: backupCodes.plain,
    message: 'Two-Factor Authentication (TOTP) has been successfully verified and activated on your account.',
  });
}

export async function disable2fa(req: Request, res: Response): Promise<void> {
  const admin = req.admin;
  const { password } = req.body;

  if (!admin || !password) {
    res.status(400).json({ success: false, error: 'Account password required to disable 2FA' });
    return;
  }

  // Enforce mandatory 2FA for admin and inspector roles
  const roleRequires2FA = ['super_admin', 'admin', 'inspector', 'college_admin'].includes(admin.role);
  if (roleRequires2FA) {
    res.status(403).json({
      success: false,
      error: 'Two-Factor Authentication is mandatory for administrators and inspectors and cannot be disabled.',
    });
    return;
  }

  const { data: staff } = await supabase.from('staff').select('password_hash').eq('id', admin.staff_id).maybeSingle();
  if (!staff?.password_hash) {
    res.status(404).json({ success: false, error: 'Staff account not found' });
    return;
  }

  const passwordValid = await bcrypt.compare(password, staff.password_hash);
  if (!passwordValid) {
    res.status(401).json({ success: false, error: 'Invalid password' });
    return;
  }

  await supabase
    .from('staff')
    .update({
      totp_secret: null,
      totp_enabled: false,
    })
    .eq('id', admin.staff_id);

  res.json({
    success: true,
    message: 'Two-Factor Authentication (TOTP) has been disabled.',
  });
}

// ── 12. RUN SYSTEM & GOOGLE DRIVE BACKUPS (SUPER ADMIN ONLY) ──

export async function getBackupHistory(req: Request, res: Response): Promise<void> {
  try {
    const history = getBackupHistoryList();
    const driveStatus = getGoogleDrivePublicStatus();
    res.json({
      success: true,
      history,
      drive_config: driveStatus,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to fetch backup history' });
  }
}

export async function getGoogleDriveStatusHandler(req: Request, res: Response): Promise<void> {
  try {
    const driveStatus = getGoogleDrivePublicStatus();
    res.json({ success: true, drive: driveStatus });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to check Google Drive status' });
  }
}

export async function downloadSystemBackup(req: Request, res: Response): Promise<void> {
  try {
    const backupId = req.query.id ? String(req.query.id) : null;
    let targetZip: string | null = backupId ? path.join(BACKUP_DIR, `${backupId}.zip`) : null;

    if (!targetZip || !fs.existsSync(targetZip)) {
      // Find latest zip file in BACKUP_DIR
      if (fs.existsSync(BACKUP_DIR)) {
        const files = fs
          .readdirSync(BACKUP_DIR)
          .filter((f) => f.endsWith('.zip'))
          .map((f) => ({ name: f, path: path.join(BACKUP_DIR, f), time: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
          .sort((a, b) => b.time - a.time);

        if (files.length > 0) {
          targetZip = files[0].path;
        }
      }
    }

    if (!targetZip || !fs.existsSync(targetZip)) {
      const result = await executeSystemBackup({
        trigger: 'admin',
        adminId: req.admin?.sub,
        createZip: true,
      });
      targetZip = result.zipFilePath || null;
    }

    if (!targetZip || !fs.existsSync(targetZip)) {
      res.status(500).json({ success: false, error: 'Failed to find or generate backup zip file' });
      return;
    }

    const downloadFilename = path.basename(targetZip);
    res.download(targetZip, downloadFilename);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Backup generation failed' });
  }
}

export async function runSystemBackup(req: Request, res: Response): Promise<void> {
  try {
    const download = req.query.download === 'true' || req.query.format === 'zip';
    if (download) {
      return downloadSystemBackup(req, res);
    }

    // Run both standard system backup and Google Drive dated hierarchy backup
    const [result, driveResult] = await Promise.all([
      executeSystemBackup({
        trigger: 'admin',
        adminId: req.admin?.sub,
        createZip: true,
      }),
      executeGoogleDriveBackup({
        trigger: 'manual',
        adminId: req.admin?.sub,
      }),
    ]);

    res.json({
      success: true,
      message: 'System backup generated successfully',
      backup: {
        version: result.manifest.version,
        backup_id: result.backupId,
        generated_at: result.timestamp,
        generated_by: req.admin?.sub || 'super_admin',
        integrity_status: result.manifest.integrityStatus,
        counts: Object.fromEntries(
          Object.entries(result.manifest.tables).map(([k, v]) => [k, v.sourceRows])
        ),
        batch_student_files_count: result.manifest.batchStudentFilesCount,
        exam_result_files_count: result.manifest.examResultFilesCount,
        download_url: '/api/admin/backup/download',
        drive_backup: {
          id: driveResult.id,
          dated_folder: driveResult.dated_folder,
          file_count: driveResult.file_count,
          total_records: driveResult.total_records,
          drive_status: driveResult.drive_status,
          drive_folder_id: driveResult.drive_folder_id,
          drive_folder_url: driveResult.drive_folder_url,
          duration_ms: driveResult.duration_ms,
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Backup failed' });
  }
}

// ── 13. INSPECTOR EXAM START & END (COLLEGE SCOPED) ──

export async function inspectorStartExam(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const admin = req.admin;

  // Find exam
  const { data: exam, error } = await supabase.from('exams').select('*').eq('id', id).maybeSingle();
  if (error || !exam) {
    res.status(404).json({ success: false, error: 'Exam not found' });
    return;
  }

  // Check college scope for inspector
  if (admin?.role === 'inspector' || admin?.role === 'college_admin') {
    if (admin.college_id && exam.college_id && String(exam.college_id) !== String(admin.college_id)) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: You can only start exams for your own college',
        code: 'CROSS_COLLEGE_FORBIDDEN',
      });
      return;
    }
  }

  const now = new Date().toISOString();
  const { data: updated } = await supabase
    .from('exams')
    .update({ is_active: true, start_time: now })
    .eq('id', id)
    .select()
    .single();

  res.json({
    success: true,
    message: `Exam "${exam.title}" has been started by inspector. Candidates may now enter.`,
    exam: updated,
  });
}

export async function inspectorEndExam(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const admin = req.admin;

  const { data: exam, error } = await supabase.from('exams').select('*').eq('id', id).maybeSingle();
  if (error || !exam) {
    res.status(404).json({ success: false, error: 'Exam not found' });
    return;
  }

  // Check college scope for inspector
  if (admin?.role === 'inspector' || admin?.role === 'college_admin') {
    if (admin.college_id && exam.college_id && String(exam.college_id) !== String(admin.college_id)) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: You can only end exams for your own college',
        code: 'CROSS_COLLEGE_FORBIDDEN',
      });
      return;
    }
  }

  const now = new Date().toISOString();
  const { data: updated } = await supabase
    .from('exams')
    .update({ is_active: false, end_time: now })
    .eq('id', id)
    .select()
    .single();

  res.json({
    success: true,
    message: `Exam "${exam.title}" has been concluded by inspector.`,
    exam: updated,
  });
}

/**
 * GET /api/admin/inspector/dashboard-data
 * Inspector live dashboard initializer:
 * Returns the college, exams, exam codes, and sections for the inspector's assigned college.
 */
export async function getInspectorDashboardData(req: Request, res: Response): Promise<void> {
  try {
    const admin = req.admin;
    const collegeId = admin?.college_id;

    // 1. Fetch assigned college
    let college: any = null;
    if (collegeId) {
      const { data } = await supabase.from('colleges').select('*').eq('id', collegeId).maybeSingle();
      college = data;
    } else {
      // Super admin or unassigned: fetch primary college
      const { data } = await supabase.from('colleges').select('*').limit(1).maybeSingle();
      college = data;
    }

    const targetCollegeId = college?.id || collegeId;

    // 2. Fetch exams for this college
    let examQuery = supabase.from('exams').select('*');
    if (targetCollegeId && admin?.role !== 'super_admin') {
      examQuery = examQuery.eq('college_id', targetCollegeId);
    }
    const { data: exams } = await examQuery.order('created_at', { ascending: false });

    // 3. Fetch exam codes
    let ecQuery = supabase.from('exam_codes').select('*');
    if (targetCollegeId && admin?.role !== 'super_admin') {
      ecQuery = ecQuery.eq('college_id', targetCollegeId);
    }
    const { data: examCodes } = await ecQuery.order('created_at', { ascending: false });

    // 4. Fetch sections for this college
    let secQuery = supabase.from('sections').select('*');
    if (targetCollegeId && admin?.role !== 'super_admin') {
      secQuery = secQuery.eq('college_id', targetCollegeId);
    }
    const { data: sections } = await secQuery.order('section_name');

    res.json({
      success: true,
      college: college || { id: targetCollegeId, college_name: 'Institutional Campus', college_code: 'CAMPUS' },
      exams: exams || [],
      exam_codes: examCodes || [],
      sections: sections || [],
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to fetch dashboard data' });
  }
}

// ── 12. STUDENT FULL CRUD (PHASE 1) ──

/**
 * PATCH /api/admin/students/:id
 * Full update for student details
 */
export async function updateStudent(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const updates: any = { ...req.body };
  delete updates.id;
  delete updates.password_hash;

  if (updates.roll_number) updates.roll_number = String(updates.roll_number).trim().toUpperCase();
  if (updates.hall_ticket) updates.hall_ticket = String(updates.hall_ticket).trim().toUpperCase();
  if (updates.email) updates.email = String(updates.email).trim().toLowerCase();
  updates.updated_at = new Date().toISOString();

  const { data: student, error } = await supabase
    .from('students')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error || !student) {
    res.status(404).json({ success: false, error: error?.message || 'Student not found' });
    return;
  }

  res.json({ success: true, student, message: 'Student updated successfully' });
}

/**
 * DELETE /api/admin/students/:id
 */
export async function deleteStudent(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { error } = await supabase.from('students').delete().eq('id', id);
  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }
  res.json({ success: true, message: 'Student deleted successfully' });
}


