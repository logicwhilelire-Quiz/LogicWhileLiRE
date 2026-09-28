import 'dotenv/config';

/**
 * GROWTHRAN — Production Boot Guard
 * Validates all required secrets and configuration before server starts.
 * Throws immediately with a clear message if anything is insecure.
 */
export function runProductionBootGuard(): void {
  if (process.env.NODE_ENV !== 'production') return; // only enforce in production

  const errors: string[] = [];

  // 1. DEMO_MODE must be off in production
  if (process.env.DEMO_MODE === 'true') {
    errors.push('DEMO_MODE=true is not allowed in production. Set DEMO_MODE=false and provide real Supabase credentials.');
  }

  // 2. JWT secrets must exist and not be weak defaults
  const weakPatterns = ['secret', 'change_me', 'changeme', 'your_secret', 'example', 'placeholder', 'abc', 'xyz'];
  const jwtSecret = process.env.JWT_SECRET || '';
  const adminJwtSecret = process.env.ADMIN_JWT_SECRET || '';

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
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || supabaseUrl.includes('your-project') || supabaseUrl.includes('placeholder')) {
    errors.push('SUPABASE_URL must be a real Supabase project URL in production.');
  }
  if (!supabaseKey || supabaseKey.includes('your-service') || supabaseKey.includes('placeholder')) {
    errors.push('SUPABASE_SERVICE_ROLE_KEY must be set in production.');
  }

  // 4. CLIENT_ORIGIN must be a real https domain
  const clientOrigin = process.env.CLIENT_ORIGIN || '';
  if (!clientOrigin || clientOrigin.includes('localhost') || !clientOrigin.startsWith('https://')) {
    errors.push('CLIENT_ORIGIN must be a real https:// production domain in production (e.g. https://app.growthran.com).');
  }

  // 5. ADMIN_PASSWORD_HASH must be a real bcrypt hash (not default)
  const passwordHash = process.env.ADMIN_PASSWORD_HASH || '';
  const defaultHash = '$2b$12$kP1ZkxGsbQgL.PSNBA/ts.vFh6WhJ57LGOrf4biA7vQT7K0qiJTL.'; // known admin123 hash
  if (!passwordHash || passwordHash === defaultHash || passwordHash.includes('PLACEHOLDER')) {
    errors.push(
      'ADMIN_PASSWORD_HASH must be set to a production bcrypt hash (not the default admin123 hash). ' +
      'Generate with: node -e "const b=require(\'bcrypt\');b.hash(\'YOUR_PASSWORD\',12).then(console.log)"'
    );
  }

  // 6. If INITIAL_ADMIN_EMAIL/PASSWORD provided, they must meet minimum strength
  const initEmail = process.env.INITIAL_ADMIN_EMAIL;
  const initPassword = process.env.INITIAL_ADMIN_PASSWORD;
  if (initPassword && initPassword.length < 12) {
    errors.push('INITIAL_ADMIN_PASSWORD must be at least 12 characters.');
  }
  if (initEmail && !initEmail.includes('@')) {
    errors.push('INITIAL_ADMIN_EMAIL must be a valid email address.');
  }

  if (errors.length > 0) {
    console.error('\n\n🚨 ═══════════════════════════════════════════════════════════');
    console.error('   GROWTHRAN — PRODUCTION BOOT REFUSED: INSECURE CONFIGURATION');
    console.error('   ═══════════════════════════════════════════════════════════');
    errors.forEach((e) => console.error(`   ❌ ${e}`));
    console.error('\n   Fix all issues above before starting in production mode.');
    console.error('   See server/.env.example for documentation on all variables.');
    console.error('═══════════════════════════════════════════════════════════\n\n');
    process.exit(1);
  }

  console.log('[Boot] ✅ Production security guard: all checks passed.');
}
