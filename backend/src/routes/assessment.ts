import { Router } from 'express';
import {
  registerCandidate,
  getSystemCheck,
  getLobbyStatus,
} from '../controllers/candidateController';
import { verifyRegistrationOtp } from '../controllers/authController';
import { authRateLimit, otpRateLimit } from '../middleware/rateLimiter';
import { validateBody, candidateRegisterSchema } from '../middleware/validate';
import { ALL_COLLEGES, TOP_CAMPUSES, BRANCH_CODES, VALID_YOP, VALID_SECTIONS } from '../constants/assessmentGateData';

const router = Router();

/**
 * POST /api/v1/assessment/register-candidate
 * Core Gate Module endpoint specified in AL-SPEC-2026-REG
 */
router.post(
  '/register-candidate',
  authRateLimit,
  validateBody(candidateRegisterSchema),
  registerCandidate
);

/**
 * POST /api/v1/assessment/verify-candidate-otp
 * Verify 6-digit OTP to activate candidate account
 */
router.post(
  '/verify-candidate-otp',
  otpRateLimit,
  verifyRegistrationOtp
);

/**
 * GET /api/v1/assessment/system-check
 * Visual entrance gate live check: WebSocket & Redis status
 */
router.get('/system-check', getSystemCheck);

/**
 * GET /api/v1/assessment/lobby-status
 * Contest waiting lobby real-time queue & connection status
 */
router.get('/lobby-status', getLobbyStatus);

/**
 * GET /api/v1/assessment/metadata
 * Form dropdowns and dictionary metadata - dynamically populated from Admin-created records
 */
router.get('/metadata', async (_req, res) => {
  try {
    const { supabase } = await import('../db/supabase');
    
    // Fetch active colleges where registration is enabled
    const { data: colleges } = await supabase
      .from('colleges')
      .select('id, college_name, college_code, city, state, is_active, registration_enabled')
      .eq('is_active', true)
      .eq('registration_enabled', true);

    // Fetch cohorts (branches)
    const { data: cohorts } = await supabase
      .from('cohorts')
      .select('id, college_id, name, degree, branch, year_of_passing, yop');

    // Fetch academic years
    const { data: academicYears } = await supabase
      .from('academic_years')
      .select('id, college_id, year, is_active');

    // Fetch sections
    const { data: sections } = await supabase
      .from('sections')
      .select('id, cohort_id, name, section_name');

    const formattedColleges = (colleges || []).map((c: any) => ({
      id: String(c.id),
      name: c.college_name,
      code: c.college_code,
    }));

    const standardBranches = [
      { id: 'branch-cse', code: 'CSE', label: 'Computer Science & Engineering (CSE)' },
      { id: 'branch-csm', code: 'CSM', label: 'CSE — Artificial Intelligence & Machine Learning (CSM / AIML)' },
      { id: 'branch-csd', code: 'CSD', label: 'CSE — Data Science & Analytics (CSD / DS)' },
      { id: 'branch-csbs', code: 'CSBS', label: 'Computer Science & Business Systems (CSBS)' },
      { id: 'branch-it', code: 'IT', label: 'Information Technology (IT)' },
      { id: 'branch-aids', code: 'AIDS', label: 'Artificial Intelligence & Data Science (AI & DS)' },
      { id: 'branch-ece', code: 'ECE', label: 'Electronics & Communication Engineering (ECE)' },
      { id: 'branch-eee', code: 'EEE', label: 'Electrical & Electronics Engineering (EEE)' },
      { id: 'branch-mech', code: 'MECH', label: 'Mechanical Engineering (MECH)' },
      { id: 'branch-civil', code: 'CIVIL', label: 'Civil Engineering (CIVIL)' },
      { id: 'branch-csit', code: 'CSIT', label: 'Computer Science & Information Technology (CSIT)' },
      { id: 'branch-mca', code: 'MCA', label: 'Master of Computer Applications (MCA)' },
      { id: 'branch-mba', code: 'MBA', label: 'Master of Business Administration (MBA)' },
      { id: 'branch-other', code: 'OTHER', label: 'Other Engineering Specialization' },
    ];

    const cohortBranches = (cohorts || []).map((ch: any) => ({
      id: String(ch.id),
      code: (ch.branch || ch.name || 'CSE').toUpperCase().trim(),
      label: ch.branch && ch.name && ch.branch !== ch.name
        ? `${ch.branch} — ${ch.name}`
        : (ch.name || ch.branch || 'General'),
      college_id: ch.college_id ? String(ch.college_id) : undefined,
      year_of_passing: ch.year_of_passing || ch.yop,
    }));

    // Return college-specific cohorts followed by standard branches
    const formattedBranches: any[] = [];
    const seen = new Set<string>();
    for (const b of cohortBranches) {
      const key = `${b.college_id || 'all'}-${b.code}`;
      if (!seen.has(key)) {
        seen.add(key);
        formattedBranches.push(b);
      }
    }
    for (const b of standardBranches) {
      formattedBranches.push(b);
    }

    const defaultYears = [2026, 2027, 2028, 2029, 2030];
    const formattedYears = Array.from(
      new Set(
        (cohorts || [])
          .map((ch: any) => ch.year_of_passing || ch.yop)
          .filter(Boolean)
          .concat((academicYears || []).map((ay: any) => parseInt(ay.year || ay.year_name, 10)).filter(Boolean))
          .concat(defaultYears)
      )
    ).sort((a: number, b: number) => a - b);

    const defaultSections = [
      { id: 'sec-a', name: 'A' },
      { id: 'sec-b', name: 'B' },
      { id: 'sec-c', name: 'C' },
      { id: 'sec-d', name: 'D' },
      { id: 'sec-e', name: 'E' },
    ];
    const formattedSections = (sections && sections.length > 0)
      ? sections.map((s: any) => ({
          id: s.id,
          cohort_id: s.cohort_id,
          name: s.name || s.section_name || 'A',
        }))
      : defaultSections;

    res.json({
      success: true,
      colleges: formattedColleges,
      all_colleges: formattedColleges,
      top_campuses: formattedColleges.slice(0, 4),
      branches: formattedBranches,
      batches: formattedYears,
      sections: formattedSections,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to load dynamic hierarchy metadata',
      colleges: [],
      branches: [],
      batches: [],
      sections: [],
    });
  }
});

export default router;

