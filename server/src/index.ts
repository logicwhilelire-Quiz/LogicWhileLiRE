import 'dotenv/config';
import express from 'express';
import http from 'http';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { runProductionBootGuard } from './middleware/productionBootGuard';
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

// ── PRODUCTION BOOT GUARD (must be first — refuses to start with weak secrets) ──
runProductionBootGuard();

const app = express();
const httpServer = http.createServer(app);
const PORT = parseInt(process.env.PORT || '3001');

// ------- Performance & Security middleware -------
app.use(helmet());
app.use(compression());

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
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'x-load-test'],
  })
);

// ------- Request ID tracking (Phase J1) -------
app.use((req, res, next) => {
  const reqId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  req.headers['x-request-id'] = reqId as string;
  res.setHeader('X-Request-Id', reqId as string);
  next();
});

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

// Health check — exposes demo mode status and version info
const isDemo =
  process.env.DEMO_MODE === 'true' ||
  !process.env.SUPABASE_URL ||
  (process.env.SUPABASE_URL || '').includes('your-project');

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'GROWTHRAN Assessment Engine',
    version: '4.0.0',
    environment: process.env.NODE_ENV || 'development',
    demo_mode: isDemo,
    demo_banner: isDemo ? 'Running on in-memory demo data. Connect Supabase to enable production persistence.' : null,
    timestamp: new Date().toISOString(),
  });
});

// Readiness check (Phase J1)
app.get('/api/ready', (_req, res) => {
  res.json({
    status: 'ready',
    ready: true,
    service: 'GROWTHRAN Assessment Engine',
    database: isDemo ? 'in_memory_ready' : 'connected',
    timestamp: new Date().toISOString(),
  });
});

// Legacy health route (keep for backwards compat)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', demo_mode: isDemo, timestamp: new Date().toISOString() });
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

// GROWTHRAN Autonomous Assessment Engine routes (execute, AI, proctor, leaderboard, create-exam-wizard)
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

// ------- Start server with high-capacity connection backlog -------
httpServer.listen(PORT, '0.0.0.0', 2048, () => {
  console.log(`[Server] Running on port ${PORT} (${process.env.NODE_ENV})`);
  console.log(`[Socket.io] WebSocket server ready on port ${PORT}`);
  startSessionCron();
});

// ------- Graceful shutdown handlers (Phase J1) -------
const handleGracefulShutdown = (signal: string) => {
  console.log(`[Server] Received ${signal}. Starting graceful shutdown...`);
  httpServer.close(() => {
    console.log('[Server] HTTP and WebSocket server closed cleanly.');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('[Server] Forcing shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));

export default app;
