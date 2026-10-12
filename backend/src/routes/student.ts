import { Router } from 'express';
import {
  getStudentDashboard,
  getStudentMe,
  changeStudentPassword,
  getStudentInstitutionalReport,
} from '../controllers/authController';
import { studentAuth } from '../middleware/auth';

const router = Router();

/**
 * GET /api/student/report/:hallTicket
 * Return public / authenticated student institutional analysis report
 */
router.get('/report/:hallTicket', getStudentInstitutionalReport);

/**
 * All student routes below require valid student JWT authentication
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
