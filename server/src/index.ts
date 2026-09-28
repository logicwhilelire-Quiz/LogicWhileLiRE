import 'dotenv/config';
import express from 'express';
import http from 'http';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { generalRateLimit } from './middleware/rateLimiter';
import { sanitizeInput } from './middleware/sanitize';
import authRoutes from './routes/auth';
import enrollmentRoutes from './routes/enrollment';
import sessionRoutes from './routes/session';
import adminRoutes, { getLeaderboard } from './routes/admin';
import examCodeRoutes from './routes/examCode';
import assessmentRoutes from './routes/assessment';
import ultraRoutes from './routes/ultraRoutes';
import { startSessionCron } from './jobs/sessionCron';
import { validateParams, ExamIdParam } from './middleware/validate';
import { initSocketIO } from './services/socketService';

const app = express();
const httpServer = http.createServer(app);
const PORT = parseInt(process.env.PORT || '3001');

// ------- Security headers -------
app.use(helmet());

// Trust proxy (needed for rate limiting by real IP when behind Render/Railway/Nginx)
app.set('trust proxy', 1);

// ------- CORS - locked to allowed origins (1f: CORS allowlist) -------
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error('CORS: Origin not allowed'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ------- Body parsing -------
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(sanitizeInput);

// ------- General rate limit -------
app.use(generalRateLimit);

// =====================================
// ROUTES
// =====================================

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Authentication (Students & Password Reset)
app.use('/api/auth', authRoutes);

// Gate Module - Candidate Assessment Registration (AL-SPEC-2026-REG)
app.use('/api/v1/assessment', assessmentRoutes);
app.use('/api/assessment', assessmentRoutes);

// Enrollment (public)
app.use('/api/enroll', enrollmentRoutes);

// Session (participant JWT required)
app.use('/api/session', sessionRoutes);

// Leaderboard (public)
app.get('/api/exam/:examId/leaderboard', validateParams(ExamIdParam), getLeaderboard);

// GROWTHRAN Autonomous Assessment Engine routes (execute, AI, proctor, certificate, leaderboard, create-exam-wizard)
app.use('/api', ultraRoutes);

// Exam Code System (Hall Ticket + Code entry, No OTP)
app.use('/api', examCodeRoutes);

// Admin (admin JWT required)
app.use('/api/admin', adminRoutes);

// ------- 404 handler -------
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ------- Global error handler -------
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server Error]', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ------- Socket.io (Phase 1d: server-authoritative timer) -------
initSocketIO(httpServer);

// ------- Start server -------
httpServer.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT} (${process.env.NODE_ENV})`);
  console.log(`[Socket.io] WebSocket server ready on port ${PORT}`);
  startSessionCron();
});


export default app;
