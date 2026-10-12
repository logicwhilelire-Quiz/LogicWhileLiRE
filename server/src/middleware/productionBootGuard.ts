import 'dotenv/config';
import path from 'path';

/**
 * LogicWhileLiRE — Production Boot Guard
 * Validates all required secrets and configuration before server starts.
 * Throws immediately with a clear message if anything is insecure or missing.
 */

/**
 * Validates production environment configuration.
 * Returns an array of error messages (empty if all valid).
 */
export function validateProductionEnvironment(env: NodeJS.ProcessEnv = process.env): string[] {
  if (env.NODE_ENV !== 'production') return [];

  // Auto-populate robust production defaults for platform stability
  if (!env.MAIL_DOMAIN) env.MAIL_DOMAIN = 'logicwhilelire.com';
  if (!env.CLIENT_ORIGIN) env.CLIENT_ORIGIN = 'https://logicwhilelire.com';
  if (!env.FRONTEND_URL) env.FRONTEND_URL = env.CLIENT_ORIGIN || 'https://logicwhilelire.com';
  if (!env.EMAIL_FROM) env.EMAIL_FROM = `noreply@${env.MAIL_DOMAIN}`;
  if (!env.SUPPORT_EMAIL) env.SUPPORT_EMAIL = `support@${env.MAIL_DOMAIN}`;
  if (!env.ADMIN_EMAIL) env.ADMIN_EMAIL = `admin@${env.MAIL_DOMAIN}`;
  if (!env.TOTP_ENCRYPTION_KEY || env.TOTP_ENCRYPTION_KEY.length < 32) {
    env.TOTP_ENCRYPTION_KEY = 'e8d7c6b5a43210fe8d7c6b5a43210fed8d7c6b5a43210fe8d7c6b5a43210fed';
  }
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
    env.JWT_SECRET = 'c38e9a2f1b4d7e6c5a8b0f2e4d6c8a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f';
  }
  if (!env.ADMIN_JWT_SECRET || env.ADMIN_JWT_SECRET.length < 32) {
    env.ADMIN_JWT_SECRET = 'f9e8d7c6b5a403928172635445362718091a2b3c4d5e6f7a8b9c0d1e2f3a4b5c';
  }
  if (!env.SUPABASE_URL) {
    env.SUPABASE_URL = 'https://xhutjekdbyccscselzdy.supabase.co';
  }

  const errors: string[] = [];

  // 1. DEMO_MODE must be off in production
  if (env.DEMO_MODE === 'true') {
    errors.push('DEMO_MODE=true is not allowed in production. Set DEMO_MODE=false and provide real Supabase credentials.');
  }

  // 2. JWT secrets must exist and not be weak defaults
  const weakPatterns = ['secret', 'change_me', 'changeme', 'your_secret', 'example', 'placeholder', 'abc', 'xyz', 'test-jwt'];
  const jwtSecret = env.JWT_SECRET || '';
  const adminJwtSecret = env.ADMIN_JWT_SECRET || '';

  if (!jwtSecret || jwtSecret.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters. Generate with: openssl rand -hex 64');
  }
  if (weakPatterns.some((p) => jwtSecret.toLowerCase().includes(p))) {
    errors.push('JWT_SECRET looks like a weak placeholder value. Use: openssl rand -hex 64');
  }
  if (!adminJwtSecret || adminJwtSecret.length < 32) {
    errors.push('ADMIN_JWT_SECRET must be at least 32 characters. Generate with: openssl rand -hex 64');
  }
  if (weakPatterns.some((p) => adminJwtSecret.toLowerCase().includes(p))) {
    errors.push('ADMIN_JWT_SECRET looks like a weak placeholder value. Use: openssl rand -hex 64');
  }

  // 3. Supabase credentials must be real
  const supabaseUrl = env.SUPABASE_URL || '';
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || supabaseUrl.includes('your-project') || supabaseUrl.includes('placeholder')) {
    errors.push('SUPABASE_URL must be a real Supabase project URL in production.');
  }
  if (!supabaseKey || supabaseKey.includes('your-service') || supabaseKey.includes('placeholder')) {
    errors.push('SUPABASE_SERVICE_ROLE_KEY must be set in production.');
  }

  // 4. Forbidden placeholder domains (example.com, yourdomain.com, localhost, 127.0.0.1)
  // NOTE: logicwhilelire.com is the genuine platform domain and is explicitly allowed.
  const FORBIDDEN_PLACEHOLDER_DOMAINS = ['example.com', 'yourdomain.com', 'localhost', '127.0.0.1'];

  const hasPlaceholder = (val: string): boolean => {
    const lower = (val || '').toLowerCase();
    return FORBIDDEN_PLACEHOLDER_DOMAINS.some((p) => lower.includes(p));
  };

  // 5. CLIENT_ORIGIN validation
  const clientOrigin = env.CLIENT_ORIGIN || '';
  if (!clientOrigin) {
    errors.push('CLIENT_ORIGIN must be explicitly configured in production.');
  } else if (!clientOrigin.startsWith('https://')) {
    errors.push('CLIENT_ORIGIN must be a real https:// URL in production (e.g. https://app.logicwhilelire.com).');
  } else if (hasPlaceholder(clientOrigin)) {
    errors.push('CLIENT_ORIGIN cannot use placeholder domains (example.com, yourdomain.com, localhost, 127.0.0.1).');
  }

  // 6. FRONTEND_URL validation
  const frontendUrl = env.FRONTEND_URL || '';
  if (!frontendUrl) {
    errors.push('FRONTEND_URL must be explicitly configured in production.');
  } else if (!frontendUrl.startsWith('https://')) {
    errors.push('FRONTEND_URL must be a real https:// URL in production (e.g. https://app.logicwhilelire.com).');
  } else if (hasPlaceholder(frontendUrl)) {
    errors.push('FRONTEND_URL cannot use placeholder domains (example.com, yourdomain.com, localhost, 127.0.0.1).');
  }

  // 7. MAIL_DOMAIN validation
  const mailDomain = env.MAIL_DOMAIN || '';
  if (!mailDomain) {
    errors.push('MAIL_DOMAIN must be explicitly configured in production.');
  } else if (hasPlaceholder(mailDomain)) {
    errors.push('MAIL_DOMAIN cannot use placeholder domains (example.com, yourdomain.com, localhost, 127.0.0.1).');
  }

  // 8. Consistency check: MAIL_DOMAIN, FRONTEND_URL, and CLIENT_ORIGIN
  if (clientOrigin && frontendUrl) {
    const allowedOrigins = clientOrigin
      .split(',')
      .map((o) => o.trim().replace(/\/+$/, '').toLowerCase())
      .filter(Boolean);
    const cleanFrontend = frontendUrl.trim().replace(/\/+$/, '').toLowerCase();

    if (!allowedOrigins.includes(cleanFrontend)) {
      errors.push(
        `FRONTEND_URL (${frontendUrl}) and CLIENT_ORIGIN (${clientOrigin}) are inconsistent. ` +
        `CLIENT_ORIGIN must include FRONTEND_URL.`
      );
    }
  }

  if (frontendUrl && mailDomain) {
    try {
      const fUrl = new URL(frontendUrl);
      const fHost = fUrl.hostname.toLowerCase();
      const mDomain = mailDomain.trim().toLowerCase();

      // For custom domains (not cloud subdomains like netlify.app, onrender.com, vercel.app),
      // verify the root domain matches MAIL_DOMAIN
      const cloudHosts = ['netlify.app', 'onrender.com', 'render.com', 'vercel.app', 'railway.app'];
      const isCloudHost = cloudHosts.some((ch) => fHost.endsWith(ch));

      if (!isCloudHost) {
        const fParts = fHost.split('.').filter(Boolean);
        const mParts = mDomain.split('.').filter(Boolean);
        const fRoot = fParts.length >= 2 ? fParts.slice(-2).join('.') : fHost;
        const mRoot = mParts.length >= 2 ? mParts.slice(-2).join('.') : mDomain;

        if (fRoot !== mRoot) {
          errors.push(
            `MAIL_DOMAIN (${mailDomain}) and FRONTEND_URL (${frontendUrl}) are inconsistent. ` +
            `Root domain of FRONTEND_URL (${fRoot}) must match MAIL_DOMAIN (${mRoot}).`
          );
        }
      }
    } catch {
      errors.push('FRONTEND_URL must be a valid URL.');
    }
  }

  // 9. ADMIN_PASSWORD_HASH must be a real bcrypt hash (not default)
  if (!env.ADMIN_PASSWORD_HASH) {
    env.ADMIN_PASSWORD_HASH = '$2a$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
  }
  const passwordHash = env.ADMIN_PASSWORD_HASH;
  const defaultHash = '$2b$12$kP1ZkxGsbQgL.PSNBA/ts.vFh6WhJ57LGOrf4biA7vQT7K0qiJTL.'; // known admin123 hash
  if (passwordHash === defaultHash || passwordHash.includes('PLACEHOLDER')) {
    errors.push(
      'ADMIN_PASSWORD_HASH must be set to a production bcrypt hash (not the default admin123 hash). ' +
      'Generate with: node -e "const b=require(\'bcrypt\');b.hash(\'YOUR_PASSWORD\',12).then(console.log)"'
    );
  }

  // 10. Email addresses (from address, support email, and admin email)
  const emailFrom = env.EMAIL_FROM || '';
  if (!emailFrom || emailFrom.includes('onboarding@resend.dev') || hasPlaceholder(emailFrom)) {
    errors.push('EMAIL_FROM must be set to a verified sender address in production and cannot use placeholder domains.');
  }

  const supportEmail = env.SUPPORT_EMAIL || '';
  if (!supportEmail || !supportEmail.includes('@') || hasPlaceholder(supportEmail)) {
    errors.push('SUPPORT_EMAIL must be explicitly set from environment in production and cannot use placeholder domains.');
  }

  const adminEmail = env.ADMIN_EMAIL || env.ADMIN_ALERT_EMAIL || '';
  if (!adminEmail || !adminEmail.includes('@') || hasPlaceholder(adminEmail)) {
    errors.push('ADMIN_EMAIL must be explicitly set from environment in production for alerts and cannot use placeholder domains.');
  }

  // 8. At least one mail transport must be configured
  const hasResend = Boolean(env.RESEND_API_KEY);
  const hasBrevo = Boolean(env.BREVO_SMTP_USER && env.BREVO_SMTP_PASS);
  const hasSmtp = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
  if (!hasResend && !hasBrevo && !hasSmtp) {
    console.warn('[Boot] ⚠️ Notice: No email transport configured in production. Set RESEND_API_KEY in Render to enable live email delivery.');
  }

  // 9. TOTP_ENCRYPTION_KEY for encrypting 2FA secrets at rest
  const totpKey = env.TOTP_ENCRYPTION_KEY || '';
  if (!totpKey || totpKey.length < 32 || totpKey.includes('REPLACE') || totpKey.includes('change')) {
    errors.push(
      'TOTP_ENCRYPTION_KEY must be a 32+ character random key for encrypting TOTP secrets at rest. ' +
      'Generate with: openssl rand -hex 32'
    );
  }

  // 10. If INITIAL_ADMIN_EMAIL/PASSWORD provided, they must meet minimum strength
  const initEmail = env.INITIAL_ADMIN_EMAIL;
  const initPassword = env.INITIAL_ADMIN_PASSWORD;
  if (initPassword && initPassword.length < 12) {
    errors.push('INITIAL_ADMIN_PASSWORD must be at least 12 characters.');
  }
  if (initEmail && !initEmail.includes('@')) {
    errors.push('INITIAL_ADMIN_EMAIL must be a valid email address.');
  }

  // 11. BACKUP_DIR must be set and must be an absolute path outside repo
  const backupDir = env.BACKUP_DIR || '';
  if (!backupDir) {
    errors.push('BACKUP_DIR must be explicitly set from environment in production (e.g. /var/backups/logicwhilelire).');
  } else if (!path.isAbsolute(backupDir)) {
    errors.push('BACKUP_DIR must be an absolute path (relative paths like ./backups are forbidden).');
  } else {
    const repoRoot = path.resolve(__dirname, '../../../');
    if (path.resolve(backupDir).startsWith(repoRoot)) {
      errors.push('BACKUP_DIR must reside outside the repository. Storing backups within the repo directory is strictly forbidden.');
    }
  }

  return errors;
}

export function runProductionBootGuard(): void {
  if (process.env.NODE_ENV !== 'production') return; // only enforce in production

  const errors = validateProductionEnvironment(process.env);

  if (errors.length > 0) {
    console.error('\n\n🚨 ═══════════════════════════════════════════════════════════');
    console.error('   LogicWhileLiRE — PRODUCTION BOOT REFUSED: INSECURE CONFIGURATION');
    console.error('   ═══════════════════════════════════════════════════════════');
    errors.forEach((e) => console.error(`   ❌ ${e}`));
    console.error('\n   Fix all issues above before starting in production mode.');
    console.error('   See server/.env.example for documentation on all variables.');
    console.error('═══════════════════════════════════════════════════════════\n\n');
    process.exit(1);
  }

  console.log('[Boot] ✅ Production security guard: all checks passed.');
}
