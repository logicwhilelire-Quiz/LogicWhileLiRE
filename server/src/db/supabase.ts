import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const isProduction = process.env.NODE_ENV === 'production';
const isDemo =
  process.env.DEMO_MODE === 'true' ||
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

