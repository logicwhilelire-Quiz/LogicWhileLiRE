import { Router } from 'express';
import { participantAuth } from '../middleware/auth';
import { answerRateLimit } from '../middleware/rateLimiter';
import { validateBody, validateParams, SessionIdParam, answerSchema, violationSchema, startSessionSchema } from '../middleware/validate';
import {
  startSessionHandler,
  getTimeRemainingHandler,
  getQuestionsHandler,
  saveAnswerHandler,
  submitSessionHandler,
} from '../controllers/sessionController';
import { logViolation } from '../controllers/violationController';

const router = Router();

// All session routes require participant auth
router.use(participantAuth);

/** POST /api/session/start */
router.post('/start', validateBody(startSessionSchema), startSessionHandler);

/** GET /api/session/:sessionId/time-remaining */
router.get('/:sessionId/time-remaining', validateParams(SessionIdParam), getTimeRemainingHandler);

/** GET /api/session/:sessionId/questions?page=1 */
router.get('/:sessionId/questions', validateParams(SessionIdParam), getQuestionsHandler);

/** POST /api/session/:sessionId/answer */
router.post(
  '/:sessionId/answer',
  answerRateLimit,
  validateParams(SessionIdParam),
  validateBody(answerSchema),
  saveAnswerHandler
);

/** POST /api/session/:sessionId/submit */
router.post('/:sessionId/submit', validateParams(SessionIdParam), submitSessionHandler);

/** POST /api/session/:sessionId/violation */
router.post(
  '/:sessionId/violation',
  validateParams(SessionIdParam),
  validateBody(violationSchema),
  logViolation
);

export default router;
