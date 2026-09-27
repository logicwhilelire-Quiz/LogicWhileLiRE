import { Router } from 'express';
import {
  registerCandidate,
  getSystemCheck,
  getLobbyStatus,
} from '../controllers/candidateController';
import { authRateLimit } from '../middleware/rateLimiter';
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
 * Form dropdowns and dictionary metadata
 */
router.get('/metadata', (_req, res) => {
  res.json({
    success: true,
    top_campuses: TOP_CAMPUSES,
    all_colleges: ALL_COLLEGES,
    branches: BRANCH_CODES,
    batches: VALID_YOP,
    sections: VALID_SECTIONS,
  });
});

export default router;
