'use strict';
/**
 * LogicWhileLiRE — Phase 1 Follow-Up: HTTP Security Infrastructure Verification
 *
 * Verifies that all Phase 1 infrastructure gaps are confirmed present and correct:
 *   A. helmet CSP (camera, worker, websocket, font directives)
 *   B. CORS locked to CLIENT_ORIGIN (REST + Socket.io config)
 *   C. express-rate-limit on every sensitive route
 *   D. npm run create-admin script (email validation, 12-char minimum, duplicate guard, bcrypt 12)
 *   E. No token/password logged to stdout in production paths
 */

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

function readSrc(relPath) {
  return fs.readFileSync(path.join(__dirname, 'src', relPath), 'utf8');
}

console.log('\n================================================================');
console.log('🛡️  LogicWhileLiRE — PHASE 1 FOLLOW-UP: HTTP SECURITY SUITE');
console.log('================================================================\n');

// ── A. helmet CSP ────────────────────────────────────────────────────────────
console.log('--- [A] helmet CSP Directives ---');
const indexTs = readSrc('index.ts');
check('helmet imported and applied', /import helmet from 'helmet'/.test(indexTs) && /helmet\(/.test(indexTs));
check('CSP defaultSrc self', /defaultSrc.*'self'/.test(indexTs));
check('CSP fontSrc allows Google Fonts', /fontSrc.*fonts\.gstatic\.com/.test(indexTs));
check('CSP connectSrc allows Supabase wss', /connectSrc[\s\S]{0,300}supabase\.co[\s\S]{0,100}wss:/.test(indexTs));
check('CSP cameraSrc allows blob (webcam proctoring)', /cameraSrc.*blob:/.test(indexTs));
check('CSP workerSrc allows blob (Three.js / offline sync)', /workerSrc.*blob:/.test(indexTs));
check('CSP frameSrc none (clickjacking)', /frameSrc.*'none'/.test(indexTs));
check('CSP objectSrc none (no Flash/plugin)', /objectSrc.*'none'/.test(indexTs));

// ── B. CORS locked to CLIENT_ORIGIN ──────────────────────────────────────────
console.log('\n--- [B] CORS Configuration ---');
check('CORS reads CLIENT_ORIGIN from env', /CLIENT_ORIGIN/.test(indexTs));
check('CORS origin uses allowedOrigins array (not wildcard)', /allowedOrigins\.includes\(origin\)/.test(indexTs));
check('CORS credentials: true', /credentials:\s*true/.test(indexTs));
check('CORS rejects unlisted origins', /callback\(new Error\(.*CORS.*\)/.test(indexTs));
check('trust proxy set for Render', /app\.set\(.*trust proxy.*1/.test(indexTs));

// Socket.io CORS
const socketSvc = readSrc('services/socketService.ts');
const socketHasCors = socketSvc.includes('CLIENT_ORIGIN') || socketSvc.includes('allowedOrigins') ||
  indexTs.includes('initSocketIO') && !socketSvc.includes('origin: "*"');
check('Socket.io does not use wildcard origin (*)', !socketSvc.includes("origin: '*'") && !socketSvc.includes('origin: "*"'));

// ── C. Rate limiters on every sensitive route ──────────────────────────────
console.log('\n--- [C] Rate Limiting Coverage ---');
const rlFile = readSrc('middleware/rateLimiter.ts');
check('adminLoginRateLimit defined (10 req / 15 min)', /adminLoginRateLimit.*rateLimit/.test(rlFile));
check('authRateLimit defined (student login/register)', /authRateLimit.*rateLimit/.test(rlFile));
check('passwordResetRateLimit defined (forgot/reset)', /passwordResetRateLimit.*rateLimit/.test(rlFile));
check('otpRateLimit defined (OTP verify)', /otpRateLimit.*rateLimit/.test(rlFile));
check('enterExamRateLimit defined', /enterExamRateLimit.*rateLimit/.test(rlFile));
check('enrollRateLimit defined (registration)', /enrollRateLimit.*rateLimit/.test(rlFile));
check('generalRateLimit applied globally', /app\.use\(generalRateLimit/.test(indexTs));

// Verify limiters are actually wired to routes
const adminRoute = readSrc('routes/admin.ts');
const authRoute = readSrc('routes/auth.ts');
const enrollRoute = readSrc('routes/enrollment.ts');
const examCodeRoute = readSrc('routes/examCode.ts');
check('adminLoginRateLimit applied to admin login route', /adminLoginRateLimit/.test(adminRoute));
check('authRateLimit applied to auth routes', /authRateLimit/.test(authRoute));
check('passwordResetRateLimit applied to forgot/reset routes', /passwordResetRateLimit/.test(authRoute));
check('enrollRateLimit applied to enrollment routes', /enrollRateLimit/.test(enrollRoute));
check('enterExamRateLimit applied to exam entry route', /enterExamRateLimit/.test(examCodeRoute));

// ── D. create-admin script ────────────────────────────────────────────────
console.log('\n--- [D] create-admin Script ---');
const pkgJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
check('npm run create-admin script defined', !!pkgJson.scripts['create-admin']);
check('create-admin uses tsx (TypeScript runner)', (pkgJson.scripts['create-admin'] || '').includes('tsx'));

const createAdminSrc = readSrc('scripts/createAdmin.ts');
check('create-admin validates email format', /emailRegex\.test/.test(createAdminSrc));
check('create-admin enforces min 12-char password', /password\.length\s*<\s*12/.test(createAdminSrc));
check('create-admin blocks weak passwords (admin123 etc)', /weakPasswords/.test(createAdminSrc));
check('create-admin checks for duplicate email', /\.maybeSingle\(\)/.test(createAdminSrc) && /already exists/.test(createAdminSrc));
check('create-admin uses bcrypt 12 rounds', /bcrypt\.hash\(password,\s*12\)/.test(createAdminSrc));
check('create-admin inserts into staff table as super_admin', /role:\s*'super_admin'/.test(createAdminSrc));
check('create-admin accepts env vars (ADMIN_EMAIL, ADMIN_PASSWORD)', /ADMIN_EMAIL/.test(createAdminSrc) && /ADMIN_PASSWORD/.test(createAdminSrc));
check('create-admin refuses if email already exists (exit 1)', /process\.exit\(1\)/.test(createAdminSrc) && /already exists/.test(createAdminSrc));

// ── E. No token/password in production logs ───────────────────────────────
console.log('\n--- [E] Secret Leakage to Logs ---');
const authCtrl = readSrc('controllers/authController.ts');
const adminCtrl = readSrc('controllers/adminController.ts');

// Reset link must be gated
const resetLinkLogGated =
  /if\s*\(process\.env\.NODE_ENV\s*!==\s*'production'/.test(authCtrl) &&
  /PASSWORD RESET LINK/.test(authCtrl);
check('Password reset link logged only in non-production (token leak fix)', resetLinkLogGated);

// No raw passwords in logs
const noPasswordLog = !/(console\.(log|warn|info|error)[\s\S]{0,50}password[^H])/i.test(authCtrl) &&
  !/(console\.(log|warn|info|error)[\s\S]{0,50}password[^H])/i.test(adminCtrl);
check('No raw password values in console output (authController)', !/console\.(log|info)\(.*password(?!Hash|_hash|Regex|Error|Valid)/i.test(authCtrl));
check('No raw password values in console output (adminController)', !/console\.(log|info)\(.*password(?!Hash|_hash|Regex|Error|Valid)/i.test(adminCtrl));

// No tokens in non-gated logs
const rawTokenInLog = (src) => {
  const lines = src.split('\n');
  return lines.some((line) => {
    const trimmed = line.trim();
    return /console\.(log|info)\(/.test(trimmed) && /rawToken|accessToken|jwt/.test(trimmed);
  });
};
check('No raw JWT/token values in console.log (authController)', !rawTokenInLog(authCtrl));
check('No raw JWT/token values in console.log (adminController)', !rawTokenInLog(adminCtrl));

// ── Summary ───────────────────────────────────────────────────────────────
console.log('\n================================================================');
if (failed === 0) {
  console.log(`🎉 ALL ${passed} PHASE 1 FOLLOW-UP SECURITY TESTS PASSED!`);
} else {
  console.log(`⚠️  ${passed} passed, ${failed} FAILED — fix failures before deploying.`);
  process.exit(1);
}
console.log('================================================================\n');
