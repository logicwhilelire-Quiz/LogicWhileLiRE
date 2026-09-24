import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { mockSupabase } from './mockSupabase';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const isDemo =
  process.env.DEMO_MODE === 'true' ||
  !supabaseUrl ||
  !supabaseServiceKey ||
  supabaseUrl.includes('your-project') ||
  supabaseUrl.includes('placeholder');

if (isDemo) {
  console.log('⚡ [Database] Supabase URL is placeholder or DEMO_MODE active: Using In-Memory Demo Database');
}

/**
 * Supabase client typed properly for TypeScript compile
 */
export const supabase: SupabaseClient = (
  isDemo
    ? mockSupabase
    : createClient(supabaseUrl!, supabaseServiceKey!, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
) as unknown as SupabaseClient;
