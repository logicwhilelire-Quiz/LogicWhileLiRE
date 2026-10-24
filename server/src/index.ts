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
import { ensureCsrfCookie, csrfProtection, getCsrfToken } from './middleware/csrf';
import authRoutes from './routes/auth';
import enrollmentRoutes from './routes/enrollment';
import sessionRoutes from './routes/session';
import adminRoutes, { getLeaderboard } from './routes/admin';
import examCodeRoutes from './routes/examCode';
import assessmentRoutes from './routes/assessment';
import ultraRoutes from './routes/ultraRoutes';
import sectorRoutes from './routes/sectorRoutes';
import inspectorRoutes from './routes/inspectorRoutes';
import studentRoutes from './routes/student';
import contactRoutes from './routes/contactRoutes';
import webhookRoutes from './routes/webhooks';
import { startSessionCron } from './jobs/sessionCron';
import { startBackupScheduler } from './services/backupScheduler';
import { validateParams, ExamIdParam } from './middleware/validate';
import { initSocketIO } from './services/socketService';
import { verifyDatabaseConnectivity } from './db/supabase';

// ── PRODUCTION BOOT GUARD (must be first — refuses to start with weak secrets) ──
runProductionBootGuard();

const app = express();
const httpServer = http.createServer(app);
// Configure HTTP server keep-alive timeouts (65s > reverse proxy 60s default) to prevent socket drops
httpServer.keepAliveTimeout = 65000;
httpServer.headersTimeout = 66000;
const PORT = parseInt(process.env.PORT || '3001');

import fs from 'fs';
import path from 'path';

// Trust proxy (needed for rate limiting by real IP when behind Render/Railway/Nginx)
app.set('trust proxy', 1);

// ------- CORS & Origin Setup -------
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

if (process.env.NODE_ENV !== 'production') {
  if (!allowedOrigins.includes('http://127.0.0.1:5173')) allowedOrigins.push('http://127.0.0.1:5173');
  if (!allowedOrigins.includes('http://localhost:5173')) allowedOrigins.push('http://localhost:5173');
}

// ------- Performance & Security middleware -------
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: [
          "'self'",
          ...allowedOrigins,
          "https://*.supabase.co",
          "wss:",
          "ws:",
          "https://fonts.googleapis.com",
          "https://fonts.gstatic.com",
        ],
        mediaSrc: ["'self'", "blob:", "data:"],
        // workerSrc for Three.js / offline IndexedDB sync workers
        workerSrc: ["'self'", "blob:"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// Standard Permissions-Policy header for webcam and screen capture proctoring & Keep-Alive headers
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(self), display-capture=(self)');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=65, max=1000');
  next();
});

app.use(
  compression({
    threshold: 1024,
    level: 6,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    },
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.replace(/\/+$/, '');
      if (
        allowedOrigins.includes(cleanOrigin) ||
        allowedOrigins.includes(origin) ||
        (process.env.NODE_ENV !== 'production' && (cleanOrigin.startsWith('http://localhost:') || cleanOrigin.startsWith('http://127.0.0.1:')))
      ) {
        return callback(null, true);
      }
      callback(new Error('CORS: Origin not allowed'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'x-load-test'],
  })
);

// Serve logo.png from server static assets as resilient fallback
const clientLogoPath = path.resolve(__dirname, '../../client/public/logo.png');
const serverLogoPath = path.resolve(__dirname, '../logo.png');
app.get('/logo.png', (_req, res) => {
  if (fs.existsSync(clientLogoPath)) {
    res.sendFile(clientLogoPath);
  } else if (fs.existsSync(serverLogoPath)) {
    res.sendFile(serverLogoPath);
  } else {
    res.status(404).send('Logo not found');
  }
});

// ------- Request ID tracking (Phase J1) -------
app.use((req, res, next) => {
  const reqId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  req.headers['x-request-id'] = reqId as string;
  res.setHeader('X-Request-Id', reqId as string);
  next();
});

// ------- Resend webhook (MUST be before express.json so raw body is readable) -------
// CORS is not applied here — Resend calls this server-to-server.
app.use('/api/webhooks/resend', webhookRoutes);

// ------- Body parsing -------
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(sanitizeInput);

// ------- Double-Submit Cookie CSRF Protection -------
app.use(ensureCsrfCookie);
app.use(csrfProtection);

// ------- General rate limit -------
app.use(generalRateLimit);

// =====================================
// ROUTES
// =====================================

// CSRF token retrieval endpoint
app.get('/api/csrf-token', getCsrfToken);

// Health check — exposes demo mode status and version info
const isDemo =
  process.env.DEMO_MODE === 'true' ||
  !process.env.SUPABASE_URL ||
  (process.env.SUPABASE_URL || '').includes('your-project');

const handleHealthCheck = (_req: express.Request, res: express.Response) => {
  res.json({
    status: 'ok',
    service: 'LogicWhileLiRE Assessment Engine',
    version: '4.0.0',
    environment: process.env.NODE_ENV || 'development',
    demo_mode: isDemo,
    demo_banner: isDemo ? 'Running on in-memory demo data. Connect Supabase to enable production persistence.' : null,
    timestamp: new Date().toISOString(),
  });
};

app.get('/api/health', handleHealthCheck);
app.get('/health', handleHealthCheck);
app.get('/api/version', (_req, res) => {
  res.json({ status: 'ok', version: '4.0.0', service: 'LogicWhileLiRE Assessment Engine' });
});

// Readiness check (live database probe)
app.get('/api/ready', async (_req, res) => {
  const dbStatus = await verifyDatabaseConnectivity();
  const statusCode = dbStatus.connected ? 200 : 503;
  res.status(statusCode).json({
    status: dbStatus.connected ? 'ready' : 'degraded',
    ready: dbStatus.connected,
    service: 'LogicWhileLiRE Assessment Engine',
    database: {
      connected: dbStatus.connected,
      latency_ms: dbStatus.latencyMs,
      error: dbStatus.error || null,
      mode: isDemo ? 'in_memory_mock' : 'live_supabase',
    },
    timestamp: new Date().toISOString(),
  });
});

// Direct alias for public colleges
app.get('/colleges', (_req, res) => {
  res.redirect(307, '/api/colleges');
});

// Authentication (Students & Password Reset)
app.use('/api/auth', authRoutes);

// Student Portal & Dashboard
app.use('/api/student', studentRoutes);

// Gate Module - Candidate Assessment Registration (AL-SPEC-2026-REG)
app.use('/api/v1/assessment', assessmentRoutes);
app.use('/api/assessment', assessmentRoutes);

// Enrollment (public)
app.use('/api/enroll', enrollmentRoutes);

// Session (participant JWT required)
app.use('/api/session', sessionRoutes);

// Leaderboard (public)
app.get('/api/exam/:examId/leaderboard', validateParams(ExamIdParam), getLeaderboard);

// 5 Technical Sectors API (Quant, Logic, Core CS, DSA, Full-Stack)
app.use('/api/v1/sectors', sectorRoutes);
app.use('/api/sectors', sectorRoutes);

// Exam Code System (Hall Ticket + Code entry, No OTP)
app.use('/api', examCodeRoutes);

// LogicWhileLiRE Autonomous Assessment Engine routes (execute, AI, proctor, leaderboard, create-exam-wizard)
app.use('/api', ultraRoutes);

// Master Inspector Command & Candidate Communication Engine (Broadcasts, Reprimands, Emails, Receipts)
app.use('/api/v1/inspector', inspectorRoutes);
app.use('/api/inspector', inspectorRoutes);
app.use('/api/v1/communication', inspectorRoutes);
app.use('/api/communication', inspectorRoutes);

// Admin (admin JWT required)
app.use('/api/admin', adminRoutes);

// Contact & Support Form (Auto-Reply & Admin Alerts)
app.use('/api/v1/contact', contactRoutes);
app.use('/api/contact', contactRoutes);

// ------- 404 handler -------
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

import { systemAlertAgent } from './services/systemAlertService';

// ------- Global error handler -------
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server Error]', err);
  systemAlertAgent.recordSystemCrash({
    error: err,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(() => {});

  if (err.message && err.message.includes('CORS')) {
    res.status(403).json({ success: false, error: err.message });
    return;
  }
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message || 'Internal server error',
  });
});

// ------- Socket.io (Phase 1d: server-authoritative timer) -------
initSocketIO(httpServer);

// ------- Start server with high-capacity connection backlog -------
httpServer.listen(PORT, '0.0.0.0', 2048, async () => {
  console.log(`[Server] Running on port ${PORT} (${process.env.NODE_ENV})`);
  console.log(`[Socket.io] WebSocket server ready on port ${PORT}`);
  startSessionCron();
  startBackupScheduler();

  // Fail-fast database connectivity check
  const dbCheck = await verifyDatabaseConnectivity();
  if (dbCheck.connected) {
    console.log(`✅ [Database] Connection verified healthy (${dbCheck.latencyMs}ms)`);
    // Resume any pending or interrupted email jobs from database queue
    try {
      const { emailQueue } = await import('./services/emailQueue');
      await emailQueue.resumePendingJobs();
    } catch (queueErr) {
      console.warn('[Server] Notice: Email queue boot resumption:', queueErr);
    }
  } else {
    if (process.env.NODE_ENV === 'production') {
      console.warn('================================================================');
      console.warn('⚡ [Database Warning] Initial connectivity probe notice:');
      console.warn(`Details: ${dbCheck.error || 'transient latency'}`);
      console.warn('Server is running and health check is online.');
      console.warn('================================================================');
    } else {
      console.warn(`⚡ [Database Warning] Database connectivity probe returned: ${dbCheck.error}`);
    }
  }
});

// ------- Process Safety & Graceful Shutdown (Phase J1) -------
process.on('unhandledRejection', (reason: any) => {
  console.error('[Server] Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err: Error) => {
  console.error('[Server] Uncaught Exception:', err);
});

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
process.on('exit', (code) => {
  console.log(`[Server] Process exit event triggered with code: ${code}`);
});

export { app, httpServer };
export default app;
