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
import {
  sendInspectorCreated,
  sendFacultyCreated,
  sendAdminWelcome,
  sendAdminAlert,
} from '../services/mailService';
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
import { broadcastExamStarted, resetExamStartedState, stopLeaderboardStream } from '../services/socketService';

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
    yop: c.year_of_passing || c.yop,
  }));
  res.json({ success: true, cohorts: enriched });
}

export async function createCohort(req: Request, res: Response): Promise<void> {
  const { college_id, academic_year_id, yop, name, cohort_name, degree, branch, is_active = true } = req.body;
  const { isScoped, collegeId: scopedCollegeId } = resolveCollegeScope(req);

  const effectiveCollegeId = isScoped ? scopedCollegeId : college_id;
  const effectiveName = (name || cohort_name || '').trim();
  const effectiveYop = parseInt(String(yop || req.body.year_of_passing || 2026), 10);

  if (!effectiveCollegeId || !effectiveYop) {
    res.status(400).json({ success: false, error: 'college_id and yop (year of passing, e.g. 2026) are required' });
    return;
  }

  const cleanBranch = (branch || 'CSE').toLowerCase().replace(/[^a-z0-9]/g, '');
  const id = `coh-${String(effectiveCollegeId).toLowerCase()}-${effectiveYop}-${cleanBranch}-${Date.now().toString(36)}`;
  const record: Record<string, unknown> = {
    id,
    college_id: String(effectiveCollegeId),
    academic_year_id: academic_year_id ? String(academic_year_id) : null,
    name: effectiveName || `Class of ${effectiveYop}`,
    year_of_passing: effectiveYop,
    yop: effectiveYop,
    degree: degree ? String(degree).trim() : 'B.Tech',
    branch: branch ? String(branch).trim().toUpperCase() : 'CSE',
    is_active: Boolean(is_active),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
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
      cohort_name: data.name,
    },
  });
}

export async function updateCohort(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { name, cohort_name, yop, academic_year_id, degree, branch, is_active } = req.body;

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  const effectiveName = name !== undefined ? name : cohort_name;
  if (effectiveName !== undefined) {
    updatePayload.name = String(effectiveName).trim();
  }
  if (yop !== undefined || req.body.year_of_passing !== undefined) {
    const numYop = parseInt(String(yop || req.body.year_of_passing), 10);
    updatePayload.yop = numYop;
    updatePayload.year_of_passing = numYop;
  }
  if (academic_year_id !== undefined) updatePayload.academic_year_id = String(academic_year_id);
  if (degree !== undefined) updatePayload.degree = String(degree).trim();
  if (branch !== undefined) updatePayload.branch = String(branch).trim().toUpperCase();
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
      cohort_name: data.name,
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

  // Faculty scope: restrict to allocated college and sections
  if (req.admin?.role === 'faculty') {
    const callerStaffId = req.admin.staff_id || (req.admin as any).id;
    const { data: staffRec } = await supabase
      .from('staff')
      .select('college_id, section_ids')
      .eq('id', callerStaffId)
      .maybeSingle();

    const facultyCollegeId = staffRec?.college_id ?? req.admin.college_id;
    const facultySectionIds: string[] = Array.isArray(staffRec?.section_ids) ? staffRec!.section_ids : [];

    if (facultyCollegeId) {
      query = query.eq('college_id', facultyCollegeId);
    }
    if (facultySectionIds.length > 0) {
      query = query.in('id', facultySectionIds);
    }
  }

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

  let effectiveCollegeId = isScoped ? scopedCollegeId : college_id;
  if (!effectiveCollegeId && cohort_id) {
    const { data: cohortRow } = await supabase.from('cohorts').select('college_id').eq('id', cohort_id).maybeSingle();
    if (cohortRow?.college_id) {
      effectiveCollegeId = cohortRow.college_id;
    }
  }

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
    section_name: section_name || cleanName,
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
  const { name, section_name, is_active } = req.body;

  const updatePayload: Record<string, unknown> = {};
  const effectiveName = name !== undefined ? name : section_name;
  if (effectiveName !== undefined) {
    const formatted = String(effectiveName).trim().toUpperCase();
    updatePayload.name = formatted;
    updatePayload.section_name = formatted;
  }
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

  let effectiveCollegeId = isScoped ? scopedCollegeId : college_id;
  let effectiveCohortId = cohort_id;

  if ((!effectiveCollegeId || !effectiveCohortId) && section_id) {
    const { data: secRow } = await supabase.from('sections').select('college_id, cohort_id').eq('id', section_id).maybeSingle();
    if (secRow) {
      if (!effectiveCollegeId && secRow.college_id) effectiveCollegeId = secRow.college_id;
      if (!effectiveCohortId && secRow.cohort_id) effectiveCohortId = secRow.cohort_id;
    }
  }

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

interface HierarchyOverviewCacheEntry {
  data: any;
  timestamp: number;
}
const hierarchyOverviewCache = new Map<string, HierarchyOverviewCacheEntry>();
const HIERARCHY_OVERVIEW_TTL_MS = 3000;

export function invalidateHierarchyOverviewCache(): void {
  hierarchyOverviewCache.clear();
}

export async function getHierarchyOverview(req: Request, res: Response): Promise<void> {
  const { isScoped, collegeId } = resolveCollegeScope(req);

  let facultyCollegeId = collegeId;
  let facultySectionIds: string[] = [];
  if (req.admin?.role === 'faculty') {
    const callerStaffId = req.admin.staff_id || (req.admin as any).id;
    const { data: staffRec } = await supabase
      .from('staff')
      .select('college_id, section_ids')
      .eq('id', callerStaffId)
      .maybeSingle();

    if (staffRec?.college_id) facultyCollegeId = staffRec.college_id;
    if (Array.isArray(staffRec?.section_ids)) facultySectionIds = staffRec.section_ids;
  }

  const cacheKey = `${facultyCollegeId || 'all'}_${[...facultySectionIds].sort().join(',')}`;
  const cached = hierarchyOverviewCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < HIERARCHY_OVERVIEW_TTL_MS) {
    res.json(cached.data);
    return;
  }

  // Fetch all entities
  let collegesQuery = supabase.from('colleges').select('id, college_name, college_code, city, state, is_active');
  if (facultyCollegeId) {
    collegesQuery = collegesQuery.eq('id', facultyCollegeId);
  }
  const { data: colleges } = await collegesQuery;

  let ayQuery = supabase.from('academic_years').select('*');
  let cohQuery = supabase.from('cohorts').select('*');
  let secQuery = supabase.from('sections').select('*');
  let batQuery = supabase.from('batches').select('*');

  if (facultyCollegeId) {
    ayQuery = ayQuery.eq('college_id', facultyCollegeId);
    cohQuery = cohQuery.eq('college_id', facultyCollegeId);
    secQuery = secQuery.eq('college_id', facultyCollegeId);
    batQuery = batQuery.eq('college_id', facultyCollegeId);
  }

  if (facultySectionIds.length > 0) {
    secQuery = secQuery.in('id', facultySectionIds);
    batQuery = batQuery.in('section_id', facultySectionIds);
  }

  const [ays, cohs, secs, bats] = await Promise.all([
    ayQuery.then((r) => r.data || []),
    cohQuery.then((r) => r.data || []),
    secQuery.then((r) => r.data || []),
    batQuery.then((r) => r.data || []),
  ]);

  const responsePayload = {
    success: true,
    colleges: colleges || [],
    academic_years: ays,
    cohorts: cohs,
    sections: secs,
    batches: bats,
  };

  hierarchyOverviewCache.set(cacheKey, {
    data: responsePayload,
    timestamp: Date.now(),
  });

  res.json(responsePayload);
}

// ── 6. STUDENT MANAGEMENT (Belongs to exactly one section and batch) ──

/**
 * Security: Purges sensitive credential attributes (password hashes, raw OTPs, tokens)
 * before returning student objects across administrative APIs to prevent data leaks.
 */
export function sanitizeStudentResponse<T extends Record<string, any>>(student: T): Record<string, any> {
  if (!student || typeof student !== 'object') return student;
  const safe = { ...student };
  delete safe.password_hash;
  delete safe.verification_otp;
  delete safe.reset_token_hash;
  delete safe.totp_secret;
  return safe;
}

export async function listStudents(req: Request, res: Response): Promise<void> {
  const { isScoped, collegeId } = resolveCollegeScope(req);
  const { academic_year_id, cohort_id, section_id, batch_id, search } = req.query;

  let query = supabase
    .from('students')
    .select('id, name, first_name, last_name, email, roll_number, hall_ticket, college_id, college_name, academic_year_id, cohort_id, section_id, batch_id, section, batch, branch_code, year_of_passing, is_active, is_verified, is_blocked, must_change_password, created_at')
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
  if (req.query.verified === 'true') query = query.eq('is_verified', true);
  if (req.query.verified === 'false') query = query.eq('is_verified', false);

  // Faculty: enforce live section_ids restriction from staff record
  if (req.admin?.role === 'faculty') {
    const { data: staffRec } = await supabase
      .from('staff')
      .select('college_id, section_ids')
      .eq('id', req.admin.staff_id)
      .maybeSingle();

    const facultyCollegeId = staffRec?.college_id ?? req.admin.college_id;
    const facultySectionIds: string[] = Array.isArray(staffRec?.section_ids) ? staffRec!.section_ids : [];

    // Faculty with no allocated sections see no students (strict zero-trust scoping)
    if (facultySectionIds.length === 0) {
      res.json({ success: true, count: 0, students: [] });
      return;
    }

    // Restrict strictly to faculty college and allocated sections
    if (facultyCollegeId) {
      query = query.eq('college_id', facultyCollegeId);
    }
    query = query.in('section_id', facultySectionIds);
  }

  const { data: students, error } = await query;
  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }

  let filtered = (students || []).map((s: any) => {
    const roll = s.roll_number || s.hall_ticket || 'STUDENT';
    const idSlug = String(s.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || '2026';
    const candSlug = String(s.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(4, 8).toUpperCase() || 'CAND';
    const safe = sanitizeStudentResponse(s);
    return {
      ...safe,
      branch: s.branch_code || s.branch || 'CSE',
      student_gate_pass: `GP-STU-${roll}-${idSlug}`,
      candidate_gate_pass: `GP-CAND-${roll}-${candSlug}`,
    };
  });

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
  let {
    name,
    first_name,
    last_name,
    email,
    roll_number,
    hall_ticket,
    college_id,
    college_name,
    academic_year_id,
    cohort_id,
    section_id,
    section,
    batch_id,
    batch,
    year_of_passing,
    branch_code = 'CSE',
    branch,
    contact_number,
    mobile,
    password,
    student_gate_pass,
    candidate_gate_pass,
  } = req.body;

  const { isScoped, collegeId: scopedCollegeId } = resolveCollegeScope(req);
  let effectiveCollegeId = isScoped ? scopedCollegeId : college_id;

  if (!email || (!roll_number && !hall_ticket)) {
    res.status(400).json({ success: false, error: 'email and roll_number / hall_ticket are required' });
    return;
  }

  // Auto-resolve college if missing
  if (!effectiveCollegeId && college_name) {
    const { data: col } = await supabase
      .from('colleges')
      .select('id, college_name')
      .ilike('college_name', `%${college_name}%`)
      .maybeSingle();
    if (col) {
      effectiveCollegeId = col.id;
      college_name = col.college_name;
    } else {
      effectiveCollegeId = 1;
    }
  } else if (!effectiveCollegeId) {
    effectiveCollegeId = 1;
  }

  if (!college_name && effectiveCollegeId) {
    const { data: col } = await supabase.from('colleges').select('college_name').eq('id', effectiveCollegeId).maybeSingle();
    if (col) college_name = col.college_name;
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const cleanRoll = String(roll_number || hall_ticket).trim().toUpperCase();
  const cleanHallTicket = hall_ticket ? String(hall_ticket).trim().toUpperCase() : cleanRoll;
  const effectiveBranch = String(branch || branch_code || 'CSE').trim().toUpperCase();
  const effectiveSection = String(section || 'A').trim();
  const effectiveBatch = String(batch || 'Batch 1').trim();

  // Exactly one section and batch required — auto-resolve or create if not passed as IDs
  if (!section_id) {
    const { data: secRec } = await supabase
      .from('sections')
      .select('id, name')
      .eq('college_id', effectiveCollegeId)
      .eq('name', effectiveSection)
      .maybeSingle();
    section_id = secRec?.id || `sec-${effectiveCollegeId}-${effectiveSection.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  }

  if (!batch_id) {
    const { data: batRec } = await supabase
      .from('batches')
      .select('id, name')
      .eq('college_id', effectiveCollegeId)
      .eq('name', effectiveBatch)
      .maybeSingle();
    batch_id = batRec?.id || `bat-${effectiveCollegeId}-${effectiveBatch.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  }

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

  // Auto-generate Student Gate Pass and Candidate Gate Pass
  const randomSuffix = () => Math.random().toString(36).substring(2, 6).toUpperCase();
  const autoStudentGatePass = student_gate_pass || `GP-STU-${cleanRoll}-${randomSuffix()}`;
  const autoCandidateGatePass = candidate_gate_pass || `GP-CAND-${cleanRoll}-${randomSuffix()}`;

  const newStudent = {
    id: studentId,
    name: fullName,
    first_name: first_name || fullName.split(' ')[0] || '',
    last_name: last_name || fullName.split(' ').slice(1).join(' ') || '',
    email: normalizedEmail,
    roll_number: cleanRoll,
    hall_ticket: cleanHallTicket,
    college_id: effectiveCollegeId,
    college_name: college_name || 'VR Siddhartha Engineering College',
    academic_year_id: academic_year_id || null,
    cohort_id: cohort_id || null,
    section_id: String(section_id),
    batch_id: String(batch_id),
    section: secRec?.name || effectiveSection,
    batch: batRec?.name || effectiveBatch,
    year_of_passing: year_of_passing ? parseInt(String(year_of_passing), 10) : 2026,
    branch_code: effectiveBranch,
    contact_number: contact_number || mobile || null,
    mobile: mobile || contact_number || null,
    password_hash: passwordHash,
    failed_attempts: 0,
    locked_until: null,
    reset_token_hash: null,
    reset_token_expires: null,
    must_change_password: true,
    is_active: true,
    is_verified: false,
    verification_otp: Math.floor(100000 + Math.random() * 900000).toString(),
    verification_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
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
    message: 'Student created successfully. Separated into college, group, and section with active Gate Passes.',
    student: {
      ...sanitizeStudentResponse(created || newStudent),
      temporary_password: tempPassword,
      student_gate_pass: autoStudentGatePass,
      candidate_gate_pass: autoCandidateGatePass,
    },
  });
}

// ── 7. BULK EXCEL/CSV IMPORT OF STUDENTS ──

export async function bulkImportStudents(req: Request, res: Response): Promise<void> {
  const file = req.file;
  let rows: any[] = [];
  if (file?.buffer) {
    try {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      rows = XLSX.utils.sheet_to_json<Record<string, any>>(workbook.Sheets[sheetName]);
    } catch (e: any) {
      res.status(400).json({ success: false, error: 'Failed to read spreadsheet file: ' + e?.message });
      return;
    }
  } else if (Array.isArray(req.body?.rows)) {
    rows = req.body.rows;
  } else if (Array.isArray(req.body)) {
    rows = req.body;
  } else {
    res.status(400).json({ success: false, error: 'Excel (.xlsx) or CSV file or rows array is required' });
    return;
  }

  const { isScoped, collegeId: scopedCollegeId } = resolveCollegeScope(req);
  const defaultCollegeId = isScoped ? scopedCollegeId : (req.body.college_id || '1');
  const defaultAyId = req.body.academic_year_id || null;
  const defaultCohortId = req.body.cohort_id || null;
  const defaultSectionId = req.body.section_id || null;
  const defaultBatchId = req.body.batch_id || null;

  try {
    if (!rows || rows.length === 0) {
      res.status(400).json({ success: false, error: 'File or rows list is empty or contains no valid rows' });
      return;
    }

    const importedStudents = [];
    const errors = [];
    let updatedCount = 0;
    let insertedCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // header is row 1

      const rawEmail = row['Email'] || row['email'] || row['Student Email'] || '';
      const rawRoll = row['Roll Number'] || row['roll_number'] || row['Roll'] || row['Hall Ticket'] || row['hall_ticket'] || '';
      const rawName = row['Name'] || row['name'] || row['Student Name'] || `${row['First Name'] || ''} ${row['Last Name'] || ''}`.trim();
      const rawSection = row['Section'] || row['section_id'] || row['Section ID'] || defaultSectionId || 'A';
      const rawBatch = row['Batch'] || row['batch_id'] || row['Batch ID'] || defaultBatchId || 'Batch 1';
      const rawBranch = row['Branch'] || row['branch_code'] || row['Department'] || 'CSE';
      const rawYop = row['Passout Year'] || row['YOP'] || row['year_of_passing'] || '2026';
      const rawCollegeId = isScoped ? scopedCollegeId : (row['College ID'] || row['college_id'] || defaultCollegeId);
      const rawAyId = row['Academic Year ID'] || row['academic_year_id'] || defaultAyId;
      const rawCohortId = row['Cohort ID'] || row['cohort_id'] || defaultCohortId;

      if (!rawEmail || !rawRoll) {
        errors.push({ row: rowNum, error: 'Email and Roll Number are required' });
        continue;
      }

      const email = String(rawEmail).trim().toLowerCase();
      const rollNumber = String(rawRoll).trim().toUpperCase();
      const name = rawName ? String(rawName).trim() : rollNumber;
      const sectionName = String(rawSection).trim().toUpperCase();
      const branchCode = String(rawBranch).trim().toUpperCase();
      const yop = parseInt(String(rawYop), 10) || 2026;

      // Auto-link section_id and batch_id
      const resolvedSectionId = String(row['section_id'] || row['Section ID'] || `sec-${String(rawCollegeId).toLowerCase()}-${branchCode.toLowerCase()}-${sectionName.toLowerCase()}`);
      const resolvedBatchId = String(row['batch_id'] || row['Batch ID'] || `bat-${String(rawCollegeId).toLowerCase()}-${branchCode.toLowerCase()}-${sectionName.toLowerCase()}-1`);

      // Idempotency: Check if student already exists by roll_number or email
      const { data: existing } = await supabase
        .from('students')
        .select('*')
        .or(`roll_number.eq.${rollNumber},email.eq.${email},hall_ticket.eq.${rollNumber}`)
        .maybeSingle();

      if (existing) {
        // Update existing record
        const updateRec: Record<string, any> = {
          name,
          first_name: name.split(' ')[0] || '',
          last_name: name.split(' ').slice(1).join(' ') || '',
          email,
          roll_number: rollNumber,
          hall_ticket: rollNumber,
          college_id: rawCollegeId,
          section_id: resolvedSectionId,
          batch_id: resolvedBatchId,
          section: sectionName,
          batch: String(rawBatch).trim(),
          year_of_passing: yop,
          branch_code: branchCode,
          is_active: true,
          updated_at: new Date().toISOString(),
        };

        const { data: updated, error: updErr } = await supabase
          .from('students')
          .update(updateRec)
          .eq('id', existing.id)
          .select()
          .single();

        if (updErr) {
          errors.push({ row: rowNum, error: updErr.message });
        } else {
          updatedCount++;
          importedStudents.push(sanitizeStudentResponse(updated));
        }
      } else {
        // Create new student
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
          section_id: resolvedSectionId,
          batch_id: resolvedBatchId,
          section: sectionName,
          batch: String(rawBatch).trim(),
          year_of_passing: yop,
          branch_code: branchCode,
          password_hash: passwordHash,
          failed_attempts: 0,
          must_change_password: true,
          is_active: true,
          is_verified: false,
          verification_otp: Math.floor(100000 + Math.random() * 900000).toString(),
          verification_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          is_blocked: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: created, error: insertErr } = await supabase.from('students').insert(studentRec).select().single();
        if (insertErr) {
          errors.push({ row: rowNum, error: insertErr.message });
        } else {
          insertedCount++;
          importedStudents.push({ ...sanitizeStudentResponse(created), temporary_password: tempPassword });
          sendWelcomeEmail(email, name, 'student', tempPassword, rawCollegeId, rollNumber).catch((e) =>
            console.warn('[WelcomeEmail] Failed to send during bulk import:', e)
          );
        }
      }
    }

    // Audit log
    if ((req as any).admin) {
      recordAuditLog(
        (req as any).admin,
        'BULK_ROSTER_IMPORT',
        'students',
        null,
        {
          total_rows: rows.length,
          inserted_count: insertedCount,
          updated_count: updatedCount,
          errors_count: errors.length,
        },
        req
      ).catch(() => {});
    }

    res.json({
      success: true,
      message: `Bulk import completed: ${insertedCount} inserted, ${updatedCount} updated, ${errors.length} skipped.`,
      summary: {
        total: rows.length,
        inserted: insertedCount,
        updated: updatedCount,
        errors: errors.length,
      },
      imported_count: importedStudents.length,
      inserted_count: insertedCount,
      updated_count: updatedCount,
      errors_count: errors.length,
      errors,
      students: importedStudents.map(sanitizeStudentResponse),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to process bulk import file' });
  }
}

/**
 * POST /api/admin/hierarchy/import-preview
 * Validates roster import from Excel/CSV, identifies duplicates, and outputs validation report.
 */
export async function previewHierarchyImport(req: Request, res: Response): Promise<void> {
  const file = req.file;
  let rows: any[] = [];

  if (file?.buffer) {
    try {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      rows = XLSX.utils.sheet_to_json<Record<string, any>>(workbook.Sheets[sheetName]);
    } catch (e: any) {
      res.status(400).json({ success: false, error: 'Failed to read spreadsheet file: ' + e?.message });
      return;
    }
  } else if (Array.isArray(req.body?.rows)) {
    rows = req.body.rows;
  } else {
    res.status(400).json({ success: false, error: 'No file or rows provided' });
    return;
  }

  const { isScoped, collegeId: scopedCollegeId } = resolveCollegeScope(req);
  const defaultCollegeId = isScoped ? scopedCollegeId : (req.body.college_id || '1');

  // Fetch all existing students for duplicate detection
  const { data: existingStudents } = await supabase.from('students').select('id, roll_number, hall_ticket, email');
  const existingSet = new Set<string>();
  for (const s of existingStudents || []) {
    if (s.roll_number) existingSet.add(String(s.roll_number).trim().toUpperCase());
    if (s.hall_ticket) existingSet.add(String(s.hall_ticket).trim().toUpperCase());
    if (s.email) existingSet.add(String(s.email).trim().toLowerCase());
  }

  const preview: any[] = [];
  const errors: any[] = [];
  let newCount = 0;
  let duplicateCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const rawEmail = row['Email'] || row['email'] || row['Student Email'] || '';
    const rawRoll = row['Roll Number'] || row['roll_number'] || row['Roll'] || row['Hall Ticket'] || row['hall_ticket'] || '';
    const rawName = row['Name'] || row['name'] || row['Student Name'] || `${row['First Name'] || ''} ${row['Last Name'] || ''}`.trim();
    const rawSection = row['Section'] || row['section_id'] || row['Section ID'] || 'A';
    const rawBranch = row['Branch'] || row['branch_code'] || row['Department'] || 'CSE';
    const rawYop = row['Passout Year'] || row['YOP'] || row['year_of_passing'] || '2026';
    const rawBatch = row['Batch'] || row['batch_id'] || row['Batch ID'] || 'Batch 1';

    if (!rawEmail || !rawRoll) {
      errors.push({ row: rowNum, error: 'Email and Roll Number are required' });
      continue;
    }

    const email = String(rawEmail).trim().toLowerCase();
    const rollNumber = String(rawRoll).trim().toUpperCase();
    const isDuplicate = existingSet.has(rollNumber) || existingSet.has(email);

    if (isDuplicate) {
      duplicateCount++;
    } else {
      newCount++;
    }

    preview.push({
      row: rowNum,
      name: rawName || rollNumber,
      email,
      roll_number: rollNumber,
      college_id: defaultCollegeId,
      branch: String(rawBranch).trim().toUpperCase(),
      passout_year: parseInt(String(rawYop), 10) || 2026,
      section: String(rawSection).trim().toUpperCase(),
      batch: String(rawBatch).trim(),
      is_duplicate: isDuplicate,
      action: isDuplicate ? 'UPDATE' : 'CREATE',
    });
  }

  res.json({
    success: true,
    total: rows.length,
    total_rows: rows.length,
    valid_count: preview.length,
    valid_rows: preview.length,
    invalid_rows: errors.length,
    error_count: errors.length,
    new_records: newCount,
    duplicate_count: duplicateCount,
    duplicate_records: duplicateCount,
    preview: preview.slice(0, 100),
    duplicates: preview.filter((p) => p.is_duplicate),
    errors,
  });
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

  // Faculty scope: restrict to allocated college and sections
  if (req.admin?.role === 'faculty') {
    const callerStaffId = req.admin.staff_id || (req.admin as any).id;
    const { data: staffRec } = await supabase
      .from('staff')
      .select('college_id, section_ids')
      .eq('id', callerStaffId)
      .maybeSingle();

    const facultyCollegeId = staffRec?.college_id ?? req.admin.college_id;
    const facultySectionIds: string[] = Array.isArray(staffRec?.section_ids) ? staffRec!.section_ids : ((req.admin as any).section_ids || []);

    if (facultySectionIds.length === 0) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: No academic sections allocated to your faculty account',
        code: 'NO_SECTIONS_ALLOCATED',
      });
      return;
    }

    if (facultyCollegeId) {
      query = query.eq('college_id', facultyCollegeId);
    }
    query = query.in('section_id', facultySectionIds);
    if (section_id && !facultySectionIds.includes(String(section_id))) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: You do not have permission to export students from a section outside your allocation',
        code: 'FACULTY_SECTION_FORBIDDEN',
      });
      return;
    }
  }

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

// ── 8b. BULK STUDENT EMAIL VERIFICATION (super_admin) ──

/**
 * POST /api/admin/students/bulk-verify
 * Mark selected students (or all in a section) as email-verified.
 * Intended for imported students who cannot self-verify before exam day.
 * Produces an audit log entry.
 */
export async function bulkVerifyStudents(req: Request, res: Response): Promise<void> {
  const { student_ids, section_id, college_id } = req.body;

  if (!student_ids?.length && !section_id) {
    res.status(400).json({
      success: false,
      error: 'Provide student_ids array or section_id to verify a whole section.',
    });
    return;
  }

  let targetIds: string[] = [];

  if (Array.isArray(student_ids) && student_ids.length > 0) {
    targetIds = student_ids.map(String);
  } else if (section_id) {
    // Verify all students in the section (matching section_id or section code, or ALL)
    const secStr = String(section_id).trim();
    let q = supabase.from('students').select('id');
    if (secStr.toUpperCase() !== 'ALL') {
      q = q.or(`section_id.eq.${secStr},section.eq.${secStr},section.ilike.${secStr},section_id.ilike.${secStr}`);
    }
    if (college_id) q = q.eq('college_id', String(college_id));
    const { data, error } = await q;
    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return;
    }
    targetIds = (data || []).map((s: any) => s.id);
  }

  if (targetIds.length === 0) {
    res.json({ success: true, verified_count: 0, message: 'No students matched the criteria.' });
    return;
  }

  const { error: updateError, count } = await supabase
    .from('students')
    .update({
      is_verified: true,
      is_active: true,
      verification_otp: null,
      verification_token: null,
      verification_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .in('id', targetIds);

  if (updateError) {
    res.status(500).json({ success: false, error: updateError.message });
    return;
  }

  // Audit log
  if (req.admin) {
    recordAuditLog(
      req.admin,
      'BULK_VERIFY_STUDENTS',
      'students',
      section_id || 'multiple',
      {
        student_ids: targetIds,
        section_id: section_id || null,
        college_id: college_id || null,
        verified_count: targetIds.length,
      },
      req
    ).catch(() => {});
  }

  res.json({
    success: true,
    verified_count: targetIds.length,
    message: `${targetIds.length} student(s) marked as verified successfully.`,
  });
}

// ── 8c. ADMIN ALLOW RE-ENTRY (super_admin: reopen terminated attempt) ──

/**
 * POST /api/admin/attempts/:id/allow-reentry
 * Reopens a wrongly-terminated exam attempt by resetting status to 'in-progress'
 * and clearing the termination reason. Writes an audit log entry.
 * A student with a terminated attempt cannot restart without this action.
 */
export async function allowExamReentry(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { reason } = req.body;

  let targetTable = 'exam_code_attempts';
  let { data: attempt, error: fetchError } = await supabase
    .from('exam_code_attempts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  let sessionRecord: any = null;
  if (!attempt) {
    // Check exam_sessions for traditional exams
    const { data: session } = await supabase
      .from('exam_sessions')
      .select('id, status, end_time, submitted_at, started_at, termination_reason, participant:participant_id ( hall_ticket, exam_id )')
      .eq('id', id)
      .maybeSingle();

    if (session) {
      targetTable = 'exam_sessions';
      sessionRecord = session;
      attempt = {
        id: session.id,
        hall_ticket: (session as any).participant?.hall_ticket || 'STUDENT',
        exam_code: (session as any).participant?.exam_id || 'EXAM',
        status: session.status,
        termination_reason: session.termination_reason,
      };
    }
  }

  if (!attempt) {
    res.status(404).json({ success: false, error: 'Attempt or session not found.' });
    return;
  }

  // Only terminated attempts can be reopened
  const terminatedStatuses = ['Terminated - violation', 'terminated_cheating', 'terminated', 'terminated_violation'];
  if (!terminatedStatuses.includes(attempt.status)) {
    res.status(400).json({
      success: false,
      error: `Attempt status is '${attempt.status}'. Only terminated attempts may be reopened.`,
      code: 'ATTEMPT_NOT_TERMINATED',
    });
    return;
  }

  let remainingSeconds = 300;
  let savedAnswersCount = 0;

  if (targetTable === 'exam_sessions') {
    // Compute remaining time from when session was terminated
    const prevEnd = sessionRecord?.end_time ? new Date(sessionRecord.end_time).getTime() : 0;
    const termAt = sessionRecord?.submitted_at ? new Date(sessionRecord.submitted_at).getTime() : Date.now();
    let computedRem = Math.max(120, Math.floor((prevEnd - termAt) / 1000));
    if (isNaN(computedRem) || computedRem <= 0) {
      computedRem = 300;
    }
    remainingSeconds = computedRem;
    const newEndTime = new Date(Date.now() + remainingSeconds * 1000).toISOString();

    // Check count of saved answers in session_answers
    const { count: ansCount } = await supabase
      .from('session_answers')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', id);
    savedAnswersCount = ansCount || 0;

    const { error: sessUpdErr } = await supabase
      .from('exam_sessions')
      .update({
        status: 'in_progress',
        end_time: newEndTime,
        submitted_at: null,
        termination_reason: null,
        violation_count: 0,
      })
      .eq('id', id);

    if (sessUpdErr) {
      res.status(500).json({ success: false, error: sessUpdErr.message });
      return;
    }
  } else {
    // Preserve saved answers strictly from answers and partial_answers
    const preservedAnswers = attempt.partial_answers || attempt.answers || {};
    const preservedCodeAnswers = attempt.code_answers || {};
    savedAnswersCount = Object.keys(preservedAnswers).length;

    // Calculate remaining time from duration and time taken
    const { data: ecExam } = await supabase
      .from('exam_codes')
      .select('duration_minutes')
      .eq('exam_code', attempt.exam_code)
      .maybeSingle();
    const examDurSec = (ecExam?.duration_minutes || 60) * 60;
    const timeTaken = attempt.time_taken_seconds || 0;
    remainingSeconds = Math.max(120, examDurSec - timeTaken);

    const { error: updateError } = await supabase
      .from('exam_code_attempts')
      .update({
        status: 'in_progress',
        override_reason: null,
        end_time: null,
        submitted_at: null,
        time_taken_seconds: timeTaken,
        partial_answers: preservedAnswers,
        answers: preservedAnswers,
        code_answers: preservedCodeAnswers,
      })
      .eq('id', id);

    if (updateError) {
      res.status(500).json({ success: false, error: updateError.message });
      return;
    }
  }

  // Audit log
  if (req.admin) {
    recordAuditLog(
      req.admin,
      'ALLOW_EXAM_REENTRY',
      targetTable,
      String(id),
      {
        attempt_id: id,
        target_table: targetTable,
        hall_ticket: attempt.hall_ticket || attempt.hall_ticket_no,
        exam_code: attempt.exam_code,
        original_status: attempt.status,
        original_termination_reason: attempt.termination_reason,
        remaining_seconds_restored: remainingSeconds,
        saved_answers_preserved_count: savedAnswersCount,
        admin_reason: reason || 'Admin-granted re-entry',
      },
      req
    ).catch(() => {});
  }

  res.json({
    success: true,
    message: `Re-entry granted for ${attempt.hall_ticket || attempt.hall_ticket_no}. Remaining time (${remainingSeconds}s) and ${savedAnswersCount} saved answers preserved.`,
    attempt_id: id,
    target_table: targetTable,
    hall_ticket: attempt.hall_ticket || attempt.hall_ticket_no,
    exam_code: attempt.exam_code,
    remaining_seconds: remainingSeconds,
    saved_answers_count: savedAnswersCount,
  });
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

  if (new_password) {
    const passwordCheck = isStrongPassword(new_password);
    if (!passwordCheck.valid) {
      res.status(400).json({
        success: false,
        error: `Password policy violation: ${passwordCheck.error}`,
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

  if (new_password) {
    const passwordCheck = isStrongPassword(new_password);
    if (!passwordCheck.valid) {
      res.status(400).json({
        success: false,
        error: `Password policy violation: ${passwordCheck.error}`,
      });
      return;
    }
  }

  const tempPassword = new_password || `TempStaff#${Math.floor(100000 + Math.random() * 900000)}!`;
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const { data: staff, error } = await supabase
    .from('staff')
    .update({
      password_hash: passwordHash,
      must_change_password: true,
      failed_attempts: 0,
      locked_until: null,
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

  // Dispatch credential notification to linked email
  if (staff.email) {
    if (staff.role === 'inspector') {
      sendInspectorCreated({
        name: staff.name,
        email: staff.email,
        tempPassword,
      }).catch((e) => console.warn('[MailService] Failed to send inspector reset email:', e));
    } else if (staff.role === 'faculty') {
      sendFacultyCreated({
        name: staff.name,
        email: staff.email,
        tempPassword,
      }).catch((e) => console.warn('[MailService] Failed to send faculty reset email:', e));
    } else {
      sendAdminWelcome({
        name: staff.name,
        email: staff.email,
        role: staff.role,
        tempPassword,
      }).catch((e) => console.warn('[MailService] Failed to send admin reset email:', e));
    }

    sendAdminAlert({
      to: staff.email,
      alertType: 'PASSWORD_RESET',
      message: `Your account password has been reset by the Super Administrator. A new temporary access key was sent.`,
      severity: 'high',
    }).catch(() => {});
  }

  res.json({
    success: true,
    message: `Password reset successfully for ${staff.name}. Temporary credentials have been dispatched to the linked contact method.`,
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
  const updatePayload: any = {
    password_hash: newHash,
    must_change_password: false,
    failed_attempts: 0,
    locked_until: null,
  };
  const { error: updateErr } = await supabase
    .from('staff')
    .update(updatePayload)
    .eq('id', admin.staff_id);

  if (updateErr && updateErr.message?.includes('must_change_password')) {
    delete updatePayload.must_change_password;
    await supabase.from('staff').update(updatePayload).eq('id', admin.staff_id);
  }

  try {
    const { staffAccountCache } = require('./adminController');
    for (const [, cached] of staffAccountCache) {
      if (cached.id === admin.staff_id || cached.email === staff.email) {
        cached.must_change_password = false;
      }
    }
  } catch {}

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

  // Dispatch security alert on password change to linked email
  if (staff.email) {
    sendAdminAlert({
      alertType: 'system_alert',
      title: `Security Alert: Password Changed for ${staff.name || staff.username || staff.email}`,
      message: `The password for your LogicWhile LiRE account (${staff.role}) was changed on ${new Date().toISOString()}. If you did not make this change, please immediately contact your administrator.`,
      details: {
        role: staff.role,
        username: staff.username,
        email: staff.email,
        timestamp: new Date().toISOString(),
      },
      targetAdminEmail: staff.email,
    }).catch((err) => {
      console.warn('[ChangePassword] Notice: alert delivery:', err?.message);
    });
  }

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
      is_2fa_enabled: true,
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
      is_2fa_enabled: false,
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
  const id = String(req.params.id || '');
  const admin = req.admin;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const isNumeric = /^\d+$/.test(id);

  let exam: any = null;
  let table = 'exams';

  // 1. Try by exact exam_code first in exam_codes
  const { data: ecByCode } = await supabase.from('exam_codes').select('*').eq('exam_code', id).maybeSingle();
  if (ecByCode) {
    exam = { ...ecByCode, title: ecByCode.exam_name || ecByCode.exam_code };
    table = 'exam_codes';
  }

  // 2. Try by exam_code in exams
  if (!exam) {
    const { data: byCode } = await supabase.from('exams').select('*').eq('exam_code', id).maybeSingle();
    if (byCode) exam = byCode;
  }

  // 3. Try by id if valid uuid/numeric
  if (!exam && isUuid) {
    const { data: byId } = await supabase.from('exams').select('*').eq('id', id).maybeSingle();
    if (byId) exam = byId;
  }
  if (!exam && (isNumeric || isUuid)) {
    const { data: ecById } = await supabase.from('exam_codes').select('*').eq('id', id).maybeSingle();
    if (ecById) {
      exam = { ...ecById, title: ecById.exam_name || ecById.exam_code };
      table = 'exam_codes';
    }
  }

  if (!exam) {
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
    .from(table)
    .update({ is_active: true, start_time: now, started_at: now })
    .eq('id', exam.id)
    .select()
    .single();

  const examCode = exam.exam_code || exam.code || id;
  const durationSeconds = (exam.duration_minutes || exam.duration || 60) * 60;
  broadcastExamStarted({
    examCode,
    durationSeconds,
    serverStartTime: Date.now(),
  }).catch(() => {});

  res.json({
    success: true,
    message: `Exam "${exam.title}" has been started by inspector. Candidates may now enter.`,
    exam: updated || exam,
  });
}

export async function inspectorEndExam(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const admin = req.admin;

  let { data: exam, error } = await supabase.from('exams').select('*').eq('id', id).maybeSingle();
  let table = 'exams';

  if (!exam) {
    const { data: byCode } = await supabase.from('exams').select('*').eq('exam_code', id).maybeSingle();
    if (byCode) exam = byCode;
  }
  if (!exam) {
    const { data: ec } = await supabase.from('exam_codes').select('*').eq('id', id).maybeSingle();
    if (ec) {
      exam = { ...ec, title: ec.exam_name || ec.exam_code };
      table = 'exam_codes';
    }
  }
  if (!exam) {
    const { data: ecByCode } = await supabase.from('exam_codes').select('*').eq('exam_code', id).maybeSingle();
    if (ecByCode) {
      exam = { ...ecByCode, title: ecByCode.exam_name || ecByCode.exam_code };
      table = 'exam_codes';
    }
  }

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
    .from(table)
    .update({ is_active: false, end_time: now })
    .eq('id', exam.id)
    .select()
    .single();

  const examCode = exam.exam_code || exam.code || id;
  resetExamStartedState(examCode);
  stopLeaderboardStream(examCode);

  res.json({
    success: true,
    message: `Exam "${exam.title}" has been concluded by inspector.`,
    exam: updated || exam,
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

    // 5. Fetch enrolled students for this college / assessment roster
    let stuQuery = supabase.from('students').select('id, name, first_name, last_name, roll_number, hall_ticket, section, batch, branch_code, college_id, college_name, is_verified, is_blocked');
    if (targetCollegeId && admin?.role !== 'super_admin') {
      stuQuery = stuQuery.eq('college_id', targetCollegeId);
    }
    const { data: enrolledStudents } = await stuQuery.order('roll_number');

    // 6. Fetch live waiting queue / lobby participants
    let queueQuery = supabase
      .from('exam_code_attempts')
      .select('id, exam_code_id, roll_number, student_name, college_id, status, joined_at, ping_at')
      .in('status', ['waiting', 'in_lobby', 'active', 'ready'])
      .limit(50);
    const { data: waitingQueue } = await queueQuery;

    res.json({
      success: true,
      college: college || { id: targetCollegeId, college_name: 'Institutional Campus', college_code: 'CAMPUS' },
      exams: exams || [],
      exam_codes: examCodes || [],
      sections: sections || [],
      waiting_queue: waitingQueue || [],
      enrolled_students: (enrolledStudents || []).map((s: any) => {
        const roll = s.roll_number || s.hall_ticket || 'STUDENT';
        const idSlug = String(s.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || '2026';
        const candSlug = String(s.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(4, 8).toUpperCase() || 'CAND';
        return {
          ...s,
          name: s.name || `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.roll_number,
          hall_ticket: s.hall_ticket || s.roll_number,
          branch: s.branch_code || 'CSE',
          section: s.section || 'A',
          batch: s.batch || 'Batch 1',
          student_gate_pass: `GP-STU-${roll}-${idSlug}`,
          candidate_gate_pass: `GP-CAND-${roll}-${candSlug}`,
        };
      }),
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


