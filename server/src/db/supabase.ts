import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.TEST_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.TEST_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const isProduction = process.env.NODE_ENV === 'production';
const isDemo =
  (process.env.DEMO_MODE === 'true' && !process.env.TEST_SUPABASE_URL) ||
  !supabaseUrl ||
  !supabaseServiceKey ||
  supabaseUrl.includes('your-project') ||
  supabaseUrl.includes('placeholder');

if (isProduction) {
  if (isDemo || !supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      '🚨 [Database Fatal] Cannot load mock database or demo accounts in production mode. ' +
      'Valid SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are strictly required and DEMO_MODE must be false.'
    );
  }
} else if (isDemo) {
  console.log('⚡ [Database] Supabase URL is placeholder or DEMO_MODE active: Using In-Memory Demo Database');
}

/**
 * Supabase client typed properly for TypeScript compile
 */
export const supabase: SupabaseClient = (
  isProduction
    ? createClient(supabaseUrl!, supabaseServiceKey!, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : isDemo
    ? (() => {
        // Dynamically load mockSupabase only in non-production environments
        const { mockSupabase } = require('./mockSupabase');
        return mockSupabase;
      })()
    : createClient(supabaseUrl!, supabaseServiceKey!, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
) as unknown as SupabaseClient;

/**
 * Verifies live database connectivity at boot time.
 * In production mode, queries the database to confirm reachable credentials.
 * In demo / test mode, verifies mock store readiness.
 */
export async function verifyDatabaseConnectivity(timeoutMs: number = 5000): Promise<{ connected: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const queryPromise = supabase
      .from('colleges')
      .select('id')
      .limit(1);

    const timeoutPromise = new Promise<{ data: any; error: any }>((_, reject) =>
      setTimeout(() => reject(new Error(`Connection timed out after ${timeoutMs}ms`)), timeoutMs)
    );

    const { data, error } = (await Promise.race([queryPromise, timeoutPromise])) as any;

    if (error) {
      return {
        connected: false,
        latencyMs: Date.now() - start,
        error: `Supabase query failed: ${error.message} (code: ${error.code || 'UNKNOWN'})`,
      };
    }

    return {
      connected: true,
      latencyMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      connected: false,
      latencyMs: Date.now() - start,
      error: err?.message || String(err),
    };
  }
}


