/**
 * Authoritative Admin Roster Store
 * 
 * SYSTEM RULE (PINNED):
 * Only student records entered by the Institution Administrator in the Admin Control Center
 * (/admin/students) are authorized to log in.
 * Public self-registration is strictly forbidden.
 */

export interface AdminRosterStudent {
  id: string;
  hall_ticket: string;
  roll_number?: string;
  name: string;
  first_name?: string;
  last_name?: string;
  email: string;
  branch: string;
  branch_code?: string;
  college_id?: number | string;
  college_name: string;
  section: string;
  section_id?: string;
  batch: string;
  batch_id?: string;
  passout_year: number;
  year_of_passing?: number;
  student_gate_pass?: string;
  candidate_gate_pass?: string;
  status?: 'approved' | 'pending_clearance' | 'rejected' | 'blocked';
  registered_at?: string;
  approved_at?: string;
  approved_by?: string;
  is_verified?: boolean;
  is_blocked?: boolean;
  block_reason?: string;
  attempts_used?: number;
  allowed_attempts?: number;
  extra_time_mins?: number;
}

export type RegistrationAuthorityMode = 'ADMIN_ONLY' | 'CLEARANCE_REQUIRED' | 'ACTIVE';

export const DEFAULT_ADMIN_STUDENTS: AdminRosterStudent[] = [];

const ROSTER_STORAGE_KEY = 'admin_roster_students';

/**
 * Retrieves all admin-entered students from authoritative local storage
 */
export function getAdminRosterStudents(): AdminRosterStudent[] {
  try {
    const raw = localStorage.getItem(ROSTER_STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {}
  return [...DEFAULT_ADMIN_STUDENTS];
}

/**
 * Completely clears the student roster for a fresh institutional setup
 */
export function clearAllAdminStudents(): void {
  try {
    localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify([]));
  } catch (err) {
    console.error('Failed to clear admin students:', err);
  }
}

/**
 * Saves updated admin student roster to persistent storage
 */
export function saveAdminRosterStudents(students: AdminRosterStudent[]): void {
  try {
    localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(students));
  } catch (err) {
    console.error('Failed to save admin roster students:', err);
  }
}

/**
 * Finds an admin-entered student by hall ticket, roll number, or email
 */
export function findAdminRosterStudent(query: string): AdminRosterStudent | undefined {
  if (!query || !query.trim()) return undefined;
  const clean = query.trim().toUpperCase();
  const cleanEmail = query.trim().toLowerCase();
  const list = getAdminRosterStudents();
  return list.find(
    (s) =>
      (s.hall_ticket && s.hall_ticket.toUpperCase() === clean) ||
      (s.roll_number && s.roll_number.toUpperCase() === clean) ||
      (s.email && s.email.toLowerCase() === cleanEmail)
  );
}

/**
 * Checks if a given query matches an admin-provisioned student
 */
export function isStudentInAdminRoster(query: string): boolean {
  return !!findAdminRosterStudent(query);
}

const REG_MODE_KEY = 'admin_registration_mode';

/**
 * Gets the current administrative registration authority mode
 */
export function getRegistrationAuthorityMode(): RegistrationAuthorityMode {
  try {
    const saved = localStorage.getItem(REG_MODE_KEY);
    if (saved === 'ADMIN_ONLY' || saved === 'CLEARANCE_REQUIRED' || saved === 'ACTIVE') {
      return saved as RegistrationAuthorityMode;
    }
    const legacyEnabled = localStorage.getItem('admin_registration_enabled');
    if (legacyEnabled === 'false') return 'ADMIN_ONLY';
  } catch {}
  return 'CLEARANCE_REQUIRED';
}

/**
 * Updates the administrative registration authority mode
 */
export function setRegistrationAuthorityMode(mode: RegistrationAuthorityMode): void {
  try {
    localStorage.setItem(REG_MODE_KEY, mode);
    localStorage.setItem('admin_registration_enabled', mode !== 'ADMIN_ONLY' ? 'true' : 'false');
  } catch {}
}

/**
 * Approves a pending candidate and issues official examination clearance
 */
export function approveCandidateRoster(studentId: string, approvedBy = 'Institution Administrator'): void {
  const list = getAdminRosterStudents();
  const updated = list.map((s) => {
    if (s.id === studentId || s.hall_ticket === studentId) {
      return {
        ...s,
        is_verified: true,
        status: 'approved' as const,
        approved_at: new Date().toISOString(),
        approved_by: approvedBy,
        is_blocked: false,
      };
    }
    return s;
  });
  saveAdminRosterStudents(updated);
}

/**
 * Rejects or blocks a candidate with an administrative audit reason
 */
export function rejectCandidateRoster(studentId: string, reason: string): void {
  const list = getAdminRosterStudents();
  const updated = list.map((s) => {
    if (s.id === studentId || s.hall_ticket === studentId) {
      return {
        ...s,
        is_verified: false,
        status: 'rejected' as const,
        is_blocked: true,
        block_reason: reason || 'Administrative clearance denied',
      };
    }
    return s;
  });
  saveAdminRosterStudents(updated);
}

/**
 * Bulk-approves all pending candidates awaiting clearance
 */
export function bulkApproveAllPendingCandidates(approvedBy = 'Institution Administrator'): number {
  const list = getAdminRosterStudents();
  let count = 0;
  const updated = list.map((s) => {
    if (s.is_verified === false || s.status === 'pending_clearance') {
      count++;
      return {
        ...s,
        is_verified: true,
        status: 'approved' as const,
        approved_at: new Date().toISOString(),
        approved_by: approvedBy,
        is_blocked: false,
      };
    }
    return s;
  });
  saveAdminRosterStudents(updated);
  return count;
}

/**
 * Exports complete administrative system archive (students, rosters, audit logs, exam states)
 */
export function generateSystemBackupArchive(): {
  timestamp: string;
  version: string;
  roster_students: AdminRosterStudent[];
  registration_mode: RegistrationAuthorityMode;
  stats: {
    total_students: number;
    approved: number;
    pending: number;
    blocked: number;
  };
} {
  const students = getAdminRosterStudents();
  const approved = students.filter((s) => s.is_verified !== false && s.status !== 'pending_clearance').length;
  const pending = students.filter((s) => s.is_verified === false || s.status === 'pending_clearance').length;
  const blocked = students.filter((s) => s.is_blocked).length;

  return {
    timestamp: new Date().toISOString(),
    version: 'LogicWhileLiRE-4.0-Admin-Backup',
    roster_students: students,
    registration_mode: getRegistrationAuthorityMode(),
    stats: {
      total_students: students.length,
      approved,
      pending,
      blocked,
    },
  };
}

/**
 * Generates formatted CSV string of the authoritative student roster
 */
export function exportRosterCsvString(): string {
  const students = getAdminRosterStudents();
  const headers = [
    'Hall Ticket',
    'Full Name',
    'Email',
    'College Name',
    'Branch',
    'Section',
    'Batch',
    'Passout Year',
    'Clearance Status',
    'Gate Pass',
    'Blocked',
    'Block Reason',
  ];

  const rows = students.map((s) => [
    `"${s.hall_ticket}"`,
    `"${s.name}"`,
    `"${s.email}"`,
    `"${s.college_name.replace(/"/g, '""')}"`,
    `"${s.branch}"`,
    `"${s.section}"`,
    `"${s.batch}"`,
    s.passout_year,
    `"${s.is_verified !== false ? 'APPROVED' : 'PENDING'}"`,
    `"${s.student_gate_pass || ''}"`,
    s.is_blocked ? 'YES' : 'NO',
    `"${(s.block_reason || '').replace(/"/g, '""')}"`,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
