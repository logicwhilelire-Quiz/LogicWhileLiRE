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
  block_reason?: string | null;
  contact_number?: string;
  mobile?: string;
  live_status?: {
    state: string;
    label: string;
    exam_code?: string;
    current_question?: number;
    score?: number;
    max_score?: number;
    violations?: number;
  };
  attempts_used?: number;
  allowed_attempts?: number;
  extra_time_mins?: number;
}

export type RegistrationAuthorityMode = 'ADMIN_ONLY' | 'CLEARANCE_REQUIRED' | 'ACTIVE';

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
 * Exports complete administrative system archive (students, rosters, audit logs, exam states)
 */
export function generateSystemBackupArchive(students: AdminRosterStudent[]): {
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
export function exportRosterCsvString(students: AdminRosterStudent[]): string {
  const cell = (v: unknown) => {
    let t = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; // neutralise spreadsheet formula injection
    return `"${t.replace(/"/g, '""')}"`;
  };
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
    cell(s.hall_ticket),
    cell(s.name),
    cell(s.email),
    cell(s.college_name),
    cell(s.branch),
    cell(s.section),
    cell(s.batch),
    cell(s.passout_year),
    cell(s.is_verified !== false ? 'APPROVED' : 'PENDING'),
    cell(s.student_gate_pass),
    cell(s.is_blocked ? 'YES' : 'NO'),
    cell(s.block_reason),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
