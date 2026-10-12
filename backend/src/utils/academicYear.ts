/**
 * academicYear.ts
 * LogicWhileLiRE — Dynamic Study Year Derivation & Section Targeting Engine
 *
 * Automatically derives student study year (1st, 2nd, 3rd, 4th Year)
 * from passout_year and the current academic calendar.
 * Contains ZERO hardcoded years.
 */

export interface DerivedStudyYear {
  studyYear: number;       // 1, 2, 3, or 4
  label: string;           // "1st Year", "2nd Year", "3rd Year", "4th Year"
  academicYear: string;    // e.g. "2026-27"
  isGraduated: boolean;
  isUpcoming: boolean;
}

/**
 * Derives the current academic year and study year from the candidate's graduation (passout) year.
 * Academic cycle in Indian & collegiate engineering institutions starts around July (month index >= 6).
 *
 * Example:
 * If current date is Oct 2026 (Academic Year 2026-2027):
 * - Passout 2027 -> 4th Year (Final Year)
 * - Passout 2028 -> 3rd Year (Pre-final Year)
 * - Passout 2029 -> 2nd Year
 * - Passout 2030 -> 1st Year
 */
export function deriveStudyYear(passoutYear: number, currentDate: Date = new Date()): DerivedStudyYear {
  const currentCalYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0 = Jan, 6 = July

  // If current month is July or later (>= 6), academic year start is currentCalYear.
  // Otherwise (Jan-June), academic year start is currentCalYear - 1.
  const academicStartYear = currentMonth >= 6 ? currentCalYear : currentCalYear - 1;
  const academicEndYear = academicStartYear + 1;
  const academicYear = `${academicStartYear}-${String(academicEndYear).slice(-2)}`;

  // Standard 4-year undergraduate engineering degree:
  // Students graduating in academicEndYear (e.g. 2027 in 2026-27) are in 4th Year.
  // formula: 4 - (passoutYear - academicEndYear)
  const rawStudyYear = 4 - (Number(passoutYear) - academicEndYear);

  const isGraduated = rawStudyYear > 4;
  const isUpcoming = rawStudyYear < 1;

  const clamped = Math.max(1, Math.min(4, rawStudyYear));

  let label: string;
  if (isGraduated) {
    label = 'Alumni / Graduated';
  } else if (isUpcoming) {
    label = 'Prospective Student';
  } else {
    label = clamped === 1 ? '1st Year' : clamped === 2 ? '2nd Year' : clamped === 3 ? '3rd Year' : '4th Year';
  }

  return {
    studyYear: clamped,
    label,
    academicYear,
    isGraduated,
    isUpcoming,
  };
}

/**
 * Validates whether a candidate / student record matches an exam's targeting specifications.
 * Enforces:
 * 1. College Scope: Must match exam.college_id (if specified)
 * 2. Branch: Must match exam.branch (if specified)
 * 3. Passout Year: Must match exam.passout_year (if specified)
 * 4. Section: Must match exam.section_id or exam.section_ids (if specified)
 * 5. Batch: Must match exam.batch_id (if specified)
 *
 * Returns true if eligible; false otherwise.
 */
export function isStudentEligibleForExam(student: any, exam: any): boolean {
  if (!student || !exam) return false;

  // 1. College Targeting
  const examCollegeId = exam.college_id !== undefined && exam.college_id !== null ? String(exam.college_id).trim() : null;
  const studentCollegeId = student.college_id !== undefined && student.college_id !== null ? String(student.college_id).trim() : null;

  if (examCollegeId && examCollegeId !== 'ALL' && examCollegeId !== '0') {
    if (!studentCollegeId || studentCollegeId !== examCollegeId) {
      return false;
    }
  }

  // 2. Branch Targeting
  const examBranch = (exam.branch || exam.department || '').trim().toUpperCase();
  const studentBranch = (student.branch_code || student.branch || student.department || '').trim().toUpperCase();

  if (examBranch && examBranch !== 'ALL' && examBranch !== 'ANY') {
    if (!studentBranch || studentBranch !== examBranch) {
      return false;
    }
  }

  // 3. Passout Year Targeting
  const examPassoutYear = exam.passout_year ? Number(exam.passout_year) : null;
  const studentPassoutYear = (student.year_of_passing || student.passout_year) ? Number(student.year_of_passing || student.passout_year) : null;

  if (examPassoutYear && examPassoutYear > 0) {
    if (!studentPassoutYear || studentPassoutYear !== examPassoutYear) {
      return false;
    }
  }

  // 4. Section Targeting (can be single section or array of sections)
  let targetedSections: string[] = [];
  if (Array.isArray(exam.section_ids) && exam.section_ids.length > 0) {
    targetedSections = exam.section_ids.map((s: any) => String(s).trim().toUpperCase());
  } else if (typeof exam.section_ids === 'string' && exam.section_ids.trim().length > 0) {
    try {
      const parsed = JSON.parse(exam.section_ids);
      if (Array.isArray(parsed)) {
        targetedSections = parsed.map((s: any) => String(s).trim().toUpperCase());
      } else {
        targetedSections = [String(exam.section_ids).trim().toUpperCase()];
      }
    } catch {
      targetedSections = [exam.section_ids.trim().toUpperCase()];
    }
  } else if (exam.section_id || exam.section) {
    targetedSections = [String(exam.section_id || exam.section).trim().toUpperCase()];
  }

  targetedSections = targetedSections.filter((s) => Boolean(s) && s !== 'ALL' && s !== 'ANY');

  if (targetedSections.length > 0) {
    const studentSection = String(student.section || student.section_id || student.section_name || '').trim().toUpperCase();
    const studentSectionId = String(student.section_id || '').trim().toUpperCase();

    const matchesSection = targetedSections.some((target) => {
      // Direct match on section name (e.g. "A" or "SECTION A") or section ID
      if (studentSection === target || studentSectionId === target) return true;
      if (studentSection.replace(/^SECTION\s*/i, '') === target.replace(/^SECTION\s*/i, '')) return true;
      if (studentSectionId && studentSectionId.endsWith(`-${target.toLowerCase()}`)) return true;
      if (studentSection && (target.endsWith(`-${studentSection}`) || target.endsWith(`-${studentSection.toLowerCase()}`))) return true;
      return false;
    });

    if (!matchesSection) {
      return false;
    }
  }

  // 5. Batch Targeting (Optional)
  const examBatch = (exam.batch_id || exam.batch || '').trim().toUpperCase();
  const studentBatch = (student.batch_id || student.batch || student.batch_name || '').trim().toUpperCase();

  if (examBatch && examBatch !== 'ALL' && examBatch !== 'ANY') {
    if (!studentBatch || (studentBatch !== examBatch && !studentBatch.includes(examBatch))) {
      return false;
    }
  }

  return true;
}
