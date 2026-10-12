import { useState, useEffect, useRef, useCallback } from 'react';
import { getTimeRemaining } from '../lib/api';

interface TimerState {
  remainingSeconds: number;
  status: string;
  isExpired: boolean;
  isWarning: boolean;    // < 5 minutes
  isCritical: boolean;   // < 1 minute
  displayTime: string;   // formatted "MM:SS" or "HH:MM:SS"
  resync: () => Promise<void>;
}

const WARNING_THRESHOLD = 5 * 60;  // 5 minutes
const CRITICAL_THRESHOLD = 60;     // 1 minute
const POLL_INTERVAL = 10 * 1000;   // 10 seconds

/**
 * useTimer — server-authoritative countdown timer.
 * - Polls GET /api/session/:sessionId/time-remaining every 10 seconds to resync.
 * - Uses client-side setInterval for smooth per-second display updates between polls.
 * - Client never sets or extends the timer — it only displays the server's truth.
 */
export function useTimer(sessionId: string, onExpired?: () => void): TimerState {
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [status, setStatus] = useState('in_progress');
  const lastSyncRef = useRef<number>(Date.now());
  const lastServerValueRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiredCallbackFiredRef = useRef(false);

  const syncFromServer = useCallback(async () => {
    try {
      const res = await getTimeRemaining(sessionId);
      const { remaining_seconds, status: serverStatus } = res.data;

      lastServerValueRef.current = remaining_seconds;
      lastSyncRef.current = Date.now();
      setRemainingSeconds(remaining_seconds);
      setStatus(serverStatus);

      if (remaining_seconds === 0 && !expiredCallbackFiredRef.current) {
        expiredCallbackFiredRef.current = true;
        onExpired?.();
      }
    } catch (err) {
      console.warn('[Timer] Failed to sync from server:', err);
    }
  }, [sessionId, onExpired]);

  // Initial sync
  useEffect(() => {
    syncFromServer();
  }, [syncFromServer]);

  // Polling every 10 seconds
  useEffect(() => {
    pollRef.current = setInterval(syncFromServer, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [syncFromServer]);

  // Smooth per-second countdown between polls
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        const elapsed = Math.floor((Date.now() - lastSyncRef.current) / 1000);
        const interpolated = Math.max(0, lastServerValueRef.current - elapsed);

        if (interpolated === 0 && !expiredCallbackFiredRef.current && prev > 0) {
          expiredCallbackFiredRef.current = true;
          onExpired?.();
        }

        return interpolated;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [onExpired]);

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return {
    remainingSeconds,
    status,
    isExpired: remainingSeconds === 0,
    isWarning: remainingSeconds > 0 && remainingSeconds <= WARNING_THRESHOLD,
    isCritical: remainingSeconds > 0 && remainingSeconds <= CRITICAL_THRESHOLD,
    displayTime: formatTime(remainingSeconds),
    resync: syncFromServer,
  };
}
