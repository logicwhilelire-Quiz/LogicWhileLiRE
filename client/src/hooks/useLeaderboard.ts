import { useState, useEffect, useCallback } from 'react';
import { getLeaderboard as fetchLeaderboard } from '../lib/api';
import { supabase } from '../lib/supabaseClient';

export interface LeaderboardEntry {
  rank: number;
  name: string;
  hall_ticket: string;
  total_score: number;
  max_score: number;
  correct_count: number;
  wrong_count: number;
  time_taken_seconds: number;
}

/**
 * useLeaderboard — fetches leaderboard and subscribes to Supabase Realtime
 * for live updates when new results are inserted.
 */
export function useLeaderboard(examId: string) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetchLeaderboard(examId);
      setEntries(res.data.leaderboard);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: unknown) {
      setError('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  // Initial fetch and automatic polling fallback (every 15s) to guarantee freshness regardless of RLS CDC policies
  useEffect(() => {
    refresh();
    const interval = setInterval(() => {
      refresh();
    }, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Supabase Realtime — subscribe to results table inserts for live updates
  useEffect(() => {
    const channel = supabase
      .channel(`results:exam:${examId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'results' },
        () => {
          // New result inserted — refetch leaderboard
          refresh();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'results' },
        () => {
          refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [examId, refresh]);

  return { entries, loading, error, lastUpdated, refresh };
}
