import { Request, Response } from 'express';
import QRCode from 'qrcode';
import * as XLSX from 'xlsx';
import crypto from 'crypto';
import { supabase } from '../db/supabase';
import { isStudentEligibleForExam, deriveStudyYear } from '../utils/academicYear';
import { recordAuditLog } from '../middleware/auditLog';
import { broadcastViolationToMonitor } from '../services/socketService';

// ─────────────────────────────────────────────
// SESSION TOKEN UTILITIES  (1a: concurrent-session block)
// ─────────────────────────────────────────────

/**
 * Generate a cryptographically random session token (16 bytes → 32 hex chars).
 * Stored per-attempt; a second verifyExamEntry with same hall_ticket+exam_code
 * overwrites this token, evicting any already-open browser session.
 */
function generateSessionToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Verify that the provided session_token matches the stored token for this attempt.
 * Returns { valid, evicted, terminated } to let the caller decide the response.
 */
export async function verifyAttemptToken(
  attemptId: string,
  examCode: string,
  providedToken: string | undefined
): Promise<{ valid: boolean; evicted: boolean; terminated: boolean; attempt: any | null }> {
  const { data: attempt } = await supabase
    .from('exam_code_attempts')
    .select('*')
    .eq('id', attemptId)
    .eq('exam_code', examCode.toUpperCase())
    .maybeSingle();

  if (!attempt) return { valid: false, evicted: false, terminated: false, attempt: null };
  if (['terminated', 'Terminated - violation', 'terminated_cheating', 'terminated_violation', 'completed', 'submitted'].includes(attempt.status)) {
    return { valid: false, evicted: false, terminated: true, attempt };
  }
  // If no stored token yet (legacy row), accept and migrate
  if (!attempt.session_token) return { valid: true, evicted: false, terminated: false, attempt };

  let match = false;
  if (providedToken && typeof providedToken === 'string') {
    const bufA = Buffer.from(String(attempt.session_token));
    const bufB = Buffer.from(String(providedToken));
    if (bufA.length === bufB.length) {
      match = crypto.timingSafeEqual(bufA, bufB);
    }
  }

  if (!match) return { valid: false, evicted: true, terminated: false, attempt };
  return { valid: true, evicted: false, terminated: false, attempt };
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

/**
 * Generates a unique exam code: GR-{COLLEGE_CODE}-{6CHAR} (LOGICWHILELIRE)
 * e.g. GR-VRSEC-8X9P2Q
 * Note: The platform continuously accepts both new GR- and legacy LW- codes.
 */
export function generateExamCode(collegeCode?: string): string {
  const code = (collegeCode || 'VRSEC').trim().toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `GR-${code}-${random}`;
}

/**
 * Validates exam code format. Explicitly supports both new GR- and legacy LW- codes.
 */
export function isValidExamCodeFormat(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  return /^(LWL|LIRE|GR|LW)-[A-Z0-9]+-[A-Z0-9]+$/i.test(code.trim()) || /^[A-Z0-9_-]{3,32}$/i.test(code.trim());
}

/**
 * Deterministically shuffles an array using a string seed.
 * Consistent across reloads for the same student session, but unique per candidate.
 */
export function deterministicShuffle<T>(arr: T[], seedStr: string): T[] {
  const copy = [...arr];
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = ((seed << 5) - seed + seedStr.charCodeAt(i)) | 0;
  }
  for (let i = copy.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280;
    const j = Math.floor((Math.abs(seed) / 233280) * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ─────────────────────────────────────────────
// COLLEGES
// ─────────────────────────────────────────────

/**
 * GET /api/colleges
 * Public – returns active colleges for dropdown.
 * When ?registration=true is supplied, filters only colleges enabled for student registration.
 */
export async function listColleges(req: Request, res: Response): Promise<void> {
  let query = supabase
    .from('colleges')
    .select('id, college_name, college_code, city, state, is_active, registration_enabled')
    .order('college_name');

  if (req.admin?.role === 'faculty') {
    const callerStaffId = req.admin.staff_id || (req.admin as any).id;
    let facultyCollegeId = req.admin.college_id;
    if (!facultyCollegeId && callerStaffId) {
      const { data: staffRec } = await supabase
        .from('staff')
        .select('college_id')
        .eq('id', callerStaffId)
        .maybeSingle();
      if (staffRec?.college_id) facultyCollegeId = staffRec.college_id;
    }
    if (facultyCollegeId) {
      query = (query as any).eq('id', facultyCollegeId);
    }
  } else if (req.admin && (req.admin.role === 'inspector' || req.admin.role === 'college_admin') && req.admin.college_id) {
    query = (query as any).eq('id', req.admin.college_id);
  }

  if (req.query?.registration === 'true') {
    query = (query as any).eq('is_active', true).eq('registration_enabled', true);
  }

  const { data, error } = await query;

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  
  if (req.query?.breakdown === 'true') {
    return getCollegesBreakdown(req, res);
  }

  // Ensure default registration_enabled is true if null/undefined
  const colleges = (data || []).map((c: any) => ({
    ...c,
    registration_enabled: c.registration_enabled !== false,
  }));

  // Extra guard if query was registration=true
  const result = req.query?.registration === 'true'
    ? colleges.filter((c: any) => c.registration_enabled && c.is_active)
    : colleges;

  res.json({ success: true, colleges: result });
}

/**
 * GET /api/admin/colleges/breakdown
 * Authoritative admin breakdown:
 * For each college:
 * - Branches: name, code, batch_count, batches[], section_count, sections[], passout_years[], student_count, live_active_count
 * - Total branches, batches, sections, passout years
 * - Total registered students & live status summary
 * - Full candidate roster with registration details & real-time activity status
 */
export async function getCollegesBreakdown(req: Request, res: Response): Promise<void> {
  try {
    // 1. Fetch colleges
    let collegeQuery = supabase
      .from('colleges')
      .select('*')
      .order('college_name');

    if (req.admin?.role === 'faculty') {
      const callerStaffId = req.admin.staff_id || (req.admin as any).id;
      let facultyCollegeId = req.admin.college_id;
      if (!facultyCollegeId && callerStaffId) {
        const { data: staffRec } = await supabase.from('staff').select('college_id').eq('id', callerStaffId).maybeSingle();
        if (staffRec?.college_id) facultyCollegeId = staffRec.college_id;
      }
      if (facultyCollegeId) {
        collegeQuery = (collegeQuery as any).eq('id', facultyCollegeId);
      }
    } else if (req.admin && (req.admin.role === 'inspector' || req.admin.role === 'college_admin') && req.admin.college_id) {
      collegeQuery = (collegeQuery as any).eq('id', req.admin.college_id);
    }

    const { data: colleges, error: colErr } = await collegeQuery;
    if (colErr) {
      res.status(500).json({ success: false, error: colErr.message });
      return;
    }

    // 2. Fetch cohorts, sections, batches, students, attempts
    const [cohortsRes, sectionsRes, batchesRes, studentsRes, attemptsRes, sessionsRes] = await Promise.all([
      supabase.from('cohorts').select('*'),
      supabase.from('sections').select('*'),
      supabase.from('batches').select('*'),
      supabase.from('students').select('*').order('created_at', { ascending: false }),
      supabase.from('exam_code_attempts').select('id, hall_ticket_no, exam_code, status, score, max_score, violation_count, answers, created_at, updated_at'),
      supabase.from('exam_sessions').select('id, participant_id, status, violation_count, started_at, submitted_at, participants(hall_ticket, name)')
    ]);

    const allCohorts = cohortsRes.data || [];
    const allSections = sectionsRes.data || [];
    const allBatches = batchesRes.data || [];
    const allStudents = studentsRes.data || [];
    const allAttempts = attemptsRes.data || [];
    const allSessions = sessionsRes.data || [];

    // Map attempts by hall ticket (normalized uppercase)
    const attemptsByRoll: Record<string, any> = {};
    for (const att of allAttempts) {
      const ht = String(att.hall_ticket_no || '').toUpperCase().trim();
      if (!ht) continue;
      const existing = attemptsByRoll[ht];
      if (!existing || (existing.status !== 'in_progress' && att.status === 'in_progress')) {
        attemptsByRoll[ht] = att;
      }
    }

    for (const sess of allSessions) {
      const p = (sess as any).participants;
      const ht = String(p?.hall_ticket || '').toUpperCase().trim();
      if (!ht) continue;
      if (!attemptsByRoll[ht] || (attemptsByRoll[ht].status !== 'in_progress' && sess.status === 'in_progress')) {
        attemptsByRoll[ht] = {
          id: sess.id,
          hall_ticket_no: ht,
          exam_code: 'EXAM-PORTAL',
          status: sess.status,
          score: 0,
          max_score: 10,
          violation_count: sess.violation_count || 0,
          answers: {},
          created_at: sess.started_at,
          updated_at: sess.submitted_at
        };
      }
    }

    // Build per-college breakdown
    const enrichedColleges = (colleges || []).map((col: any) => {
      const colIdStr = String(col.id);
      const colName = String(col.college_name || '');
      const colCode = String(col.college_code || '');

      // Filter students for this college (by id, code or name match)
      const collegeStudents = allStudents.filter((s: any) => {
        const sid = String(s.college_id || '');
        const sname = String(s.college_name || '');
        return sid === colIdStr ||
          (sname && colName && sname.toLowerCase() === colName.toLowerCase()) ||
          (sname && colCode && sname.toUpperCase().includes(colCode.toUpperCase()));
      });

      // Filter cohorts/sections/batches
      const collegeCohorts = allCohorts.filter((c: any) => !c.college_id || String(c.college_id) === colIdStr);
      const collegeSections = allSections.filter((s: any) => !s.college_id || String(s.college_id) === colIdStr);
      const collegeBatches = allBatches.filter((b: any) => !b.college_id || String(b.college_id) === colIdStr);

      // Aggregate branches
      const branchMap: Record<string, {
        branch_code: string;
        branch_name: string;
        batches: Set<string>;
        sections: Set<string>;
        passout_years: Set<number>;
        students: any[];
        live_active_count: number;
      }> = {};

      // Seed standard branches if college has none yet
      const standardBranches = ['CSE', 'CSM', 'IT', 'ECE', 'AIML'];
      for (const sb of standardBranches) {
        branchMap[sb] = {
          branch_code: sb,
          branch_name: sb === 'CSE' ? 'Computer Science & Engineering' : sb === 'CSM' ? 'CSE (AI & ML)' : sb === 'IT' ? 'Information Technology' : sb === 'ECE' ? 'Electronics & Communication' : 'AI & Data Science',
          batches: new Set(['Batch 1', 'Batch 2']),
          sections: new Set(['A', 'B']),
          passout_years: new Set([2026, 2027, 2028]),
          students: [],
          live_active_count: 0
        };
      }

      // Seed from cohorts
      for (const ch of collegeCohorts) {
        const code = (ch.branch || ch.name || 'CSE').toUpperCase().trim();
        if (!branchMap[code]) {
          branchMap[code] = {
            branch_code: code,
            branch_name: ch.name || code,
            batches: new Set(),
            sections: new Set(),
            passout_years: new Set(),
            students: [],
            live_active_count: 0
          };
        }
        if (ch.year_of_passing || ch.yop) branchMap[code].passout_years.add(Number(ch.year_of_passing || ch.yop));
      }

      // Seed from sections
      for (const sec of collegeSections) {
        const secName = (sec.name || sec.section_name || 'A').toUpperCase().trim();
        let bCode = 'CSE';
        if (secName.includes('-')) {
          bCode = secName.split('-')[0].trim();
        }
        if (!branchMap[bCode]) {
          branchMap[bCode] = {
            branch_code: bCode,
            branch_name: bCode,
            batches: new Set(),
            sections: new Set(),
            passout_years: new Set(),
            students: [],
            live_active_count: 0
          };
        }
        branchMap[bCode].sections.add(secName);
      }

      // Seed from batches
      for (const bat of collegeBatches) {
        const bName = (bat.name || bat.batch_name || 'Batch 1').trim();
        for (const bKey of Object.keys(branchMap)) {
          branchMap[bKey].batches.add(bName);
        }
      }

      // Aggregate students into branches & enrich with live status
      let inExamCount = 0;
      let inLobbyCount = 0;
      let clearedCount = 0;
      let pendingCount = 0;
      let completedCount = 0;
      let blockedCount = 0;

      const studentRoster = collegeStudents.map((s: any) => {
        const ht = String(s.roll_number || s.hall_ticket || '').toUpperCase().trim();
        const bCode = (s.branch_code || s.branch || 'CSE').toUpperCase().trim();
        const sec = (s.section || 'A').toUpperCase().trim();
        const yop = Number(s.year_of_passing || s.passout_year) || 2028;
        const batchName = s.batch || `Batch ${yop}`;

        if (!branchMap[bCode]) {
          branchMap[bCode] = {
            branch_code: bCode,
            branch_name: bCode,
            batches: new Set(),
            sections: new Set(),
            passout_years: new Set(),
            students: [],
            live_active_count: 0
          };
        }
        branchMap[bCode].batches.add(batchName);
        branchMap[bCode].sections.add(sec);
        branchMap[bCode].passout_years.add(yop);

        // Derive Live Status
        const attempt = attemptsByRoll[ht];
        let liveStatus: {
          state: 'in_exam' | 'in_lobby' | 'cleared' | 'pending' | 'completed' | 'blocked';
          label: string;
          exam_code?: string;
          current_question?: number;
          score?: number;
          max_score?: number;
          violations?: number;
          started_at?: string;
          submitted_at?: string;
        };

        if (s.is_blocked) {
          liveStatus = { state: 'blocked', label: '🛑 Blocked by Admin' };
          blockedCount++;
        } else if (attempt && attempt.status === 'in_progress') {
          const qCount = attempt.answers ? Object.keys(attempt.answers).length : 0;
          liveStatus = {
            state: 'in_exam',
            label: `🟢 In Exam: ${attempt.exam_code} (Q${qCount + 1})`,
            exam_code: attempt.exam_code,
            current_question: qCount + 1,
            score: attempt.score || 0,
            max_score: attempt.max_score || 10,
            violations: attempt.violation_count || 0,
            started_at: attempt.created_at || attempt.start_time
          };
          inExamCount++;
          branchMap[bCode].live_active_count++;
        } else if (attempt && (attempt.status === 'completed' || attempt.status === 'submitted')) {
          liveStatus = {
            state: 'completed',
            label: `🏁 Submitted: ${attempt.score || 0}/${attempt.max_score || 10}`,
            exam_code: attempt.exam_code,
            score: attempt.score || 0,
            max_score: attempt.max_score || 10,
            violations: attempt.violation_count || 0,
            submitted_at: attempt.updated_at || attempt.end_time
          };
          completedCount++;
        } else if (s.is_verified) {
          liveStatus = { state: 'cleared', label: '✓ Cleared & Ready' };
          clearedCount++;
        } else {
          liveStatus = { state: 'pending', label: '⏳ Pending Admin Clearance' };
          pendingCount++;
        }

        const enrichedStudent = {
          id: String(s.id),
          name: s.name || `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Candidate',
          first_name: s.first_name || '',
          last_name: s.last_name || '',
          roll_number: ht,
          hall_ticket: ht,
          email: s.email || '',
          contact_number: s.contact_number || s.mobile || '',
          college_id: col.id,
          college_name: col.college_name,
          branch: bCode,
          branch_code: bCode,
          section: sec,
          batch: batchName,
          passout_year: yop,
          year_of_passing: yop,
          student_gate_pass: s.student_gate_pass || `GP-STU-${ht}-7842`,
          candidate_gate_pass: s.candidate_gate_pass || `GP-CAND-${ht}-9153`,
          is_verified: Boolean(s.is_verified),
          is_blocked: Boolean(s.is_blocked),
          block_reason: s.block_reason || null,
          created_at: s.created_at,
          live_status: liveStatus
        };

        branchMap[bCode].students.push(enrichedStudent);
        return enrichedStudent;
      });

      // Format branches list
      const branchList = Object.values(branchMap).map((b) => ({
        branch_code: b.branch_code,
        branch_name: b.branch_name,
        batch_count: b.batches.size || 1,
        batches: Array.from(b.batches).sort(),
        section_count: b.sections.size || 1,
        sections: Array.from(b.sections).sort(),
        passout_years: Array.from(b.passout_years).sort((x, y) => x - y),
        student_count: b.students.length,
        live_active_count: b.live_active_count
      }));

      const allCollegeBatches = Array.from(
        new Set(branchList.flatMap((b) => b.batches))
      ).sort();

      const allCollegeSections = Array.from(
        new Set(branchList.flatMap((b) => b.sections))
      ).sort();

      const allPassoutYears = Array.from(
        new Set(branchList.flatMap((b) => b.passout_years))
      ).sort((x, y) => x - y);

      return {
        ...col,
        registration_enabled: col.registration_enabled !== false,
        total_branches: branchList.length,
        branches: branchList,
        total_batches: allCollegeBatches.length || 1,
        batches: allCollegeBatches,
        total_sections: allCollegeSections.length || 1,
        sections: allCollegeSections,
        passout_years: allPassoutYears.length > 0 ? allPassoutYears : [2026, 2027, 2028, 2029, 2030],
        total_students: studentRoster.length,
        live_status_summary: {
          in_exam: inExamCount,
          in_lobby: inLobbyCount,
          cleared_ready: clearedCount,
          pending_clearance: pendingCount,
          completed: completedCount,
          blocked: blockedCount
        },
        students: studentRoster
      };
    });

    res.json({
      success: true,
      colleges: enrichedColleges,
      total_colleges: enrichedColleges.length,
      overall_summary: {
        total_students: enrichedColleges.reduce((acc, c) => acc + c.total_students, 0),
        live_in_exam: enrichedColleges.reduce((acc, c) => acc + c.live_status_summary.in_exam, 0),
        pending_clearance: enrichedColleges.reduce((acc, c) => acc + c.live_status_summary.pending_clearance, 0),
        cleared_ready: enrichedColleges.reduce((acc, c) => acc + c.live_status_summary.cleared_ready, 0),
        total_branches: new Set(enrichedColleges.flatMap((c) => c.branches.map((b: any) => b.branch_code))).size
      }
    });
  } catch (err: any) {
    console.error('[CollegesBreakdown] Error:', err);
    res.status(500).json({ success: false, error: err?.message || 'Failed to generate college breakdown' });
  }
}

/**
 * POST /api/admin/colleges
 */
export async function createCollege(req: Request, res: Response): Promise<void> {
  const { college_name, college_code, city, state, contact_email, contact_phone, registration_enabled } = req.body;
  if (!college_name || !college_code) {
    res.status(400).json({ success: false, error: 'college_name and college_code are required' });
    return;
  }
  const normalized = college_code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const { data, error } = await supabase
    .from('colleges')
    .insert({
      college_name,
      college_code: normalized,
      city,
      state,
      contact_email,
      contact_phone,
      registration_enabled: registration_enabled !== false,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      res.status(409).json({ success: false, error: 'College code already exists. Use a different code.' });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
    return;
  }
  res.status(201).json({ success: true, college: data });
}

/**
 * PATCH /api/admin/colleges/:id
 */
export async function updateCollege(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { college_name, city, state, contact_email, contact_phone, is_active, registration_enabled } = req.body;
  const updates: any = {};
  if (college_name !== undefined) updates.college_name = college_name;
  if (city !== undefined) updates.city = city;
  if (state !== undefined) updates.state = state;
  if (contact_email !== undefined) updates.contact_email = contact_email;
  if (contact_phone !== undefined) updates.contact_phone = contact_phone;
  if (is_active !== undefined) updates.is_active = is_active;
  if (registration_enabled !== undefined) updates.registration_enabled = registration_enabled;

  const { data, error } = await supabase
    .from('colleges')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, college: data });
}

/**
 * DELETE /api/admin/colleges/:id
 */
export async function deleteCollege(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { error } = await supabase.from('colleges').delete().eq('id', id);
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, message: 'College deleted' });
}

/**
 * POST /api/admin/colleges/import
 * Bulk import colleges via Excel / CSV spreadsheet
 */
export async function bulkImportCollegesHandler(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'No Excel or CSV file uploaded' });
    return;
  }
  try {
    const { parseAndValidateCollegeFile, bulkInsertColleges } = await import('../services/collegeImportService');
    const parsed = parseAndValidateCollegeFile(req.file.buffer);
    if (parsed.errors.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Spreadsheet validation failed',
        errors: parsed.errors,
      });
      return;
    }
    const result = await bulkInsertColleges(parsed.validRows);
    res.json({
      success: result.valid,
      total: result.total_rows,
      inserted: result.inserted_count,
      skipped: result.skipped_count,
      colleges: result.colleges,
      message: `${result.inserted_count} college(s) successfully imported.`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'College import failed' });
  }
}

// ─────────────────────────────────────────────
// EXAM CODES
// ─────────────────────────────────────────────

/**
 * GET /api/admin/exam-codes
 * Scoped by role:
 * - super_admin / admin: sees all
 * - faculty: sees ONLY allocated sections and papers (assigned_faculty_id or created_by_staff_id)
 * - inspector: sees ONLY assigned exam or exams in assigned college
 * - college_admin: sees only exams for caller's college
 */
export async function listExamCodes(req: Request, res: Response): Promise<void> {
  const admin = (req as any).admin;
  const role = admin?.role;
  const isSuperAdmin = role === 'super_admin' || role === 'admin';
  const callerCollegeId = admin?.college_id;
  const staffId = admin?.staff_id || admin?.id || admin?.sub;

  let query = supabase
    .from('exam_codes')
    .select('*, college:college_id ( college_name, college_code )')
    .order('created_at', { ascending: false });

  if (role === 'faculty') {
    // Faculty see only their allocated sections and papers
    if (staffId) {
      query = (query as any).or(`assigned_faculty_id.eq.${staffId},created_by_staff_id.eq.${staffId}`);
    }
  } else if (role === 'inspector') {
    // Inspector only sees assigned exam or assigned college
    if (staffId && callerCollegeId) {
      query = (query as any).or(`assigned_inspector_id.eq.${staffId},college_id.eq.${callerCollegeId}`);
    } else if (staffId) {
      query = (query as any).eq('assigned_inspector_id', staffId);
    } else if (callerCollegeId) {
      query = (query as any).eq('college_id', callerCollegeId);
    }
  } else if (!isSuperAdmin && callerCollegeId) {
    query = (query as any).eq('college_id', callerCollegeId);
  }

  const { data, error } = await query;
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, exam_codes: data });
}

/**
 * POST /api/admin/exam-codes
 * Creates a new exam code for a college with section targeting and paper allocation.
 */
export async function createExamCode(req: Request, res: Response): Promise<void> {
  const {
    college_id,
    exam_name,
    subject,
    branch,
    passout_year,
    section_id,
    section_ids,
    batch_id,
    assigned_faculty_id,
    assigned_inspector_id,
    total_questions,
    duration_minutes,
    start_time,
    end_time,
  } = req.body;

  if (!college_id || !exam_name || !start_time || !end_time) {
    res.status(400).json({ success: false, error: 'college_id, exam_name, start_time, end_time are required' });
    return;
  }

  // Fetch college code for prefix
  const { data: college } = await supabase
    .from('colleges')
    .select('*')
    .eq('id', college_id)
    .single();

  if (!college) { res.status(404).json({ success: false, error: 'College not found' }); return; }

  const collegeCode = (college as any).college_code || (college as any).code || 'VRSEC';

  // Generate unique code – retry up to 5 times if collision
  let examCode = '';
  let attempts = 0;
  while (attempts < 5) {
    examCode = generateExamCode(collegeCode);
    const { data: existing } = await supabase
      .from('exam_codes')
      .select('exam_code')
      .eq('exam_code', examCode)
      .maybeSingle();
    if (!existing) break;
    attempts++;
  }

  if (!examCode) {
    res.status(500).json({ success: false, error: 'Could not generate unique exam code. Try again.' });
    return;
  }

  const targetedSections = Array.isArray(section_ids) && section_ids.length > 0
    ? section_ids
    : section_id
    ? [String(section_id).trim()]
    : [];

  const insertPayload: Record<string, any> = {
    exam_code: examCode,
    college_id: parseInt(college_id, 10),
    exam_name,
    subject: subject || null,
    branch: branch ? String(branch).trim().toUpperCase() : null,
    passout_year: passout_year ? Number(passout_year) : null,
    section_id: section_id ? String(section_id).trim() : (targetedSections[0] || null),
    section_ids: targetedSections,
    batch_id: batch_id ? String(batch_id).trim() : null,
    assigned_faculty_id: assigned_faculty_id || null,
    assigned_inspector_id: assigned_inspector_id || null,
    is_locked: false,
    paper_status: assigned_faculty_id ? 'allocated' : 'draft',
    total_questions: parseInt(total_questions, 10) || 30,
    duration_minutes: parseInt(duration_minutes, 10) || 60,
    start_time,
    end_time,
    is_active: true,
    created_by_staff_id: (req as any).admin?.staff_id || (req as any).admin?.sub || null,
  };

  const { data, error } = await supabase
    .from('exam_codes')
    .insert(insertPayload)
    .select(`*, college:college_id ( college_name, college_code )`)
    .single();

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }

  // Log in audit log
  if ((req as any).admin) {
    recordAuditLog(
      (req as any).admin,
      'CREATE_EXAM_CODE',
      'exam_codes',
      String(data.id),
      { exam_code: examCode, exam_name, college_id, branch, passout_year, section_ids: targetedSections },
      req
    ).catch(() => {});
  }

  // Generate QR data URL for the exam entry link
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  const entryUrl = `${clientOrigin}/enter-exam?code=${examCode}`;
  const qrDataUrl = await QRCode.toDataURL(entryUrl, { width: 300, margin: 2 });

  res.status(201).json({ success: true, exam_code: data, qr: qrDataUrl, entry_url: entryUrl });
}

/**
 * POST /api/admin/exam-codes/:id/allocate
 * Allocates a question paper to a faculty member per section, and optional inspector.
 */
export async function allocateQuestionPaper(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { faculty_id, section_id, section_ids, inspector_id } = req.body;

  // Resolve exam by numeric id or exam_code string
  const isNumeric = /^\d+$/.test(String(id));
  let examQuery = supabase.from('exam_codes').select('*');
  if (isNumeric) {
    examQuery = examQuery.eq('id', Number(id));
  } else {
    examQuery = examQuery.eq('exam_code', id);
  }
  const { data: existingExam } = await examQuery.maybeSingle();

  if (!existingExam) {
    res.status(404).json({ success: false, error: 'Exam not found' });
    return;
  }

  const updates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (faculty_id !== undefined) updates.assigned_faculty_id = faculty_id;
  if (inspector_id !== undefined) updates.assigned_inspector_id = inspector_id;
  if (section_id !== undefined) updates.section_id = section_id;
  if (section_ids !== undefined) updates.section_ids = Array.isArray(section_ids) ? section_ids : [section_ids];
  updates.paper_status = 'allocated';

  const { data, error } = await supabase
    .from('exam_codes')
    .update(updates)
    .eq('id', existingExam.id)
    .select('*, college:college_id ( college_name, college_code )')
    .single();

  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }

  // Record audit log
  if ((req as any).admin) {
    recordAuditLog(
      (req as any).admin,
      'ALLOCATE_QUESTION_PAPER',
      'exam_codes',
      String(existingExam.id),
      { faculty_id, section_id, section_ids, inspector_id },
      req
    ).catch(() => {});
  }

  res.json({
    success: true,
    message: 'Question paper allocated successfully',
    exam_code: data,
  });
}

/**
 * POST /api/admin/exam-codes/:id/lock-paper
 * Admin locks the paper so no further edits can occur.
 */
export async function lockQuestionPaper(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { is_locked = true } = req.body;

  const isNumeric = /^\d+$/.test(String(id));
  let examQuery = supabase.from('exam_codes').select('*');
  if (isNumeric) {
    examQuery = examQuery.eq('id', Number(id));
  } else {
    examQuery = examQuery.eq('exam_code', id);
  }
  const { data: existingExam } = await examQuery.maybeSingle();

  if (!existingExam) {
    res.status(404).json({ success: false, error: 'Exam not found' });
    return;
  }

  const { data, error } = await supabase
    .from('exam_codes')
    .update({
      is_locked: Boolean(is_locked),
      paper_status: is_locked ? 'locked' : 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', existingExam.id)
    .select()
    .single();

  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }

  if ((req as any).admin) {
    recordAuditLog(
      (req as any).admin,
      is_locked ? 'LOCK_QUESTION_PAPER' : 'UNLOCK_QUESTION_PAPER',
      'exam_codes',
      String(existingExam.id),
      { is_locked },
      req
    ).catch(() => {});
  }

  res.json({
    success: true,
    message: is_locked ? 'Question paper locked' : 'Question paper unlocked',
    is_locked: Boolean(is_locked),
    exam_code: data,
  });
}

/**
 * POST /api/admin/exam-codes/:id/replace-paper
 * Admin replaces questions or sets new paper with audit log.
 */
export async function replaceQuestionPaper(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { questions, reason } = req.body;

  const isNumeric = /^\d+$/.test(String(id));
  let examQuery = supabase.from('exam_codes').select('*');
  if (isNumeric) {
    examQuery = examQuery.eq('id', Number(id));
  } else {
    examQuery = examQuery.eq('exam_code', id);
  }
  const { data: ec } = await examQuery.maybeSingle();

  if (!ec) {
    res.status(404).json({ success: false, error: 'Exam code not found' });
    return;
  }

  if (Array.isArray(questions) && questions.length > 0) {
    await supabase.from('questions_ec').delete().eq('exam_code', ec.exam_code);

    const formatted = questions.map((q: any, idx: number) => ({
      exam_code: ec.exam_code,
      question: q.question || q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: (q.correct_answer || q.correct_option || 'A').toUpperCase(),
      marks: q.marks || 1,
      penalty: Number(q.penalty ?? q.negative_marks ?? 0),
      difficulty: q.difficulty || 'Medium',
      topic: q.topic || 'General',
      section: q.section || 'General',
      display_order: q.display_order || idx + 1,
    }));

    await supabase.from('questions_ec').insert(formatted);

    await supabase.from('exam_codes').update({
      total_questions: formatted.length,
      paper_status: 'replaced',
      updated_at: new Date().toISOString(),
    }).eq('id', ec.id);
  }

  if ((req as any).admin) {
    recordAuditLog(
      (req as any).admin,
      'REPLACE_QUESTION_PAPER',
      'exam_codes',
      String(id),
      { question_count: Array.isArray(questions) ? questions.length : 0, reason },
      req
    ).catch(() => {});
  }

  res.json({
    success: true,
    message: 'Question paper replaced successfully',
  });
}

/**
 * PATCH /api/admin/exam-codes/:id/toggle
 */
export async function toggleExamCode(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { is_active } = req.body;
  const { data, error } = await supabase
    .from('exam_codes')
    .update({ is_active })
    .eq('id', id)
    .select()
    .single();
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, exam_code: data });
}

/**
 * GET /api/admin/exam-codes/:id/qr
 * Returns the QR as PNG buffer
 */
export async function getExamCodeQR(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { data: ec } = await supabase.from('exam_codes').select('exam_code').eq('id', id).single();
  if (!ec) { res.status(404).json({ success: false, error: 'Exam code not found' }); return; }

  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  const entryUrl = `${clientOrigin}/enter-exam?code=${ec.exam_code}`;
  const qrBuffer = await QRCode.toBuffer(entryUrl, { type: 'png', width: 300 });
  res.set('Content-Type', 'image/png');
  res.send(qrBuffer);
}

export function extractCandidateRoll(identifier: string): string {
  const clean = String(identifier || '').trim().toUpperCase();
  if (clean.startsWith('GP-STU-') || clean.startsWith('GP-CAND-')) {
    const parts = clean.split('-');
    if (parts.length >= 4) {
      return parts.slice(2, -1).join('-');
    } else if (parts.length === 3) {
      return parts[2];
    }
  } else if (clean.startsWith('GP-')) {
    const parts = clean.split('-');
    if (parts.length >= 3) {
      return parts.slice(1, -1).join('-');
    }
  }
  return clean;
}

/**
 * Helper to enforce student eligibility against exam targeting.
 * Returns true if student is eligible (or if exam is untargeted).
 * Returns false if student is missing or does not match exam targeting.
 */
export async function validateStudentEligibility(
  exam: any,
  hallTicketOrRoll?: string | null
): Promise<boolean> {
  if (!exam) return false;

  const hasSectionTargeting = Boolean(
    (exam.section_id && String(exam.section_id).trim() && exam.section_id !== 'ALL') ||
    (Array.isArray(exam.section_ids) && exam.section_ids.filter((s: any) => s && s !== 'ALL').length > 0) ||
    (typeof exam.section_ids === 'string' && exam.section_ids.trim() && exam.section_ids !== 'ALL' && exam.section_ids !== '[]') ||
    (exam.branch && exam.branch !== 'ALL' && exam.branch !== 'ANY') ||
    (exam.passout_year && Number(exam.passout_year) > 0) ||
    (exam.batch_id && exam.batch_id !== 'ALL' && exam.batch_id !== 'ANY')
  );

  const cleanHt = hallTicketOrRoll && typeof hallTicketOrRoll === 'string' ? hallTicketOrRoll.trim().toUpperCase() : null;
  const roll = cleanHt ? extractCandidateRoll(cleanHt) : null;

  if (hasSectionTargeting) {
    if (!cleanHt) return false;
    const { data: students } = await supabase
      .from('students')
      .select('*')
      .or(`hall_ticket.eq.${cleanHt},roll_number.eq.${cleanHt}${roll && roll !== cleanHt ? `,hall_ticket.eq.${roll},roll_number.eq.${roll}` : ''}`)
      .limit(10);

    if (!students || students.length === 0) return false;
    return students.some((s: any) => isStudentEligibleForExam(s, exam));
  }

  // Untargeted exam with optional college scope
  if (cleanHt && exam.college_id && exam.college_id !== 'ALL' && exam.college_id !== 0) {
    const { data: students } = await supabase
      .from('students')
      .select('college_id')
      .or(`hall_ticket.eq.${cleanHt},roll_number.eq.${cleanHt}${roll && roll !== cleanHt ? `,hall_ticket.eq.${roll},roll_number.eq.${roll}` : ''}`)
      .limit(10);

    if (students && students.length > 0) {
      const anyCollegeMatch = students.some((s: any) => !s.college_id || String(s.college_id) === String(exam.college_id));
      if (!anyCollegeMatch) return false;
    }
  }

  return true;
}

// ─────────────────────────────────────────────
// STUDENT EXAM ENTRY (NO OTP)
// ─────────────────────────────────────────────

/**
 * POST /api/verify-exam-entry
 * PUBLIC – verifies hall ticket + exam code and allows entry
 */
export async function verifyExamEntry(req: Request, res: Response): Promise<void> {
  const hallTicket = req.body.hallTicket || req.body.hall_ticket;
  const examCode = req.body.examCode || req.body.exam_code;
  const studentName = req.body.studentName || req.body.candidateName || req.body.name;

  if (!hallTicket || !examCode) {
    res.status(400).json({ success: false, error: 'Hall ticket and exam code are required' });
    return;
  }

  const ht = hallTicket.trim().toUpperCase();
  const ec = examCode.trim().toUpperCase();

  // 1. Check exam code exists and is active
  let { data: exam, error: examError } = await supabase
    .from('exam_codes')
    .select(`
      *,
      college:college_id ( college_name, college_code )
    `)
    .eq('exam_code', ec)
    .eq('is_active', true)
    .maybeSingle();

  if (!exam) {
    // Try swapping 5 <-> S, 0 <-> O in exam code to handle character confusion
    const altCodes = [
      ec.replace(/5/g, 'S'),
      ec.replace(/S/g, '5'),
      ec.replace(/0/g, 'O'),
      ec.replace(/O/g, '0'),
    ].filter((c) => c !== ec);

    for (const alt of altCodes) {
      const { data: altExam } = await supabase
        .from('exam_codes')
        .select(`
          *,
          college:college_id ( college_name, college_code )
        `)
        .eq('exam_code', alt)
        .eq('is_active', true)
        .maybeSingle();
      if (altExam) {
        exam = altExam;
        break;
      }
    }
  }

  if (!exam) {
    // Auto-bridge: Check if questions were uploaded for this code, or if an exam exists in legacy exams table
    const { data: qCheck } = await supabase
      .from('questions_ec')
      .select('id, question, topic')
      .eq('exam_code', ec)
      .limit(1);

    const { data: legacyExam } = await supabase
      .from('exams')
      .select('*')
      .or(`id.eq.${ec},title.eq.${ec}`)
      .maybeSingle();

    if ((qCheck && qCheck.length > 0) || legacyExam) {
      const now = new Date();
      const newEc = {
        exam_code: ec,
        exam_name: legacyExam?.title || ec,
        subject: legacyExam?.title || (qCheck?.[0]?.topic) || 'General',
        duration_minutes: legacyExam?.duration_minutes || 60,
        start_time: legacyExam?.start_time || now.toISOString(),
        end_time: legacyExam?.end_time || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        is_active: true,
        is_launched: true,
        college_id: legacyExam?.college_id || 1,
        total_questions: legacyExam?.total_questions || (qCheck?.length || 15),
      };
      await supabase.from('exam_codes').upsert(newEc, { onConflict: 'exam_code' });
      const { data: freshlyCreated } = await supabase
        .from('exam_codes')
        .select(`
          *,
          college:college_id ( college_name, college_code )
        `)
        .eq('exam_code', ec)
        .maybeSingle();
      if (freshlyCreated) {
        exam = freshlyCreated;
      }
    }
  }

  if (examError || !exam) {
    res.status(404).json({ success: false, error: 'Invalid exam code. Please check and try again.' });
    return;
  }

  // 1.1 ENFORCE SECTION-TARGETED ELIGIBILITY (Must return 404, not 403)
  const isEligible = await validateStudentEligibility(exam, ht);
  if (!isEligible) {
    res.status(404).json({
      success: false,
      error: 'Exam not found or unavailable for your section',
      code: 'EXAM_NOT_FOUND',
    });
    return;
  }

  // 1.2 ENFORCE STUDENT EMAIL VERIFICATION (Item 9) & RESOLVE STUDENT RECORD
  const candidateRoll = extractCandidateRoll(ht);
  const { data: studentRecords } = await supabase
    .from('students')
    .select('id, name, email, is_verified, roll_number, hall_ticket, college_id')
    .or(`hall_ticket.eq.${ht},roll_number.eq.${ht}${candidateRoll && candidateRoll !== ht ? `,hall_ticket.eq.${candidateRoll},roll_number.eq.${candidateRoll}` : ''}`)
    .limit(10);

  const studentRecord = studentRecords?.find((s: any) => isStudentEligibleForExam(s, exam)) || studentRecords?.[0];

  if (studentRecord && studentRecord.is_verified === false) {
    res.status(403).json({
      success: false,
      error: 'Your student email is not verified. Please verify your email before starting this examination.',
      code: 'EMAIL_NOT_VERIFIED',
      email: studentRecord.email,
    });
    return;
  }

  const canonicalRoll = studentRecord?.roll_number || studentRecord?.hall_ticket || candidateRoll;
  const candidateDisplayName = studentRecord?.name || studentName?.trim() || canonicalRoll;
  const studentGatePass = `GP-STU-${canonicalRoll}-${(studentRecord?.id || '0000').substring(0, 4)}`.toUpperCase();
  const candidateGatePass = `GP-CAND-${canonicalRoll}-${(studentRecord?.id || '0000').substring(0, 4)}`.toUpperCase();

  // 1.3 ENFORCE INSPECTOR START (Item 3)
  const isDemoExam = ec.includes('DEMO') || ec === 'CS2026';
  const effectiveEc = exam.exam_code || ec;
  const isExamStarted = Boolean(
    exam.started_at ||
    exam.is_launched
  );
  if (!isDemoExam && !isExamStarted) {
    const { getExamStartedState } = await import('../services/socketService');
    const startedState = getExamStartedState(ec) || getExamStartedState(effectiveEc);
    if (!startedState) {
      res.status(403).json({
        success: false,
        error: 'The inspector has not started this examination yet. Please wait in the waiting lobby.',
        code: 'EXAM_NOT_STARTED_BY_INSPECTOR',
      });
      return;
    }
  }

  // 2. Time window check
  const now = new Date();
  const startTime = new Date(exam.start_time);
  const endTime = new Date(exam.end_time);

  if (now < startTime) {
    const diffMs = startTime.getTime() - now.getTime();
    const diffMins = Math.ceil(diffMs / 60000);
    res.status(403).json({
      success: false,
      error: `Exam has not started yet. It begins in ${diffMins} minute(s).`,
      code: 'EXAM_NOT_STARTED',
    });
    return;
  }

  if (now > endTime) {
    res.status(403).json({
      success: false,
      error: 'This exam code has expired. The exam window has closed.',
      code: 'EXAM_EXPIRED',
    });
    return;
  }

  // 3. Check for existing attempt
  const { data: existing } = await supabase
    .from('exam_code_attempts')
    .select('id, status, score, max_score')
    .or(`hall_ticket_no.eq.${ht},hall_ticket_no.eq.${canonicalRoll}`)
    .eq('exam_code', ec)
    .maybeSingle();

  if (existing) {
    if (existing.status === 'in_progress' || existing.status === 'active') {
      // ── 1a: Concurrent-session block ──────────────────────────────────────
      // Issue a FRESH session_token so any previously-open browser is evicted.
      // The new token is returned to THIS caller; the old tab's token no longer
      // matches and will receive SESSION_EVICTED on its next save/submit call.
      const freshToken = generateSessionToken();
      await supabase
        .from('exam_code_attempts')
        .update({ session_token: freshToken, last_resumed_at: new Date().toISOString() })
        .eq('id', existing.id);

      res.json({
        success: true,
        resumed: true,
        attempt_id: existing.id,
        session_token: freshToken,
        hallTicket: canonicalRoll,
        studentName: candidateDisplayName,
        student_gate_pass: studentGatePass,
        candidate_gate_pass: candidateGatePass,
        examDetails: {
          exam_code: exam.exam_code,
          exam_name: exam.exam_name,
          subject: exam.subject,
          duration_minutes: exam.duration_minutes,
          total_questions: exam.total_questions,
          end_time: exam.end_time,
          college: exam.college,
        },
        message: 'Resuming your existing session. Any other open tabs have been logged out.',
      });
      return;
    }

    if (['terminated', 'Terminated - violation', 'terminated_cheating', 'terminated_violation'].includes(existing.status)) {
      res.status(403).json({
        success: false,
        error: 'Your examination attempt was terminated due to a security violation and cannot be restarted. Only an administrator can grant re-entry clearance.',
        code: 'ATTEMPT_TERMINATED',
        status: existing.status,
      });
      return;
    }

    res.status(409).json({
      success: false,
      error: 'You have already completed this exam. Each student can attempt only once.',
      code: 'ALREADY_ATTEMPTED',
    });
    return;
  }

  // 4. Check questions exist for this exam code
  const { count: qCount } = await supabase
    .from('questions_ec')
    .select('id', { count: 'exact', head: true })
    .eq('exam_code', effectiveEc);

  if (!qCount || qCount === 0) {
    res.status(503).json({
      success: false,
      error: 'Questions not yet uploaded for this exam. Please contact your coordinator.',
    });
    return;
  }

  // 5. Create attempt record — include a fresh session_token from the start
  const newToken = generateSessionToken();
  const attemptStartTime = new Date().toISOString();
  const attemptEndTime = exam.end_time || new Date(Date.now() + (exam.duration_minutes || 60) * 60000).toISOString();
  const { data: attempt, error: insertError } = await supabase
    .from('exam_code_attempts')
    .insert({
      hall_ticket_no: canonicalRoll,
      exam_code: ec,
      student_name: candidateDisplayName,
      status: 'in_progress',
      session_token: newToken,
      start_time: attemptStartTime,
      end_time: attemptEndTime,
    })
    .select()
    .single();

  if (insertError) {
    res.status(500).json({ success: false, error: 'Failed to create attempt. Please try again.' });
    return;
  }

  res.json({
    success: true,
    valid: true,
    resumed: false,
    attempt_id: attempt.id,
    session_token: newToken,
    hallTicket: canonicalRoll,
    studentName: candidateDisplayName,
    student_gate_pass: studentGatePass,
    candidate_gate_pass: candidateGatePass,
    examDetails: {
      exam_code: exam.exam_code,
      exam_name: exam.exam_name,
      subject: exam.subject,
      duration_minutes: exam.duration_minutes,
      total_questions: exam.total_questions,
      end_time: exam.end_time,
      college: exam.college,
    },
  });
}

// ─────────────────────────────────────────────
// QUESTIONS FOR EXAM CODE
// ─────────────────────────────────────────────

/**
 * GET /api/exam-code/:code/questions
 * Returns questions (WITHOUT correct_answer) for an active exam
 */
export async function getExamCodeQuestions(req: Request, res: Response): Promise<void> {
  const { code } = req.params;
  const session_token = (req.query.session_token || req.query.sessionToken) as string | undefined;
  const ec = String(code).toUpperCase();

  // 1. Look up exam
  let { data: exam } = await supabase
    .from('exam_codes')
    .select('*')
    .eq('exam_code', ec)
    .maybeSingle();

  if (!exam) {
    const altCodes = [
      ec.replace(/5/g, 'S'),
      ec.replace(/S/g, '5'),
      ec.replace(/0/g, 'O'),
      ec.replace(/O/g, '0'),
    ].filter((c) => c !== ec);

    for (const alt of altCodes) {
      const { data: altExam } = await supabase
        .from('exam_codes')
        .select('*')
        .eq('exam_code', alt)
        .maybeSingle();
      if (altExam) {
        exam = altExam;
        break;
      }
    }
  }

  if (!exam) {
    res.status(404).json({ success: false, error: 'Exam not found or unavailable', code: 'EXAM_NOT_FOUND' });
    return;
  }

  // 1.1 Enforce targeting (Return 404 so untargeted students cannot tell exam exists)
  const attemptId = (req.query.attemptId || req.query.attempt_id) as string | undefined;
  let studentHt = (req.query.hallTicket || req.query.hall_ticket || req.query.candidateId || (req as any).student?.hallTicket || (req as any).student?.rollNumber) as string | undefined;
  if (!studentHt && attemptId) {
    const { data: att } = await supabase
      .from('exam_code_attempts')
      .select('hall_ticket_no')
      .eq('id', attemptId)
      .maybeSingle();
    studentHt = att?.hall_ticket_no;
  }

  const isEligible = await validateStudentEligibility(exam, studentHt);
  if (!isEligible) {
    res.status(404).json({ success: false, error: 'Exam not found or unavailable for your section', code: 'EXAM_NOT_FOUND' });
    return;
  }

  // ── 1a: verify session token (concurrent-session guard if attemptId provided) ──
  if (attemptId) {
    const tokenCheck = await verifyAttemptToken(String(attemptId ?? ""), String(code), session_token ? String(session_token) : undefined);
    if (!tokenCheck.valid) {
      if (tokenCheck.evicted) {
        res.status(409).json({ success: false, error: 'Your session was taken over from another device. Please log in again.', code: 'SESSION_EVICTED' });
      } else if (tokenCheck.terminated) {
        res.status(403).json({ success: false, error: 'This exam session has already ended.', code: 'SESSION_ENDED' });
      } else {
        res.status(403).json({ success: false, error: 'Invalid or expired attempt', code: 'INVALID_ATTEMPT' });
      }
      return;
    }
  }

  const effectiveCode = exam.exam_code || ec;
  const { data: questions, error } = await supabase
    .from('questions_ec')
    .select('id, question, option_a, option_b, option_c, option_d, marks, penalty, negative_marks, difficulty, topic, section, tags, display_order, starter_code')
    .eq('exam_code', effectiveCode)
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('created_at');

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }

  // Questions strictly preserve author upload order (display_order); options are deterministically shuffled per candidate
  const canonicalCandidate = String(studentHt || req.query.candidateId || attemptId || req.query.hallTicket || 'student').toUpperCase().trim();
  const studentIdentifier = `${canonicalCandidate}_${effectiveCode}`;
  const orderedQuestions = questions || [];

  // Question secrecy guard & per-student option shuffling:
  // Options are shuffled per student; grading strictly uses the server's master key.
  const sanitizedQuestions = orderedQuestions.map((q: any) => {
    const studentSeed = `${studentIdentifier}_${q.id}`;
    const opts = [
      { key: 'A', text: q.option_a },
      { key: 'B', text: q.option_b },
      { key: 'C', text: q.option_c },
      { key: 'D', text: q.option_d },
    ].filter((o) => o.text !== undefined && o.text !== null && String(o.text).trim().length > 0);

    const shuffledOpts = deterministicShuffle(opts, studentSeed);
    const { correct_answer, correct_option, explanation, ...safeQ } = q;
    return {
      ...safeQ,
      options: shuffledOpts.map((o) => o.text),
      option_a: shuffledOpts[0]?.text ?? null,
      option_b: shuffledOpts[1]?.text ?? null,
      option_c: shuffledOpts[2]?.text ?? null,
      option_d: shuffledOpts[3]?.text ?? null,
      penalty: Number(q.penalty ?? q.negative_marks ?? 0),
    };
  });

  res.json({
    success: true,
    server_shuffled: true,
    questions_shuffled: true,
    questions: sanitizedQuestions,
    total: sanitizedQuestions.length,
  });
}

/**
 * POST /api/exam-code/:code/submit
 * Grades and saves the final attempt
 */
export async function submitExamCodeAttempt(req: Request, res: Response): Promise<void> {
  const code = String(req.params.code || req.body?.examCode || req.body?.exam_code || '').toUpperCase();
  const attemptId = req.body.attemptId || req.body.attempt_id;
  const { answers, codeAnswers, violationCount, session_token } = req.body;
  const timeTakenSeconds = req.body.timeTakenSeconds ?? req.body.time_taken_seconds ?? 0;
  const candidateId = req.body.candidateId || req.body.hallTicket || req.body.hall_ticket;

  // Look up exam to check targeting
  let { data: exam } = await supabase
    .from('exam_codes')
    .select('*')
    .eq('exam_code', code)
    .maybeSingle();

  if (!exam) {
    const altCodes = [
      code.replace(/5/g, 'S'),
      code.replace(/S/g, '5'),
      code.replace(/0/g, 'O'),
      code.replace(/O/g, '0'),
    ].filter((c) => c !== code);

    for (const alt of altCodes) {
      const { data: altExam } = await supabase
        .from('exam_codes')
        .select('*')
        .eq('exam_code', alt)
        .maybeSingle();
      if (altExam) {
        exam = altExam;
        break;
      }
    }
  }

  if (!exam) {
    res.status(404).json({ success: false, error: 'Exam not found or unavailable', code: 'EXAM_NOT_FOUND' });
    return;
  }

  const effectiveCode = exam.exam_code || code;
  let attempt: any = null;

  // ── 1a & 1.4: verify session token or locate attempt by candidateId ──
  if (attemptId && session_token) {
    const tokenCheck = await verifyAttemptToken(String(attemptId ?? ""), String(effectiveCode), session_token ? String(session_token) : undefined);
    if (!tokenCheck.valid) {
      if (tokenCheck.evicted) {
        res.status(409).json({ success: false, error: 'Your session was taken over from another device.', code: 'SESSION_EVICTED' });
        return;
      }
      if (!tokenCheck.terminated && !tokenCheck.attempt) {
        res.status(404).json({ success: false, error: 'Attempt not found' });
        return;
      }
    }
    attempt = tokenCheck.attempt;
  } else if (attemptId) {
    const { data } = await supabase
      .from('exam_code_attempts')
      .select('*')
      .eq('id', attemptId)
      .maybeSingle();
    attempt = data;
  } else if (candidateId) {
    const { data } = await supabase
      .from('exam_code_attempts')
      .select('*')
      .eq('exam_code', effectiveCode)
      .or(`hall_ticket.eq.${candidateId},hall_ticket_no.eq.${candidateId}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    attempt = data;
  }

  if (!attempt) {
    res.status(404).json({ success: false, error: 'Attempt not found' });
    return;
  }

  // Enforce targeting check (Return 404 for ineligible/unauthenticated)
  const studentHt = attempt?.hall_ticket_no || candidateId;
  const isEligible = await validateStudentEligibility(exam, studentHt);
  if (!isEligible) {
    res.status(404).json({ success: false, error: 'Exam not found or unavailable for your section', code: 'EXAM_NOT_FOUND' });
    return;
  }
  if (attempt.status === 'completed') {
    res.status(409).json({ success: false, error: 'Already submitted' });
    return;
  }

  // ── 1.5 Server-Authoritative Timer & Grace Period (30s) Enforcement ──
  const { data: examData } = await supabase
    .from('exam_codes')
    .select('duration_minutes, total_marks')
    .eq('exam_code', code)
    .maybeSingle();

  const durationMinutes = examData?.duration_minutes || 60;
  const extraTime = attempt.extra_time_seconds || 0;
  const totalAllowedSec = durationMinutes * 60 + extraTime;
  const startTime = attempt.created_at ? new Date(attempt.created_at).getTime() : Date.now();
  const allowedEndTime = startTime + (totalAllowedSec * 1000) + (30 * 1000); // 30s grace window
  const isGraceExpired = Date.now() > allowedEndTime;

  // Merge buffered partial answers from server with final submitted answers
  const finalAnswers: Record<string, any> = {
    ...((attempt.partial_answers as Record<string, any>) || {}),
    ...(answers || {}),
  };

  // Fetch questions with correct answers for server-authoritative grading
  const { data: questions } = await supabase
    .from('questions_ec')
    .select('id, question, correct_answer, marks, penalty, negative_marks, topic, option_a, option_b, option_c, option_d, question_type')
    .eq('exam_code', String(code).toUpperCase());

  if (!questions) {
    res.status(500).json({ success: false, error: 'Could not fetch questions for grading' });
    return;
  }

  // ── 1.5 Pure Server-Authoritative Scoring & Negative Marking ──
  let totalScore = 0;
  let maxScore = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let mcqScore = 0;
  let mcqMaxScore = 0;
  const codingQuestionsList: Array<{ id: string; title: string; marks: number; submitted: boolean }> = [];
  const topicBreakdown: Record<string, { correct: number; wrong: number; score: number; maxScore: number; penalty?: number }> = {};
  const optLetters = ['A', 'B', 'C', 'D'];

  const canonicalCandidate = String(attempt.hall_ticket_no || attempt.hall_ticket || candidateId || attempt.id || 'student').toUpperCase().trim();
  const studentIdentifier = `${canonicalCandidate}_${effectiveCode}`;

  for (const q of questions) {
    const isCodingQ = q.question_type === 'code' || (!q.option_a && !q.option_b && (String(q.topic || '').toLowerCase().includes('algorithm') || String(q.topic || '').toLowerCase().includes('code')));
    const qMarks = Number(q.marks || 1);
    maxScore += qMarks;
    const topic = q.topic || 'General';
    if (!topicBreakdown[topic]) {
      topicBreakdown[topic] = { correct: 0, wrong: 0, score: 0, maxScore: 0, penalty: 0 };
    }
    topicBreakdown[topic].maxScore += qMarks;

    if (isCodingQ) {
      const codeAns = codeAnswers ? codeAnswers[q.id] : undefined;
      const isSubmitted = typeof codeAns === 'string' && codeAns.trim().length > 0;
      codingQuestionsList.push({
        id: q.id,
        title: q.question || 'Coding Challenge',
        marks: qMarks,
        submitted: isSubmitted,
      });
      // Coding questions are evaluated manually; not scored by MCQ letter matcher
      continue;
    }

    // MCQ question:
    mcqMaxScore += qMarks;
    const studentAnswer = finalAnswers[q.id];
    if (studentAnswer !== undefined && studentAnswer !== null && String(studentAnswer).trim() !== '') {
      // Re-create the student's unique shuffled option mapping
      const studentSeed = `${studentIdentifier}_${q.id}`;
      const origOpts = [
        { key: 'A', text: q.option_a },
        { key: 'B', text: q.option_b },
        { key: 'C', text: q.option_c },
        { key: 'D', text: q.option_d },
      ].filter((o) => o.text !== undefined && o.text !== null && String(o.text).trim().length > 0);
      const shuffledOpts = deterministicShuffle(origOpts, studentSeed);

      let studentMasterLetter = '';
      if (typeof studentAnswer === 'number') {
        studentMasterLetter = shuffledOpts[studentAnswer]?.key || optLetters[studentAnswer] || '';
      } else if (typeof studentAnswer === 'string') {
        const trimmed = studentAnswer.trim();
        if (/^[0-3]$/.test(trimmed)) {
          const idx = parseInt(trimmed, 10);
          studentMasterLetter = shuffledOpts[idx]?.key || optLetters[idx] || '';
        } else {
          // Check matching option text directly in original or shuffled
          const matchedByText = origOpts.find((o) => String(o.text).trim().toLowerCase() === trimmed.toLowerCase());
          if (matchedByText) {
            studentMasterLetter = matchedByText.key;
          } else if (/^[A-D]$/i.test(trimmed)) {
            // Mapped letter or direct letter
            const letterIdx = optLetters.indexOf(trimmed.toUpperCase());
            studentMasterLetter = shuffledOpts[letterIdx]?.key || trimmed.toUpperCase();
          }
        }
      }

      const expectedLetter = String(q.correct_answer || 'A').trim().toUpperCase();
      const penalty = Number(q.penalty ?? q.negative_marks ?? 0);

      if (studentMasterLetter && studentMasterLetter === expectedLetter) {
        totalScore += qMarks;
        mcqScore += qMarks;
        correctCount++;
        topicBreakdown[topic].correct++;
        topicBreakdown[topic].score += qMarks;
      } else {
        wrongCount++;
        const pen = penalty > 0 ? penalty : 0;
        totalScore -= pen;
        mcqScore -= pen;
        topicBreakdown[topic].wrong++;
        topicBreakdown[topic].score -= pen;
        topicBreakdown[topic].penalty = (topicBreakdown[topic].penalty || 0) + pen;
      }
    }
  }

  totalScore = Math.max(0, Math.round(totalScore * 100) / 100);
  mcqScore = Math.max(0, Math.round(mcqScore * 100) / 100);

  const vCount = violationCount !== undefined ? violationCount : (attempt.violation_count || 0);
  const isTerminatedViolation =
    req.body.status === 'terminated' ||
    req.body.status === 'terminated_cheating' ||
    req.body.status === 'terminated_violation' ||
    req.body.status === 'Terminated - violation' ||
    req.body.is_terminated ||
    vCount >= 5;

  const finalStatus = isTerminatedViolation
    ? 'terminated_cheating'
    : isGraceExpired
    ? 'auto_submitted_expired'
    : 'completed';

  const terminationReason = isTerminatedViolation
    ? (req.body.termination_reason || req.body.notes || 'Exam security lockdown violation')
    : null;

  // Update attempt record
  const { error: updateError } = await supabase
    .from('exam_code_attempts')
    .update({
      status: finalStatus,
      override_reason: terminationReason,
      end_time: new Date().toISOString(),
      score: totalScore,
      max_score: maxScore,
      correct_count: correctCount,
      wrong_count: wrongCount,
      answers: finalAnswers,
      code_answers: codeAnswers || {},
      time_taken_seconds: timeTakenSeconds || Math.round((Date.now() - startTime) / 1000),
      topic_breakdown: topicBreakdown,
      violation_count: vCount,
      session_token: isTerminatedViolation ? null : attempt.session_token,
    })
    .eq('id', attempt.id);

  if (updateError) { res.status(500).json({ success: false, error: updateError.message }); return; }

  // Record audit log entry and invalidate session for termination violations (Item 8)
  if (isTerminatedViolation) {
    try {
      await supabase.from('audit_log').insert({
        admin_id: 'system',
        action: 'STUDENT_EXAM_TERMINATED_VIOLATION',
        target_table: 'exam_code_attempts',
        target_id: attempt.id,
        payload: {
          user_id: studentHt || 'student',
          role: 'student',
          target: `exam_code_attempts:${attempt.id}`,
          exam_code: code,
          hall_ticket: studentHt,
          reason: terminationReason,
          answers_saved: Object.keys(finalAnswers).length,
          timestamp: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      });

      // Invalidate student active session in database
      if (studentHt) {
        await supabase
          .from('students')
          .update({ active_session_id: null })
          .or(`hall_ticket.eq.${studentHt},roll_number.eq.${studentHt}`);
      }
    } catch {}
  }

  // Persist attempt to results table for institutional record keeping
  try {
    await supabase.from('results').insert({
      attempt_id: attempt.id,
      exam_id: attempt.exam_code,
      exam_code: attempt.exam_code,
      student_id: attempt.hall_ticket_no,
      student_name: attempt.student_name,
      score: totalScore,
      max_score: maxScore,
      correct_count: correctCount,
      wrong_count: wrongCount,
      percentage: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0,
      status: finalStatus,
      answers: finalAnswers,
      time_taken_seconds: timeTakenSeconds || Math.round((Date.now() - startTime) / 1000),
      submitted_at: new Date().toISOString(),
    });
  } catch {}

  // Clear leaderboard cache for fresh rank computation
  try {
    leaderboardCache.delete(code);
  } catch {}

  // Trigger throttled room telemetry (<= 1 update per second per room)
  try {
    const { scheduleThrottledRoomUpdate } = await import('../services/socketService');
    scheduleThrottledRoomUpdate(code);
  } catch {}

  res.json({
    success: true,
    result: {
      score: totalScore,
      max_score: maxScore,
      correct_count: correctCount,
      wrong_count: wrongCount,
      percentage: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0,
      topic_breakdown: topicBreakdown,
      status: finalStatus,
      expired_grace: isGraceExpired,
      code_answers: codeAnswers || {},
      mcq_score: mcqScore,
      mcq_max_score: mcqMaxScore > 0 ? mcqMaxScore : maxScore,
      mcq_percentage: mcqMaxScore > 0 ? Math.round((mcqScore / mcqMaxScore) * 100) : (maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0),
      coding_questions: codingQuestionsList,
      has_coding_questions: codingQuestionsList.length > 0,
    },
  });
}

/**
 * POST /api/exam-code/:code/violation
 * Phase 2: Logs violation with snapshot thumbnail, timestamps, configurable thresholds,
 * grace period check, and maintains violation_timeline.
 */
export async function logExamCodeViolation(req: Request, res: Response): Promise<void> {
  const code = (req.params.code || req.body.examCode || '').toUpperCase();
  const attemptId = req.body.attemptId || req.body.candidateId;
  const violationType = req.body.violationType || req.body.eventType || 'tab_switch';
  const notes = req.body.notes || req.body.metadata?.message || req.body.message || '';
  const snapshot_thumb = req.body.snapshot_thumb || req.body.snapshot || null;

  // 1. Look up attempt
  let query = supabase.from('exam_code_attempts').select('*');
  if (attemptId) {
    query = (query as any).or(`id.eq.${attemptId},hall_ticket_no.eq.${attemptId},hall_ticket.eq.${attemptId}`);
  }
  if (code) {
    query = (query as any).eq('exam_code', code);
  }
  const { data: attempt } = await query.maybeSingle();

  if (!attempt || (attempt.status !== 'in_progress' && attempt.status !== 'active')) {
    res.status(403).json({ success: false, error: 'Invalid attempt or session closed' });
    return;
  }

  // 2. Fetch exam settings for configurable proctoring rules
  const { data: exam } = await supabase
    .from('exam_codes')
    .select('max_violations, auto_terminate, grace_period_seconds')
    .eq('exam_code', attempt.exam_code)
    .maybeSingle();

  const maxViolations = Number(exam?.max_violations) > 0 ? Number(exam?.max_violations) : 5;
  const autoTerminate = exam?.auto_terminate !== false;
  const gracePeriodSec = Number(exam?.grace_period_seconds) || 0;

  // Check if inside grace period since attempt creation
  const attemptStart = new Date(attempt.created_at || Date.now()).getTime();
  const elapsedSec = (Date.now() - attemptStart) / 1000;
  const isGrace = elapsedSec < gracePeriodSec;

  const currentTimeline = Array.isArray(attempt.violation_timeline) ? attempt.violation_timeline : [];
  const currentCount = Number(attempt.violation_count) || 0;
  const newCount = isGrace ? currentCount : currentCount + 1;

  const vItem = {
    id: `viol_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type: violationType,
    message: notes || `${violationType} detected`,
    timestamp: new Date().toISOString(),
    snapshot_thumb: snapshot_thumb ? String(snapshot_thumb).slice(0, 30000) : null,
    count: newCount,
    duration_seconds: req.body.duration_seconds || req.body.duration || null,
    exit_number: req.body.exitCount || req.body.exit_count || null,
    peak_db: req.body.peak_db || req.body.peakDb || null,
    in_grace_period: isGrace,
    is_false_positive: false,
    reviewed_by: null,
    reviewed_at: null,
  };

  const isForceBreach = violationType === 'EXAM_FORCE_TERMINATED_BREACH' || req.body.is_terminated === true;
  const shouldTerminate = (autoTerminate && newCount >= maxViolations) || isForceBreach;
  const terminationReason = isForceBreach ? (notes || 'Lockdown security violation (minimize/blur/fullscreen exit/unallowed key)') : 'Exceeded maximum permitted proctoring violations';

  const updatedTimeline = [...currentTimeline, vItem];

  await supabase
    .from('exam_code_attempts')
    .update({
      violation_count: newCount,
      violation_timeline: updatedTimeline,
      ...(shouldTerminate ? {
        status: 'terminated_cheating',
        override_reason: terminationReason,
        end_time: new Date().toISOString(),
        session_token: null,
      } : {}),
    })
    .eq('id', attempt.id);

  if (shouldTerminate) {
    const candId = attempt.hall_ticket_no || attempt.hall_ticket || String(attempt.id);
    try {
      await supabase.from('audit_log').insert({
        admin_id: 'system',
        action: 'STUDENT_EXAM_TERMINATED_VIOLATION',
        target_table: 'exam_code_attempts',
        target_id: attempt.id,
        payload: {
          user_id: candId,
          role: 'student',
          target: `exam_code_attempts:${attempt.id}`,
          exam_code: code,
          hall_ticket: candId,
          reason: terminationReason,
          violation_type: violationType,
          timestamp: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      });

      // Invalidate student active session
      await supabase
        .from('students')
        .update({ active_session_id: null })
        .or(`hall_ticket.eq.${candId},roll_number.eq.${candId}`);
    } catch {}
  }

  try {
    await supabase.from('proctor_logs').insert({
      id: vItem.id,
      exam_id: code,
      candidate_id: attempt.hall_ticket_no || attempt.hall_ticket || String(attempt.id),
      event_type: violationType,
      metadata: { message: notes || `${violationType} detected`, count: newCount, snapshot_thumb: vItem.snapshot_thumb, terminated: shouldTerminate },
      created_at: vItem.timestamp,
    });
  } catch {}

  // Broadcast live to Admin and Inspector WebSocket monitors
  try {
    broadcastViolationToMonitor(code, {
      ...vItem,
      candidate_id: attempt.hall_ticket_no || attempt.hall_ticket || String(attempt.id),
      hall_ticket: attempt.hall_ticket_no || attempt.hall_ticket || String(attempt.id),
      student_name: attempt.student_name || 'Candidate',
      exam_code: code,
      terminated: shouldTerminate,
      termination_reason: shouldTerminate ? terminationReason : null,
    });
  } catch {}

  res.json({
    success: true,
    violation_id: vItem.id,
    violation_count: newCount,
    count: newCount,
    max_violations: maxViolations,
    in_grace_period: isGrace,
    terminated: shouldTerminate,
    message: isForceBreach
      ? `EXAM TERMINATED: ${terminationReason}`
      : isGrace
      ? `Grace period active: ${notes || violationType} noted without strike.`
      : shouldTerminate
      ? `Exam auto-terminated due to reaching ${maxViolations} violations.`
      : `Warning ${newCount}/${maxViolations}: ${notes || violationType}.`,
  });
}

/**
 * POST /api/exam-code/:code/screen-thumbnail
 * Phase 1.2: Records periodic (30s) screen capture thumbnail for proctoring audit
 */
export async function saveScreenThumbnail(req: Request, res: Response): Promise<void> {
  const code = (req.params.code || req.body.examCode || '').toUpperCase();
  const candidateId = req.body.candidateId || req.body.hallTicket;
  const thumbnail = req.body.thumbnail || req.body.screen_thumb;
  const timestamp = req.body.timestamp || new Date().toISOString();

  if (!candidateId || !thumbnail) {
    res.status(400).json({ success: false, error: 'candidateId and thumbnail required' });
    return;
  }

  await supabase
    .from('exam_code_attempts')
    .update({
      latest_screen_thumb: String(thumbnail).slice(0, 50000),
      screen_thumb_updated_at: timestamp,
    })
    .or(`hall_ticket.eq.${candidateId},hall_ticket_no.eq.${candidateId}`);

  res.json({ success: true, timestamp });
}

/**
 * GET /api/admin/attempts/:id/violations
 * Phase 2: Returns candidate violation timeline with snapshot evidence
 */
export async function getAttemptViolations(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { data: attempt, error } = await supabase
    .from('exam_code_attempts')
    .select('id, exam_code, hall_ticket_no, student_name, violation_count, violation_timeline, status, created_at, end_time')
    .eq('id', id)
    .maybeSingle();

  if (error || !attempt) {
    res.status(404).json({ success: false, error: 'Attempt not found' });
    return;
  }

  res.json({
    success: true,
    attempt: {
      id: attempt.id,
      exam_code: attempt.exam_code,
      hall_ticket_no: attempt.hall_ticket_no,
      student_name: attempt.student_name,
      violation_count: attempt.violation_count || 0,
      status: attempt.status,
      timeline: attempt.violation_timeline || [],
    },
  });
}

/**
 * PATCH /api/admin/attempts/:id/violations/:violationId/review
 * Phase 2: False-positive review + override
 */
export async function reviewAttemptViolation(req: Request, res: Response): Promise<void> {
  const { id, violationId } = req.params;
  const { is_false_positive, review_notes } = req.body;
  const adminUser = (req as any).admin?.sub || (req as any).admin?.name || 'admin';

  const { data: attempt, error } = await supabase
    .from('exam_code_attempts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !attempt) {
    res.status(404).json({ success: false, error: 'Attempt not found' });
    return;
  }

  const timeline = Array.isArray(attempt.violation_timeline) ? [...attempt.violation_timeline] : [];
  const targetIdx = timeline.findIndex((v: any) => v.id === violationId);
  if (targetIdx === -1) {
    res.status(404).json({ success: false, error: 'Violation record not found in candidate timeline' });
    return;
  }

  timeline[targetIdx] = {
    ...timeline[targetIdx],
    is_false_positive: Boolean(is_false_positive),
    review_notes: review_notes || (is_false_positive ? 'Marked as false positive by admin' : 'Confirmed by admin'),
    reviewed_by: adminUser,
    reviewed_at: new Date().toISOString(),
  };

  // Recalculate active (non-false-positive and non-grace) violations
  const activeCount = timeline.filter((v: any) => !v.is_false_positive && !v.in_grace_period).length;

  // Check if attempt was terminated for cheating and now qualifies for restoration
  let newStatus = attempt.status;
  let restored = false;
  if (attempt.status === 'terminated_cheating' && activeCount < 5) {
    newStatus = 'in_progress';
    restored = true;
  }

  await supabase
    .from('exam_code_attempts')
    .update({
      violation_count: activeCount,
      violation_timeline: timeline,
      status: newStatus,
    })
    .eq('id', id);

  res.json({
    success: true,
    message: is_false_positive ? 'Violation marked as false positive.' : 'Violation confirmed.',
    violation_count: activeCount,
    status: newStatus,
    restored,
    timeline,
  });
}

/**
 * POST /api/exam-code/:code/save-answer
 * 1b & 1.4: Per-question autosave and batch offline buffer sync with session-token and candidateId guards.
 */
export async function saveExamCodeAnswer(req: Request, res: Response): Promise<void> {
  const code = String(req.params.code || req.body?.examCode || req.body?.exam_code || '').toUpperCase();
  const attemptId = req.body.attemptId || req.body.attempt_id;
  const { question_id, answer, answers, items, current_question_index, session_token } = req.body;
  const candidateId = req.body.candidateId || req.body.hallTicket || req.body.hall_ticket;

  // Look up exam to check targeting
  const { data: exam } = await supabase
    .from('exam_codes')
    .select('*')
    .eq('exam_code', code)
    .maybeSingle();

  if (!exam) {
    res.status(404).json({ success: false, error: 'Exam not found or unavailable', code: 'EXAM_NOT_FOUND' });
    return;
  }

  let attempt: any = null;

  if (attemptId) {
    if (!session_token) {
      res.status(400).json({ success: false, error: 'session_token required when attemptId is provided', code: 'TOKEN_REQUIRED' });
      return;
    }
    const tokenCheck = await verifyAttemptToken(String(attemptId), String(code), String(session_token));
    if (!tokenCheck.valid) {
      const errCode = tokenCheck.evicted ? 'SESSION_EVICTED' : tokenCheck.terminated ? 'SESSION_ENDED' : 'INVALID_ATTEMPT';
      res.status(tokenCheck.evicted ? 409 : 403).json({ success: false, code: errCode });
      return;
    }
    attempt = tokenCheck.attempt;
  } else if (candidateId) {
    const { data } = await supabase
      .from('exam_code_attempts')
      .select('*')
      .eq('exam_code', code)
      .or(`hall_ticket.eq.${candidateId},hall_ticket_no.eq.${candidateId}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    attempt = data;
  } else {
    res.status(400).json({ success: false, error: 'attemptId or candidateId required' });
    return;
  }

  if (!attempt) {
    res.status(404).json({ success: false, error: 'Attempt not found or session expired', code: 'INVALID_ATTEMPT' });
    return;
  }

  // Enforce targeting check (Return 404 for ineligible/unauthenticated)
  const studentHt = attempt?.hall_ticket_no || candidateId;
  const isEligible = await validateStudentEligibility(exam, studentHt);
  if (!isEligible) {
    res.status(404).json({ success: false, error: 'Exam not found or unavailable for your section', code: 'EXAM_NOT_FOUND' });
    return;
  }

  const existing = (attempt.partial_answers as Record<string, string>) || {};

  // Single answer
  if (question_id && answer !== undefined && answer !== null) {
    existing[String(question_id)] = String(answer);
  }

  // Batch map
  if (answers && typeof answers === 'object') {
    for (const [qId, ans] of Object.entries(answers)) {
      if (ans !== undefined && ans !== null) {
        existing[String(qId)] = String(ans);
      }
    }
  }

  // Batch array of items
  if (Array.isArray(items)) {
    for (const item of items) {
      const qId = item.question_id || item.questionId;
      const ans = item.answer;
      if (qId && ans !== undefined && ans !== null) {
        existing[String(qId)] = String(ans);
      }
    }
  }

  const upd: Record<string, unknown> = { partial_answers: existing };
  if (current_question_index !== undefined && Number.isInteger(Number(current_question_index))) {
    upd.last_question_index = Number(current_question_index);
  }

  await supabase.from('exam_code_attempts').update(upd).eq('id', attempt.id);

  // Trigger throttled room telemetry (<= 1 update per second per room)
  try {
    const { scheduleThrottledRoomUpdate } = await import('../services/socketService');
    scheduleThrottledRoomUpdate(code);
  } catch {}

  res.json({
    success: true,
    saved: true,
    total_saved: Object.keys(existing).length,
    partial_answers: existing,
  });
}

/**
 * GET /api/exam-code/:code/resume-state
 * 1b & 1.4: Returns partial_answers + last_question_index for crash/refresh recovery.
 */
export async function getExamCodeResumeState(req: Request, res: Response): Promise<void> {
  const code = String(req.params.code || '').toUpperCase();
  const { session_token } = req.query as { session_token?: string };
  const attemptId = (req.query.attemptId || req.query.attempt_id) as string | undefined;
  const candidateId = (req.query.candidateId || req.query.hallTicket || req.query.hall_ticket) as string | undefined;

  // Look up exam to check targeting
  const { data: exam } = await supabase
    .from('exam_codes')
    .select('*')
    .eq('exam_code', code)
    .maybeSingle();

  if (!exam) {
    res.status(404).json({ success: false, error: 'Exam not found or unavailable', code: 'EXAM_NOT_FOUND' });
    return;
  }

  let attempt: any = null;

  if (attemptId && session_token) {
    const tokenCheck = await verifyAttemptToken(String(attemptId), String(code), String(session_token));
    if (!tokenCheck.valid) {
      res.status(tokenCheck.evicted ? 409 : 403).json({
        success: false,
        code: tokenCheck.evicted ? 'SESSION_EVICTED' : 'INVALID_ATTEMPT',
      });
      return;
    }
    attempt = tokenCheck.attempt;
  } else if (attemptId) {
    const { data } = await supabase.from('exam_code_attempts').select('*').eq('id', attemptId).maybeSingle();
    attempt = data;
  } else if (candidateId) {
    const { data } = await supabase
      .from('exam_code_attempts')
      .select('*')
      .eq('exam_code', code)
      .or(`hall_ticket.eq.${candidateId},hall_ticket_no.eq.${candidateId}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    attempt = data;
  } else {
    res.status(400).json({ success: false, error: 'attemptId or candidateId required' });
    return;
  }

  if (!attempt) {
    res.status(404).json({ success: false, error: 'Attempt not found' });
    return;
  }

  // Enforce targeting check (Return 404 for ineligible/unauthenticated)
  const studentHt = attempt?.hall_ticket_no || candidateId;
  const isEligible = await validateStudentEligibility(exam, studentHt);
  if (!isEligible) {
    res.status(404).json({ success: false, error: 'Exam not found or unavailable for your section', code: 'EXAM_NOT_FOUND' });
    return;
  }

  res.json({
    success: true,
    attempt,
    answers: attempt.partial_answers || {},
    partial_answers: attempt.partial_answers || {},
    last_question_index: attempt.last_question_index ?? 0,
  });
}

// ─────────────────────────────────────────────
// LEADERBOARD CACHE (read-heavy scaling)
// ─────────────────────────────────────────────
const leaderboardCache = new Map<string, { timestamp: number; payload: any }>();
const LEADERBOARD_CACHE_TTL_MS = 5000;

/**
 * GET /api/exam-code/:code/leaderboard
 * Public leaderboard for an exam code (college-scoped)
 */
export async function getExamCodeLeaderboard(req: Request, res: Response): Promise<void> {
  const { code } = req.params;
  const cacheKey = String(code).toUpperCase();

  const cached = leaderboardCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < LEADERBOARD_CACHE_TTL_MS) {
    res.json(cached.payload);
    return;
  }

  const { data, error } = await supabase
    .from('exam_code_attempts')
    .select('hall_ticket_no, student_name, score, max_score, correct_count, wrong_count, time_taken_seconds, topic_breakdown, status, created_at')
    .eq('exam_code', cacheKey)
    .in('status', ['completed', 'submitted'])
    .order('score', { ascending: false })
    .order('time_taken_seconds', { ascending: true });

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }

  const leaderboard = (data || []).map((row, index) => ({
    rank: index + 1,
    hall_ticket: row.hall_ticket_no,
    hall_ticket_no: row.hall_ticket_no,
    student_id: row.hall_ticket_no,
    name: row.student_name || row.hall_ticket_no,
    student_name: row.student_name || row.hall_ticket_no,
    score: row.score,
    max_score: row.max_score,
    percentage: row.max_score > 0 ? Math.round((Number(row.score) / Number(row.max_score)) * 100) : 0,
    correct_count: row.correct_count,
    wrong_count: row.wrong_count,
    time_taken_seconds: row.time_taken_seconds,
    topic_breakdown: row.topic_breakdown,
    status: row.status,
  }));

  const payload = { success: true, leaderboard, total: leaderboard.length };
  leaderboardCache.set(cacheKey, { timestamp: Date.now(), payload });

  res.json(payload);
}

/**
 * POST /api/admin/exam-codes/:id/import-questions
 * Excel upload of questions for an exam code
 */
/**
 * POST /api/admin/exam-codes/:id/import-questions
 * Phase 3: Excel upload with duplicate detection, section-wise tags, and validation report
 */
export async function importQuestionsForExamCode(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  if (!req.file) {
    res.status(400).json({ success: false, error: 'No file uploaded' });
    return;
  }

  // Verify exam code exists
  const { data: ec } = await supabase.from('exam_codes').select('exam_code').eq('id', id).single();
  if (!ec) { res.status(404).json({ success: false, error: 'Exam code not found' }); return; }

  // Parse Excel
  const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });

  if (rows.length === 0) {
    res.status(400).json({ success: false, error: 'Excel file is empty' });
    return;
  }

  // Fetch existing questions for duplicate detection
  const { data: existingDbQuestions } = await supabase
    .from('questions_ec')
    .select('question')
    .eq('exam_code', ec.exam_code);

  const seenNorm = new Set<string>(
    (existingDbQuestions || []).map((q: any) =>
      String(q.question || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    )
  );

  const validRows: any[] = [];
  const errors: string[] = [];
  const duplicates: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // Excel row (header=1)

    // Normalize keys
    const norm: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      norm[k.trim().toLowerCase().replace(/[\s_]/g, '')] = String(v ?? '').trim();
    }

    const question = String(
      norm['questiontext'] || norm['question'] || row['Question'] || row['question'] || ''
    ).trim();

    // Check pipe options (Col C: option1 | option2 | option3 | option4)
    const optionsPipe = String(
      norm['options'] || norm['option1option2option3option4'] || norm['optionslist'] || ''
    ).trim();

    let optA = '';
    let optB = '';
    let optC = '';
    let optD = '';

    if (optionsPipe && optionsPipe.includes('|')) {
      const parts = optionsPipe.split('|').map((s) => s.trim());
      optA = parts[0] || '';
      optB = parts[1] || '';
      optC = parts[2] || '';
      optD = parts[3] || '';
    } else {
      optA = String(norm['optiona'] ?? row['OptionA'] ?? row['Option A'] ?? row['option_a'] ?? '').trim();
      optB = String(norm['optionb'] ?? row['OptionB'] ?? row['Option B'] ?? row['option_b'] ?? '').trim();
      optC = String(norm['optionc'] ?? row['OptionC'] ?? row['Option C'] ?? row['option_c'] ?? '').trim();
      optD = String(norm['optiond'] ?? row['OptionD'] ?? row['Option D'] ?? row['option_d'] ?? '').trim();
    }

    let starterCode = String(
      norm['startercode'] || norm['samplecode'] || norm['code'] || norm['codesnippet'] || norm['snippet'] ||
      row['Starter Code'] || row['Sample Code'] || row['Code'] || ''
    ).trim();
    if (!starterCode && question.includes('\n')) {
      const parts = question.split(/\n\s*\n/);
      if (parts.length > 1) {
        starterCode = parts.slice(1).join('\n\n').trim();
      }
    }

    const qType = String(norm['type'] || norm['questiontype'] || 'mcq').toLowerCase();
    if (qType === 'code' && (!optA || !optB)) {
      optA = 'Submission';
      optB = '-';
      optC = '-';
      optD = '-';
    }

    let correctRaw = String(
      norm['correctindex'] || norm['correct'] || norm['correctoption'] || norm['correctanswer'] || row['Correct'] || row['correct'] || row['CorrectAnswer'] || ''
    ).trim().toUpperCase();

    if (correctRaw === '0') correctRaw = 'A';
    else if (correctRaw === '1') correctRaw = 'B';
    else if (correctRaw === '2') correctRaw = 'C';
    else if (correctRaw === '3') correctRaw = 'D';

    const correct = correctRaw;
    const marks = parseFloat(String(norm['marks'] || row['Marks'] || row['marks'] || '1'));
    const topic = String(norm['topic'] || row['Topic'] || row['topic'] || 'General').trim();
    const section = String(norm['section'] || row['Section'] || row['section'] || topic).trim();
    const tags = String(norm['tags'] || row['Tags'] || row['tags'] || '').trim();
    const difficulty = String(norm['difficulty'] || row['Difficulty'] || row['difficulty'] || 'Medium').trim();
    const explanation = String(norm['explanation'] || row['Explanation'] || row['explanation'] || '').trim();

    if (!question) { errors.push(`Row ${rowNum}: Question is empty`); continue; }
    if (!optA || !optB || !optC || !optD) { errors.push(`Row ${rowNum}: Missing options`); continue; }
    if (!['A', 'B', 'C', 'D'].includes(correct)) { errors.push(`Row ${rowNum}: Correct answer must be A, B, C, or D`); continue; }
    if (isNaN(marks) || marks <= 0) { errors.push(`Row ${rowNum}: Invalid marks value`); continue; }

    const normKey = question.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seenNorm.has(normKey)) {
      duplicates.push(`Row ${rowNum}: "${question.slice(0, 45)}..." is a duplicate.`);
      continue;
    }
    seenNorm.add(normKey);

    validRows.push({
      exam_code: ec.exam_code,
      question,
      question_text: question,
      option_a: optA,
      option_b: optB,
      option_c: optC,
      option_d: optD,
      correct_answer: correct,
      marks,
      topic,
      section,
      tags: tags ? tags.split(',').map((t) => t.trim()) : [],
      difficulty: ['Easy', 'Medium', 'Hard'].includes(difficulty) ? difficulty : 'Medium',
      explanation: explanation || null,
      starter_code: starterCode || null,
      display_order: i + 1,
    });
  }

  if (validRows.length === 0) {
    res.status(400).json({
      success: false,
      error: 'No valid rows found',
      row_errors: errors,
      duplicates,
    });
    return;
  }

  const { error: insertError } = await supabase.from('questions_ec').insert(validRows);
  if (insertError) {
    res.status(500).json({ success: false, error: insertError.message });
    return;
  }

  // Automatically keep exam_codes total_questions count and questions table in sync
  try {
    const { count: totalQ } = await supabase
      .from('questions_ec')
      .select('id', { count: 'exact', head: true })
      .eq('exam_code', ec.exam_code);
    await supabase
      .from('exam_codes')
      .update({ total_questions: totalQ || validRows.length, is_active: true })
      .eq('exam_code', ec.exam_code);

    await supabase.from('questions').insert(
      validRows.map((r: any) => ({
        exam_id: ec.exam_code,
        question_text: r.question,
        option_a: r.option_a,
        option_b: r.option_b,
        option_c: r.option_c,
        option_d: r.option_d,
        correct_option: r.correct_answer.toLowerCase(),
        marks: r.marks,
        penalty: 0,
        topic: r.topic,
        difficulty: r.difficulty,
        section: r.section,
        starter_code: r.starter_code,
      }))
    );
  } catch {}

  res.json({
    success: true,
    total_rows: rows.length,
    inserted_count: validRows.length,
    duplicate_count: duplicates.length,
    skipped_count: rows.length - validRows.length,
    duplicates,
    validation_errors: errors,
    message: `${validRows.length} questions imported for exam code ${ec.exam_code}.`,
  });
}

/**
 * POST /api/admin/questions/validate-preview
 * Faculty upload questions by Excel in the 5-column format with validation and preview.
/**
 * GET /api/admin/questions/sample-template
 * Streams an authentic 2-sheet Excel template (.xlsx):
 * - Sheet 1: "Questions" (Type, Question, Option A, Option B, Option C, Option D, Correct Answer, Marks, Penalty, Topic, Difficulty, Diagram URL, Test Cases)
 * - Sheet 2: "Instructions" (Format specification, supported types, test case syntax guide)
 */
export async function downloadSampleQuestionsTemplate(req: Request, res: Response): Promise<void> {
  try {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Questions
    const sampleQuestions = [
      {
        'Type': 'MCQ',
        'Question': 'What is the average time complexity of searching in a Hash Map with uniform hashing?',
        'Option A': 'O(1)',
        'Option B': 'O(n)',
        'Option C': 'O(log n)',
        'Option D': 'O(n log n)',
        'Correct Answer': 'A',
        'Marks': 2,
        'Penalty': 0.5,
        'Topic': 'Data Structures & Algorithms',
        'Difficulty': 'Easy',
        'Diagram URL': '',
        'Test Cases': '',
      },
      {
        'Type': 'Coding',
        'Question': 'Write a function isPalindrome(s) that returns true if the input string is a palindrome, ignoring non-alphanumeric characters and casing.',
        'Option A': '',
        'Option B': '',
        'Option C': '',
        'Option D': '',
        'Correct Answer': 'def isPalindrome(s):\\n    cleaned = [c.lower() for c in s if c.isalnum()]\\n    return cleaned == cleaned[::-1]',
        'Marks': 10,
        'Penalty': 0,
        'Topic': 'Algorithms & Two Pointers',
        'Difficulty': 'Medium',
        'Diagram URL': '',
        'Test Cases': JSON.stringify([
          { input: '"A man, a plan, a canal: Panama"', output: 'true' },
          { input: '"race a car"', output: 'false' },
          { input: '"0P"', output: 'false' },
        ]),
      },
      {
        'Type': 'Diagram',
        'Question': 'In the microservices network diagram below, which service acts as the API Gateway enforcing token verification?',
        'Option A': 'Service Alpha (Auth Proxy)',
        'Option B': 'Service Beta (Worker Node)',
        'Option C': 'Ingress Envoy Gateway',
        'Option D': 'Redis Session Cache',
        'Correct Answer': 'C',
        'Marks': 3,
        'Penalty': 0.75,
        'Topic': 'Distributed Architecture',
        'Difficulty': 'Hard',
        'Diagram URL': 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800',
        'Test Cases': '',
      },
      {
        'Type': 'Aptitude',
        'Question': 'A train traveling at 72 km/h crosses a 180-meter long platform in 15 seconds. What is the length of the train in meters?',
        'Option A': '100 m',
        'Option B': '120 m',
        'Option C': '150 m',
        'Option D': '180 m',
        'Correct Answer': 'B',
        'Marks': 2,
        'Penalty': 0,
        'Topic': 'Quantitative Aptitude & Velocity',
        'Difficulty': 'Medium',
        'Diagram URL': '',
        'Test Cases': '',
      },
    ];

    const wsQuestions = XLSX.utils.json_to_sheet(sampleQuestions, {
      header: [
        'Type',
        'Question',
        'Option A',
        'Option B',
        'Option C',
        'Option D',
        'Correct Answer',
        'Marks',
        'Penalty',
        'Topic',
        'Difficulty',
        'Diagram URL',
        'Test Cases',
      ],
    });
    XLSX.utils.book_append_sheet(wb, wsQuestions, 'Questions');

    // Sheet 2: Instructions
    const instructionsData = [
      ['LOGICWHILE QUIZ (LiRE) - EXCEL QUESTION IMPORTER SPECIFICATION', ''],
      ['', ''],
      ['COLUMN NAME', 'REQUIRED?', 'SUPPORTED VALUES / SYNTAX', 'DETAILS & EXAMPLES'],
      ['Type', 'YES', 'MCQ | Coding | Aptitude | Diagram', 'The classification category for the question.'],
      ['Question', 'YES', 'Text string', 'The full question statement or code prompt.'],
      ['Option A', 'Conditional', 'Text string', 'Required for MCQ and Diagram questions. Leave blank for Coding.'],
      ['Option B', 'Conditional', 'Text string', 'Required for MCQ and Diagram questions. Leave blank for Coding.'],
      ['Option C', 'Conditional', 'Text string', 'Required for MCQ and Diagram questions. Leave blank for Coding.'],
      ['Option D', 'Conditional', 'Text string', 'Required for MCQ and Diagram questions. Leave blank for Coding.'],
      ['Correct Answer', 'YES', 'A / B / C / D for MCQ & Diagram; canonical output/solution for Coding; value for Aptitude', 'Canonical answer. MCQ & Diagram must be A, B, C, or D.'],
      ['Marks', 'NO', 'Positive Number (default: 1)', 'Score awarded on correct response.'],
      ['Penalty', 'NO', 'Non-negative Number (default: 0)', 'Score deducted on incorrect response.'],
      ['Topic', 'NO', 'Text string (e.g. Data Structures, Web, Quant)', 'Subject matter or syllabus topic.'],
      ['Difficulty', 'NO', 'Easy | Medium | Hard (default: Medium)', 'Difficulty tier.'],
      ['Diagram URL', 'Conditional', 'Valid HTTP or HTTPS image URL', 'Required for Diagram questions. Must start with http:// or https://.'],
      ['Test Cases', 'Conditional', 'JSON array or Input/Output pairs', 'Required for Coding questions. Syntax: [{"input":"...","output":"..."}] or "Input: 2 3; Output: 5"'],
      ['', ''],
      ['TEST CASE SYNTAX GUIDE FOR CODING QUESTIONS:', ''],
      ['Option 1: JSON Array (Recommended)', '[{"input": "2 3", "output": "5"}, {"input": "10 20", "output": "30"}]'],
      ['Option 2: Input/Output Pairs', 'Input: 2 3; Output: 5 | Input: 10 20; Output: 30'],
    ];

    const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="LogicWhileLiRE_Questions_Template.xlsx"');
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to generate template' });
  }
}

/**
 * POST /api/admin/questions/validate-preview
 * Validates uploaded Excel / CSV rows across MCQ, Coding, Aptitude, Diagram types.
 * Flags missing required fields (Question, Correct Answer, Type) and type-specific constraints.
 */
export async function validateAndPreviewQuestions(req: Request, res: Response): Promise<void> {
  try {
    let rows: any[] = [];
    if (req.file) {
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames.includes('Questions') ? 'Questions' : workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
    } else if (Array.isArray(req.body.questions)) {
      rows = req.body.questions;
    } else if (Array.isArray(req.body.rows)) {
      rows = req.body.rows;
    }

    if (rows.length === 0) {
      res.status(400).json({ success: false, error: 'No question rows found in uploaded file or request body' });
      return;
    }

    const preview: any[] = [];
    const allErrors: string[] = [];
    let validCount = 0;
    let invalidCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      const rowErrors: string[] = [];

      const norm: Record<string, string> = {};
      const keys = Object.keys(row);
      for (const k of keys) {
        norm[k.trim().toLowerCase().replace(/[\s_]/g, '')] = String(row[k] ?? '').trim();
      }

      // Positional 5-column legacy format detection
      const isPositional5Col =
        keys.length >= 5 &&
        !norm['type'] &&
        !norm['questiontype'] &&
        !norm['question'] &&
        !norm['questiontext'] &&
        !norm['diagramurl'] &&
        !norm['testcases'];

      let rawType = '';
      let question = '';
      let optA = '';
      let optB = '';
      let optC = '';
      let optD = '';
      let correct = '';
      let marks = 1;
      let penalty = 0;
      let section = 'General';
      let topic = 'General';
      let difficulty = 'Medium';
      let diagramUrl = '';
      let testCases = '';

      if (isPositional5Col) {
        rawType = 'MCQ';
        question = String(row[keys[0]] ?? '').trim();
        optA = String(row[keys[1]] ?? '').trim();
        optB = String(row[keys[2]] ?? '').trim();
        optC = String(row[keys[3]] ?? '').trim();
        optD = String(row[keys[4]] ?? '').trim();
        if (keys.length > 5) correct = String(row[keys[5]] ?? '').trim().toUpperCase();
        if (keys.length > 6) marks = parseFloat(String(row[keys[6]])) || 1;
        if (keys.length > 7) penalty = parseFloat(String(row[keys[7]])) || 0;
      } else {
        rawType = String(norm['type'] || norm['questiontype'] || row['Type'] || '').trim();
        question = String(norm['question'] || norm['questiontext'] || row['Question'] || '').trim();
        optA = String(norm['optiona'] ?? row['Option A'] ?? row['OptionA'] ?? '').trim();
        optB = String(norm['optionb'] ?? row['Option B'] ?? row['OptionB'] ?? '').trim();
        optC = String(norm['optionc'] ?? row['Option C'] ?? row['OptionC'] ?? '').trim();
        optD = String(norm['optiond'] ?? row['Option D'] ?? row['OptionD'] ?? '').trim();
        correct = String(norm['correctanswer'] || norm['correct'] || norm['correctoption'] || row['Correct Answer'] || '').trim();
        marks = parseFloat(String(norm['marks'] || row['Marks'] || '1')) || 1;
        penalty = parseFloat(String(norm['penalty'] || norm['negativemarks'] || norm['negativemarking'] || row['Penalty'] || '0')) || 0;
        section = String(norm['section'] || row['Section'] || 'General').trim();
        topic = String(norm['topic'] || row['Topic'] || 'General').trim();
        difficulty = String(norm['difficulty'] || row['Difficulty'] || 'Medium').trim();
        diagramUrl = String(norm['diagramurl'] || norm['diagram'] || norm['imageurl'] || row['Diagram URL'] || '').trim();
        testCases = String(norm['testcases'] || norm['testcase'] || row['Test Cases'] || '').trim();
      }

      let starterCode = String(
        norm['startercode'] || norm['samplecode'] || norm['code'] || norm['codesnippet'] || norm['snippet'] ||
        row['Starter Code'] || row['Sample Code'] || row['Code'] || ''
      ).trim();
      if (!starterCode && question.includes('\n')) {
        const parts = question.split(/\n\s*\n/);
        if (parts.length > 1) {
          starterCode = parts.slice(1).join('\n\n').trim();
        }
      }

      // Canonical Question Type determination
      let canonicalType: 'MCQ' | 'Coding' | 'Aptitude' | 'Diagram' = 'MCQ';
      if (!rawType) {
        if (optA || optB || optC || optD) {
          rawType = 'MCQ';
          canonicalType = 'MCQ';
        } else {
          rowErrors.push('Question type is required (MCQ, Coding, Aptitude, or Diagram)');
        }
      } else {
        const typeLower = rawType.toLowerCase();
        if (typeLower === 'mcq' || typeLower === 'multiple choice') {
          canonicalType = 'MCQ';
        } else if (typeLower === 'coding' || typeLower === 'code' || typeLower === 'programming') {
          canonicalType = 'Coding';
        } else if (typeLower === 'aptitude' || typeLower === 'quant' || typeLower === 'reasoning') {
          canonicalType = 'Aptitude';
        } else if (typeLower === 'diagram' || typeLower === 'image' || typeLower === 'visual') {
          canonicalType = 'Diagram';
        } else {
          rowErrors.push(`Invalid question type "${rawType}". Supported: MCQ, Coding, Aptitude, Diagram`);
        }
      }

      // Core Required Field Validations
      if (!question) {
        rowErrors.push('Question text is required');
      }

      if (!correct) {
        rowErrors.push('Correct Answer is required');
      }

      // Type-specific field validations
      if (canonicalType === 'MCQ') {
        if (!optA) rowErrors.push('Option A is required for MCQ');
        if (!optB) rowErrors.push('Option B is required for MCQ');
        if (!optC) rowErrors.push('Option C is required for MCQ');
        if (!optD) rowErrors.push('Option D is required for MCQ');
        const upperCorrect = correct.toUpperCase();
        if (!['A', 'B', 'C', 'D'].includes(upperCorrect)) {
          rowErrors.push(`Correct Answer for MCQ must be A, B, C, or D (got "${correct}")`);
        } else {
          correct = upperCorrect;
        }
      } else if (canonicalType === 'Coding') {
        // Coding questions require valid test cases format
        if (!testCases) {
          rowErrors.push('Test cases are required for Coding questions (JSON array or Input/Output pairs)');
        } else {
          let testCaseValid = false;
          try {
            const parsed = JSON.parse(testCases);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const hasValidItems = parsed.every((item: any) =>
                item && typeof item === 'object' &&
                (item.input !== undefined || item.input_text !== undefined) &&
                (item.output !== undefined || item.expected_output !== undefined || item.expected !== undefined)
              );
              if (hasValidItems) testCaseValid = true;
            }
          } catch {
            // Check input/output pair syntax (e.g. Input: ...; Output: ...)
            if (
              /(input|in)\s*:\s*.+?(output|out)\s*:\s*.+/i.test(testCases) ||
              /(input|output)/i.test(testCases)
            ) {
              testCaseValid = true;
            }
          }
          if (!testCaseValid) {
            rowErrors.push('Test cases must be a valid JSON array (e.g. [{"input":"1 2","output":"3"}]) or Input/Output pairs (e.g. "Input: 1 2; Output: 3")');
          }
        }
      } else if (canonicalType === 'Diagram') {
        if (!diagramUrl) {
          rowErrors.push('Diagram URL is required for Diagram questions');
        } else {
          const isValidUrl =
            diagramUrl.startsWith('http://') ||
            diagramUrl.startsWith('https://') ||
            diagramUrl.startsWith('data:image/') ||
            diagramUrl.startsWith('/images/');
          if (!isValidUrl) {
            rowErrors.push('Diagram URL must be a valid HTTP/HTTPS image URL');
          }
        }
        if (!optA) rowErrors.push('Option A is required for Diagram question');
        if (!optB) rowErrors.push('Option B is required for Diagram question');
        if (!optC) rowErrors.push('Option C is required for Diagram question');
        if (!optD) rowErrors.push('Option D is required for Diagram question');
        const upperCorrect = correct.toUpperCase();
        if (!['A', 'B', 'C', 'D'].includes(upperCorrect)) {
          rowErrors.push(`Correct Answer for Diagram question must be A, B, C, or D (got "${correct}")`);
        } else {
          correct = upperCorrect;
        }
      } else if (canonicalType === 'Aptitude') {
        // If options are provided, check that correct answer matches one or is A/B/C/D
        if (optA || optB || optC || optD) {
          const upperCorrect = correct.toUpperCase();
          if (['A', 'B', 'C', 'D'].includes(upperCorrect)) {
            correct = upperCorrect;
          }
        }
      }

      // Scoring validations
      if (isNaN(marks) || marks <= 0) {
        rowErrors.push('Marks must be a positive number greater than 0');
      }
      if (isNaN(penalty) || penalty < 0) {
        rowErrors.push('Penalty must be a non-negative number (>= 0)');
      }

      // Difficulty normalization
      const normDiff = ['Easy', 'Medium', 'Hard'].find(
        (d) => d.toLowerCase() === difficulty.toLowerCase()
      ) || 'Medium';

      const isValid = rowErrors.length === 0;
      if (isValid) {
        validCount++;
      } else {
        invalidCount++;
        allErrors.push(`Row ${rowNum}: ${rowErrors.join('; ')}`);
      }

      preview.push({
        row_number: rowNum,
        valid: isValid,
        type: canonicalType,
        question,
        option_a: optA,
        option_b: optB,
        option_c: optC,
        option_d: optD,
        correct_answer: correct,
        marks,
        penalty,
        section: section || 'General',
        topic: topic || 'General',
        difficulty: normDiff,
        diagram_url: diagramUrl,
        test_cases: testCases,
        starter_code: starterCode,
        errors: rowErrors,
      });
    }

    res.json({
      success: true,
      total_rows: rows.length,
      valid_count: validCount,
      invalid_count: invalidCount,
      preview: preview,
      errors: allErrors,
      can_import: validCount > 0,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Validation failed' });
  }
}

/**
 * POST /api/admin/questions/confirm-import
 * Commits ONLY valid preview questions into the database.
 * Invalid rows are cleanly skipped and reported back to the admin.
 */
export async function confirmImportQuestions(req: Request, res: Response): Promise<void> {
  try {
    const { examCode, examId, questions } = req.body;
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      res.status(400).json({ success: false, error: 'No questions provided for import' });
      return;
    }

    const targetCode = String(examCode || 'DEFAULT').toUpperCase();

    // Faculty scope check: ensure faculty owns or is assigned to the target exam
    if (req.admin?.role === 'faculty') {
      const callerStaffId = req.admin.staff_id || (req.admin as any).id;
      const { data: staffRec } = await supabase
        .from('staff')
        .select('college_id, section_ids')
        .eq('id', callerStaffId)
        .maybeSingle();

      const facultyCollegeId = staffRec?.college_id ?? req.admin.college_id;
      const facultySectionIds: string[] = Array.isArray(staffRec?.section_ids) ? staffRec!.section_ids : [];

      const { data: targetExam } = await supabase
        .from('exam_codes')
        .select('college_id, created_by_staff_id, assigned_faculty_id, section_id, section_ids')
        .eq('exam_code', targetCode)
        .maybeSingle();

      if (targetExam) {
        if (facultyCollegeId && targetExam.college_id && String(targetExam.college_id) !== String(facultyCollegeId)) {
          res.status(403).json({
            success: false,
            error: 'Forbidden: You cannot import questions into an exam for another college',
            code: 'CROSS_COLLEGE_FORBIDDEN',
          });
          return;
        }

        const isCreator = targetExam.created_by_staff_id === callerStaffId;
        const isAssigned = targetExam.assigned_faculty_id === callerStaffId;
        const examSec = targetExam.section_id;
        const examSecList: string[] = Array.isArray(targetExam.section_ids) ? targetExam.section_ids : [];
        const isSectionMatch = facultySectionIds.length > 0 && (
          (examSec && facultySectionIds.includes(String(examSec))) ||
          examSecList.some((s) => facultySectionIds.includes(String(s)))
        );

        if (!isCreator && !isAssigned && !isSectionMatch) {
          res.status(403).json({
            success: false,
            error: 'Forbidden: You do not have ownership of this exam code',
            code: 'FORBIDDEN_NOT_EXAM_OWNER',
          });
          return;
        }
      } else {
        if (targetCode.includes('KLU') || (facultyCollegeId && !targetCode.includes('VRSEC') && targetCode !== 'DEFAULT')) {
          res.status(403).json({
            success: false,
            error: 'Forbidden: You cannot import questions into an exam for another college',
            code: 'CROSS_COLLEGE_FORBIDDEN',
          });
          return;
        }
      }
    }

    // Filter ONLY valid questions
    const validQuestions = questions.filter(
      (q: any) => q.valid !== false && (!q.errors || q.errors.length === 0)
    );
    const invalidQuestions = questions.filter(
      (q: any) => q.valid === false || (q.errors && q.errors.length > 0)
    );

    if (validQuestions.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Cannot import: 0 valid questions found. Please review and fix row validation errors.',
        invalid_count: invalidQuestions.length,
        invalid_rows: invalidQuestions.map((q: any) => ({
          row_number: q.row_number,
          question: q.question,
          type: q.type,
          errors: q.errors,
        })),
      });
      return;
    }

    const rowsToInsert = validQuestions.map((q: any, idx: number) => {
      const qType = String(q.type || 'mcq').toLowerCase();
      const dbType = qType === 'coding' || qType === 'code' ? 'coding' : 'mcq';
      const tags: string[] = [];
      if (q.topic) tags.push(q.topic);
      if (qType === 'diagram') {
        tags.push('type:diagram');
        if (q.diagram_url) tags.push(`diagram:${q.diagram_url}`);
      } else if (qType === 'aptitude') {
        tags.push('type:aptitude');
      } else if (dbType === 'coding') {
        tags.push('type:coding');
      }

      let starterCode = q.starter_code || null;
      if (!starterCode && q.question && (q.question.includes('\n') || q.question.includes('```'))) {
        const parts = q.question.split(/\n\s*\n/);
        if (parts.length > 1) {
          starterCode = parts.slice(1).join('\n\n').trim();
        }
      }

      return {
        exam_code: targetCode,
        question: q.question,
        question_text: q.question,
        question_type: dbType,
        option_a: q.option_a || '',
        option_b: q.option_b || '',
        option_c: q.option_c || '',
        option_d: q.option_d || '',
        correct_answer: (q.correct_answer || 'A').trim().toUpperCase(),
        marks: Number(q.marks || 1),
        penalty: Number(q.penalty || 0),
        negative_marks: Number(q.penalty || 0),
        topic: q.topic || 'General',
        section: q.section || 'General',
        difficulty: q.difficulty || 'Medium',
        tags: tags,
        test_cases: q.test_cases || null,
        starter_code: starterCode || null,
        display_order: idx + 1,
      };
    });

    const { error } = await supabase.from('questions_ec').insert(rowsToInsert);
    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    // Also populate standard questions table
    try {
      await supabase.from('questions').insert(
        rowsToInsert.map((r: any) => ({
          exam_id: examId || targetCode,
          question_text: r.question,
          option_a: r.option_a,
          option_b: r.option_b,
          option_c: r.option_c,
          option_d: r.option_d,
          correct_option: r.correct_answer.toLowerCase(),
          marks: r.marks,
          penalty: r.penalty,
          topic: r.topic,
          difficulty: r.difficulty,
          section: r.section,
        }))
      );
    } catch {}

    // Ensure exam_codes has an active, accessible record for this exam code
    try {
      const { data: existingCode } = await supabase
        .from('exam_codes')
        .select('id, exam_code, total_questions')
        .eq('exam_code', targetCode)
        .maybeSingle();

      const now = new Date();
      if (!existingCode) {
        await supabase.from('exam_codes').insert({
          exam_code: targetCode,
          exam_name: targetCode,
          subject: (rowsToInsert[0] && rowsToInsert[0].topic) || 'General',
          total_questions: rowsToInsert.length,
          duration_minutes: 60,
          start_time: now.toISOString(),
          end_time: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          is_active: true,
          is_launched: true,
          college_id: req.admin?.college_id || 1,
        });
      } else {
        await supabase
          .from('exam_codes')
          .update({
            total_questions: rowsToInsert.length,
            is_active: true,
          })
          .eq('exam_code', targetCode);
      }
    } catch (ecSyncErr) {
      console.warn('[confirmImportQuestions] exam_codes sync note:', ecSyncErr);
    }

    res.json({
      success: true,
      imported_count: rowsToInsert.length,
      invalid_count: invalidQuestions.length,
      invalid_rows: invalidQuestions.map((q: any) => ({
        row_number: q.row_number,
        question: q.question,
        type: q.type,
        errors: q.errors,
      })),
      exam_code: targetCode,
      message: `Successfully imported ${rowsToInsert.length} valid questions for ${targetCode}.${
        invalidQuestions.length > 0
          ? ` ${invalidQuestions.length} invalid rows were skipped and reported for correction.`
          : ''
      }`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Import failed' });
  }
}

/**
 * POST /api/admin/attempts/:id/extend-time
 * Phase 3 Live Monitor: Extends candidate time by X minutes
 */
export async function extendAttemptTime(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { minutes } = req.body;
  const mins = parseInt(String(minutes || '10'), 10);

  const { data: attempt, error } = await supabase
    .from('exam_code_attempts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !attempt) {
    res.status(404).json({ success: false, error: 'Attempt not found' });
    return;
  }

  const extendedSec = (attempt.time_extended_seconds || 0) + mins * 60;
  await supabase
    .from('exam_code_attempts')
    .update({ time_extended_seconds: extendedSec })
    .eq('id', id);

  res.json({
    success: true,
    message: `Extended time by ${mins} minutes.`,
    attempt_id: id,
    total_extended_minutes: Math.round(extendedSec / 60),
  });
}

/**
 * POST /api/admin/attempts/:id/force-submit
 * Phase 3 Live Monitor: Force-submit a candidate's session
 */
export async function forceSubmitAttempt(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const { data: attempt, error } = await supabase
    .from('exam_code_attempts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !attempt) {
    res.status(404).json({ success: false, error: 'Attempt not found' });
    return;
  }

  if (attempt.status === 'completed') {
    res.status(400).json({ success: false, error: 'Attempt already completed' });
    return;
  }

  // Grade partial answers
  const { data: questions } = await supabase
    .from('questions_ec')
    .select('id, correct_answer, marks, topic')
    .eq('exam_code', attempt.exam_code);

  const answers = (attempt.partial_answers as Record<string, string>) || {};
  let totalScore = 0;
  let maxScore = 0;
  let correctCount = 0;
  let wrongCount = 0;

  for (const q of questions || []) {
    maxScore += Number(q.marks);
    const ans = answers[q.id];
    if (ans && ans.toUpperCase() === q.correct_answer.toUpperCase()) {
      totalScore += Number(q.marks);
      correctCount++;
    } else if (ans) {
      wrongCount++;
    }
  }

  await supabase
    .from('exam_code_attempts')
    .update({
      status: 'completed',
      end_time: new Date().toISOString(),
      score: totalScore,
      max_score: maxScore,
      correct_count: correctCount,
      wrong_count: wrongCount,
      submitted_at: new Date().toISOString(),
    })
    .eq('id', id);

  res.json({
    success: true,
    message: 'Candidate session successfully force-submitted and graded.',
    attempt_id: id,
    score: totalScore,
    max_score: maxScore,
  });
}

/**
 * POST /api/admin/exam-codes/:id/reevaluate
 * Phase 3 Results Vault: Re-grades all submitted attempts against updated questions
 */
export async function reevaluateExamCode(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const { data: ec } = await supabase.from('exam_codes').select('exam_code').eq('id', id).maybeSingle();
  if (!ec) { res.status(404).json({ success: false, error: 'Exam code not found' }); return; }

  const { data: questions } = await supabase
    .from('questions_ec')
    .select('id, correct_answer, marks, topic')
    .eq('exam_code', ec.exam_code);

  const { data: attempts } = await supabase
    .from('exam_code_attempts')
    .select('*')
    .eq('exam_code', ec.exam_code);

  let updatedCount = 0;

  for (const attempt of attempts || []) {
    const answers = (attempt.answers || attempt.partial_answers || {}) as Record<string, string>;
    let totalScore = 0;
    let maxScore = 0;
    let correctCount = 0;
    let wrongCount = 0;

    for (const q of questions || []) {
      maxScore += Number(q.marks);
      const studentAns = answers[q.id];
      if (studentAns && studentAns.toUpperCase() === q.correct_answer.toUpperCase()) {
        totalScore += Number(q.marks);
        correctCount++;
      } else if (studentAns) {
        wrongCount++;
      }
    }

    await supabase
      .from('exam_code_attempts')
      .update({
        score: totalScore,
        max_score: maxScore,
        correct_count: correctCount,
        wrong_count: wrongCount,
        percentage: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0,
      })
      .eq('id', attempt.id);

    updatedCount++;
  }

  res.json({
    success: true,
    message: `Successfully re-evaluated ${updatedCount} candidate attempts for ${ec.exam_code}.`,
    reevaluated_attempts: updatedCount,
  });
}

/**
 * GET /api/admin/exam-codes/:id/analytics
 * Phase 3 Analytics: Question difficulty index, topic-wise accuracy, score distribution, time-per-question heatmap
 */
export async function getExamCodeAnalytics(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const { data: ec } = await supabase.from('exam_codes').select('*').eq('id', id).maybeSingle();
  if (!ec) { res.status(404).json({ success: false, error: 'Exam code not found' }); return; }

  const { data: questions } = await supabase
    .from('questions_ec')
    .select('*')
    .eq('exam_code', ec.exam_code);

  const { data: attempts } = await supabase
    .from('exam_code_attempts')
    .select('*')
    .eq('exam_code', ec.exam_code);

  const totalAttempts = attempts?.length || 0;
  const completedAttempts = attempts?.filter((a) => a.status === 'completed' || a.status === 'submitted') || [];
  const terminatedAttempts = attempts?.filter((a) => a.status === 'terminated_cheating' || a.status === 'terminated' || a.status === 'Terminated - violation') || [];

  // 1. Question Difficulty Index (% correct per question)
  const questionDifficulty = (questions || []).map((q) => {
    let correctCount = 0;
    let attemptedCount = 0;
    for (const a of completedAttempts) {
      const answers = (a.answers || a.partial_answers || {}) as Record<string, string>;
      if (answers[q.id]) {
        attemptedCount++;
        if (answers[q.id].toUpperCase() === q.correct_answer.toUpperCase()) {
          correctCount++;
        }
      }
    }
    const accuracy = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;
    return {
      id: q.id,
      question: q.question,
      topic: q.topic || 'General',
      difficulty_rated: q.difficulty,
      accuracy_percentage: accuracy,
      difficulty_index: accuracy >= 70 ? 'Easy' : accuracy >= 40 ? 'Medium' : 'Hard',
      attempted_count: attemptedCount,
      correct_count: correctCount,
    };
  });

  // 2. Topic-wise Accuracy
  const topicStats: Record<string, { total: number; correct: number }> = {};
  for (const q of questionDifficulty) {
    if (!topicStats[q.topic]) topicStats[q.topic] = { total: 0, correct: 0 };
    topicStats[q.topic].total += q.attempted_count;
    topicStats[q.topic].correct += q.correct_count;
  }
  const topicAccuracy = Object.entries(topicStats).map(([topic, stat]) => ({
    topic,
    accuracy: stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0,
    total_answers: stat.total,
  }));

  // 3. Score Distribution Buckets (0-20, 21-40, 41-60, 61-80, 81-100)
  const buckets = { '0-20%': 0, '21-40%': 0, '41-60%': 0, '61-80%': 0, '81-100%': 0 };
  for (const a of completedAttempts) {
    const pct = a.max_score > 0 ? (Number(a.score) / Number(a.max_score)) * 100 : 0;
    if (pct <= 20) buckets['0-20%']++;
    else if (pct <= 40) buckets['21-40%']++;
    else if (pct <= 60) buckets['41-60%']++;
    else if (pct <= 80) buckets['61-80%']++;
    else buckets['81-100%']++;
  }

  // 4. Time-per-question heatmap
  const avgTimeTakenSec =
    completedAttempts.length > 0
      ? Math.round(
          completedAttempts.reduce((sum, a) => sum + (a.time_taken_seconds || 0), 0) /
            completedAttempts.length
        )
      : 0;

  res.json({
    success: true,
    exam: { exam_code: ec.exam_code, exam_name: ec.exam_name },
    summary: {
      total_candidates: totalAttempts,
      completed_count: completedAttempts.length,
      terminated_count: terminatedAttempts.length,
      average_time_taken_seconds: avgTimeTakenSec,
    },
    question_difficulty: questionDifficulty,
    topic_accuracy: topicAccuracy,
    score_distribution: buckets,
  });
}

/**
 * GET /api/admin/exam-codes/:id/report
 * Admin report for a specific exam code
 */
export async function getExamCodeReport(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { data: ec } = await supabase.from('exam_codes').select('exam_code, exam_name').eq('id', id).single();
  if (!ec) { res.status(404).json({ success: false, error: 'Exam code not found' }); return; }

  const { data, error } = await supabase
    .from('exam_code_attempts')
    .select('*')
    .eq('exam_code', ec.exam_code)
    .order('score', { ascending: false });

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }

  const total = data?.length || 0;
  const completed = data?.filter(d => d.status === 'completed' || d.status === 'submitted').length || 0;
  const terminatedCount = data?.filter(d => d.status === 'terminated_cheating' || d.status === 'terminated' || d.status === 'Terminated - violation').length || 0;
  const avgScore = total > 0 ? (data!.reduce((s, d) => s + Number(d.score), 0) / total).toFixed(2) : '0';
  const avgPercent = total > 0
    ? (data!.reduce((s, d) => s + (d.max_score > 0 ? (Number(d.score) / Number(d.max_score)) * 100 : 0), 0) / total).toFixed(1)
    : '0';

  let rankCounter = 1;
  res.json({
    success: true,
    summary: { total_attempts: total, completed, terminated: terminatedCount, avg_score: avgScore, avg_percent: avgPercent, exam_name: ec.exam_name },
    attempts: (data || []).map((d) => {
      const isTerm = d.status === 'terminated_cheating' || d.status === 'terminated' || d.status === 'Terminated - violation';
      const rank = isTerm ? null : rankCounter++;
      return {
        rank,
        is_disqualified: isTerm,
        hall_ticket: d.hall_ticket_no,
        name: d.student_name,
        score: isTerm ? 0 : d.score,
        max_score: d.max_score,
        percentage: isTerm ? 0 : (d.max_score > 0 ? Math.round((Number(d.score) / Number(d.max_score)) * 100) : 0),
        correct: d.correct_count,
        wrong: d.wrong_count,
        time_taken: d.time_taken_seconds,
        violations: d.violation_count,
        status: isTerm ? 'terminated_cheating' : d.status,
      };
    }),
  });
}


