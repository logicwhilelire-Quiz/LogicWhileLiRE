import { createClient, SupabaseClient } from '@supabase/supabase-js';

const isProduction = process.env.NODE_ENV === 'production';
const isMockRequested =
  !isProduction && (
    process.env.TEST_MOCK_ONLY === 'true' ||
    process.env.DEMO_MODE === 'true' ||
    process.env.NODE_ENV === 'test' ||
    (process.env.SUPABASE_URL || '').includes('mock')
  );

const rawUrl = process.env.TEST_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseUrl = isMockRequested ? (rawUrl || 'https://mock.supabase.co') : rawUrl;

let rawKey = process.env.TEST_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseServiceKey = isMockRequested ? (rawKey || 'mock-service-key') : rawKey;

const isDemo =
  isMockRequested ||
  (!isProduction && (
    !supabaseUrl ||
    !supabaseServiceKey ||
    supabaseUrl.includes('your-project') ||
    supabaseUrl.includes('placeholder')
  ));

if (isProduction) {
  if (isDemo || !supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      '🚨 [Database Fatal] Cannot load mock database or demo accounts in production mode. ' +
      'Valid SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are strictly required and DEMO_MODE must be false.'
    );
  }
} else if (isDemo) {
  console.log('⚡ [Database] Mock/Demo mode active: Using In-Memory Mock Database');
}

// ─── CIRCUIT BREAKER ────────────────────────────────────────────────────────
// Prevents cascading failure when Supabase is unreachable
interface CircuitState {
  failureCount: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

const circuit: CircuitState = {
  failureCount: 0,
  lastFailureTime: 0,
  state: 'CLOSED',
};

const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_RECOVERY_TIMEOUT_MS = 30_000;
const CIRCUIT_HALF_OPEN_SUCCESS_THRESHOLD = 2;
let halfOpenSuccesses = 0;

export function getCircuitState(): CircuitState {
  return { ...circuit };
}

function recordDbSuccess(): void {
  if (circuit.state === 'HALF_OPEN') {
    halfOpenSuccesses++;
    if (halfOpenSuccesses >= CIRCUIT_HALF_OPEN_SUCCESS_THRESHOLD) {
      circuit.state = 'CLOSED';
      circuit.failureCount = 0;
      halfOpenSuccesses = 0;
      console.log('[DB-Circuit] ✅ Circuit CLOSED — database healthy again');
    }
  } else if (circuit.state === 'CLOSED') {
    circuit.failureCount = 0;
  }
}

function recordDbFailure(context: string): void {
  circuit.failureCount++;
  circuit.lastFailureTime = Date.now();
  if (circuit.state === 'CLOSED' && circuit.failureCount >= CIRCUIT_FAILURE_THRESHOLD) {
    circuit.state = 'OPEN';
    console.error(`[DB-Circuit] ⛔ Circuit OPEN after ${CIRCUIT_FAILURE_THRESHOLD} failures (${context}). Will retry in ${CIRCUIT_RECOVERY_TIMEOUT_MS / 1000}s`);
  }
}

function checkCircuit(): void {
  if (circuit.state === 'OPEN') {
    const msSinceLastFailure = Date.now() - circuit.lastFailureTime;
    if (msSinceLastFailure >= CIRCUIT_RECOVERY_TIMEOUT_MS) {
      circuit.state = 'HALF_OPEN';
      halfOpenSuccesses = 0;
      console.log('[DB-Circuit] 🔄 Circuit HALF_OPEN — probing database...');
    } else {
      throw new Error(`[DB-Circuit] Circuit is OPEN. Retry in ${Math.ceil((CIRCUIT_RECOVERY_TIMEOUT_MS - msSinceLastFailure) / 1000)}s`);
    }
  }
}

// ─── SLOW QUERY LOGGER ───────────────────────────────────────────────────────
const SLOW_QUERY_THRESHOLD_MS = parseInt(process.env.SLOW_QUERY_THRESHOLD_MS || '500', 10);

export function logSlowQuery(table: string, operation: string, durationMs: number): void {
  if (durationMs >= SLOW_QUERY_THRESHOLD_MS) {
    console.warn(`[DB-SlowQuery] ⚠️ ${operation.toUpperCase()} on '${table}' took ${durationMs}ms (threshold: ${SLOW_QUERY_THRESHOLD_MS}ms)`);
  }
}

// ─── SUPABASE CLIENT ──────────────────────────────────────────────────────────
const clientOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
  global: {
    headers: { 'x-client-info': 'logicwhilelire-server/4.0.0' },
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
};

/**
 * Supabase server client with service-role key.
 * Server-side only — autoRefreshToken and persistSession are disabled.
 */
export const supabase: SupabaseClient = (
  isProduction
    ? createClient(supabaseUrl!, supabaseServiceKey!, clientOptions)
    : isDemo
    ? (() => {
        const { mockSupabase } = require('./mockSupabase');
        return mockSupabase;
      })()
    : createClient(supabaseUrl!, supabaseServiceKey!, clientOptions)
) as unknown as SupabaseClient;

// ─── RETRY WRAPPER ────────────────────────────────────────────────────────────
/**
 * Executes a Supabase query with exponential backoff retry + circuit breaker.
 * Use for critical writes that must not silently fail (attempts, submissions, scores).
 *
 * @example
 * const result = await withDbRetry(
 *   () => supabase.from('exam_code_attempts').upsert({ ... }),
 *   { context: 'upsert_attempt', maxAttempts: 3 }
 * );
 */
export async function withDbRetry<T>(
  fn: () => Promise<{ data: T | null; error: any }>,
  options?: {
    maxAttempts?: number;
    baseDelayMs?: number;
    context?: string;
  }
): Promise<{ data: T | null; error: any }> {
  const maxAttempts = options?.maxAttempts ?? 3;
  const baseDelay = options?.baseDelayMs ?? 200;
  const context = options?.context ?? 'db_operation';

  checkCircuit();

  let lastError: any = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const start = Date.now();
      const result = await fn();
      const durationMs = Date.now() - start;

      if (result.error) {
        const errMsg = String(result.error.message || '').toLowerCase();
        const isTransient =
          errMsg.includes('connection') ||
          errMsg.includes('timeout') ||
          errMsg.includes('too many') ||
          result.error.code === '08006' ||
          result.error.code === '08001' ||
          result.error.code === '57014';

        if (isTransient && attempt < maxAttempts) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          console.warn(`[DB-Retry] Attempt ${attempt}/${maxAttempts} for '${context}': ${result.error.message}. Retrying in ${delay}ms`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        recordDbFailure(context);
        return result;
      }

      if (durationMs >= SLOW_QUERY_THRESHOLD_MS) {
        console.warn(`[DB-SlowQuery] ⚠️ '${context}' took ${durationMs}ms`);
      }

      recordDbSuccess();
      return result;
    } catch (err: any) {
      lastError = err;
      recordDbFailure(context);
      const delay = baseDelay * Math.pow(2, attempt - 1);
      if (attempt < maxAttempts) {
        console.warn(`[DB-Retry] Attempt ${attempt}/${maxAttempts} for '${context}' threw: ${err.message}. Retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  return {
    data: null,
    error: lastError || new Error(`Max retries (${maxAttempts}) exceeded for '${context}'`),
  };
}

// ─── DATABASE CONNECTIVITY CHECK ──────────────────────────────────────────────
/**
 * Verifies live database connectivity at boot time.
 * Probes all critical tables to detect incomplete schema migrations early.
 */
export async function verifyDatabaseConnectivity(timeoutMs: number = 5000): Promise<{
  connected: boolean;
  latencyMs: number;
  error?: string;
  tables?: Record<string, boolean>;
}> {
  const start = Date.now();

  if (isDemo) {
    return { connected: true, latencyMs: 0, tables: { mock: true } };
  }

  try {
    const criticalTables = ['colleges', 'exam_codes', 'exam_code_attempts', 'students'];
    const tableResults: Record<string, boolean> = {};

    const queryPromise = Promise.all(
      criticalTables.map(async (table) => {
        const { error } = await supabase.from(table).select('id').limit(1);
        tableResults[table] = !error;
        if (error) {
          console.warn(`[DB-Health] Table '${table}' probe failed: ${error.message}`);
        }
      })
    );

    const timeoutPromise = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error(`Connection timed out after ${timeoutMs}ms`)), timeoutMs)
    );

    await Promise.race([queryPromise, timeoutPromise]);

    const allHealthy = Object.values(tableResults).every(Boolean);
    const latencyMs = Date.now() - start;

    if (allHealthy) {
      recordDbSuccess();
    } else {
      const failedTables = criticalTables.filter((t) => !tableResults[t]);
      recordDbFailure(`connectivity_check:${failedTables.join(',')}`);
    }

    return {
      connected: allHealthy,
      latencyMs,
      error: allHealthy ? undefined : `Tables unreachable: ${criticalTables.filter((t) => !tableResults[t]).join(', ')}`,
      tables: tableResults,
    };
  } catch (err: any) {
    recordDbFailure('connectivity_check');
    return {
      connected: false,
      latencyMs: Date.now() - start,
      error: err?.message || String(err),
    };
  }
}

// ─── REALTIME CHANNEL MANAGER ─────────────────────────────────────────────────
const activeChannels = new Map<string, ReturnType<typeof supabase.channel>>();

/** Register a realtime channel for lifecycle tracking */
export function registerChannel(
  name: string,
  channel: ReturnType<typeof supabase.channel>
): void {
  const existing = activeChannels.get(name);
  if (existing) {
    try { supabase.removeChannel(existing as any); } catch {}
  }
  activeChannels.set(name, channel);
}

/** Remove and unsubscribe a tracked channel by name */
export function removeChannel(name: string): void {
  const ch = activeChannels.get(name);
  if (ch) {
    try { supabase.removeChannel(ch as any); } catch {}
    activeChannels.delete(name);
  }
}

/** Remove all tracked channels — called on graceful shutdown */
export async function cleanupAllChannels(): Promise<void> {
  const names = Array.from(activeChannels.keys());
  for (const name of names) {
    removeChannel(name);
  }
  if (names.length > 0) {
    console.log(`[DB-Realtime] 🧹 Cleaned up ${names.length} active channel(s) on shutdown`);
  }
}

// Register shutdown hooks for clean realtime teardown
process.on('SIGTERM', () => cleanupAllChannels().catch(() => {}));
process.on('SIGINT', () => cleanupAllChannels().catch(() => {}));

