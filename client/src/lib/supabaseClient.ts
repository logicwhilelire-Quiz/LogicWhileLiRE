import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';

/**
 * Indicates whether Supabase credentials are configured with live endpoints
 */
export const isSupabaseConfigured: boolean = Boolean(
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_URL.includes('your-project') &&
  !SUPABASE_URL.includes('placeholder')
);

/**
 * Authoritative Supabase Client for LogicWhileLiRE Client-Side Operations.
 * Configured with session persistence, automatic token refresh, and resilient connection parameters.
 */
export const supabase: SupabaseClient = createClient(
  SUPABASE_URL || 'https://mock.supabase.co',
  SUPABASE_ANON_KEY || 'mock-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
    global: {
      headers: {
        'x-application-name': 'LogicWhileLiRE-Client',
      },
    },
  }
);

// Active Realtime Channel Registry for leak prevention & component unmount cleanup
const activeChannels = new Map<string, RealtimeChannel>();

/**
 * Registers and tracks a Realtime channel, automatically removing any previous channel with the same name.
 */
export function registerClientChannel(name: string, channel: RealtimeChannel): RealtimeChannel {
  const existing = activeChannels.get(name);
  if (existing) {
    try {
      supabase.removeChannel(existing);
    } catch {}
  }
  activeChannels.set(name, channel);
  return channel;
}

/**
 * Unsubscribes and cleans up a tracked Realtime channel by name.
 */
export function removeClientChannel(name: string): void {
  const channel = activeChannels.get(name);
  if (channel) {
    try {
      supabase.removeChannel(channel);
    } catch {}
    activeChannels.delete(name);
  }
}

/**
 * Tears down all active Realtime subscriptions (e.g. upon user logout or navigation away).
 */
export function cleanupAllClientChannels(): void {
  for (const [, ch] of activeChannels.entries()) {
    try {
      supabase.removeChannel(ch);
    } catch {}
  }
  activeChannels.clear();
}

/**
 * Quick client-side latency probe and connectivity check
 */
export async function checkSupabaseHealth(timeoutMs: number = 5000): Promise<{
  connected: boolean;
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const { error } = await supabase
      .from('colleges')
      .select('id')
      .limit(1)
      .abortSignal(controller.signal);

    clearTimeout(timer);

    return {
      connected: !error,
      latencyMs: Date.now() - start,
      error: error?.message,
    };
  } catch (err: any) {
    return {
      connected: false,
      latencyMs: Date.now() - start,
      error: err?.message || 'Connection timed out',
    };
  }
}

export default supabase;
