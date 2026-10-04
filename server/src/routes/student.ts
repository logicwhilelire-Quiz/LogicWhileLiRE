import { Router } from 'express';
import {
  getStudentDashboard,
  getStudentMe,
  changeStudentPassword,
} from '../controllers/authController';
import { studentAuth } from '../middleware/auth';

const router = Router();

/**
 * All student routes require valid student JWT authentication
 * and enforce a single active session per student
 */
router.use(studentAuth);

/**
 * GET /api/student/dashboard
 * Return student profile, upcoming/available exams, past assessment results, and rank
 */
router.get('/dashboard', getStudentDashboard);

/**
 * GET /api/student/me
 * Return current student profile details
 */
router.get('/me', getStudentMe);

/**
 * POST /api/student/change-password
 * Change student password
 */
router.post('/change-password', changeStudentPassword);

export default router;
