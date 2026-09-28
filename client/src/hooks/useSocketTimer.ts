/**
 * useSocketTimer.ts
 * Phase 1d: Server-pushed timer via Socket.io.
 * Falls back to REST polling (useTimer) if socket connection fails.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketTimerState {
  remainingSeconds: number;
  status: string;
  isExpired: boolean;
  isWarning: boolean;
  isCritical: boolean;
  displayTime: string;
  connectionState: 'connected' | 'reconnecting' | 'offline';
}

const WARNING_THRESHOLD = 5 * 60;
const CRITICAL_THRESHOLD = 60;

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

export function useSocketTimer(
  apiBase: string,
  attemptId: string,
  examCode: string,
  sessionToken: string,
  onExpired?: () => void,
  onEvicted?: () => void
): SocketTimerState {
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [status, setStatus] = useState('in_progress');
  const [connectionState, setConnectionState] = useState<'connected' | 'reconnecting' | 'offline'>('reconnecting');
  const expiredFiredRef = useRef(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!attemptId || !examCode) return;

    const socket = io(apiBase, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionState('connected');
      socket.emit('exam:join', { attemptId, examCode, sessionToken });
    });

    socket.on('disconnect', () => setConnectionState('reconnecting'));
    socket.on('connect_error', () => setConnectionState('offline'));

    socket.on('timer:tick', ({ remaining_seconds, status: s }: { remaining_seconds: number; status: string }) => {
      setRemainingSeconds(remaining_seconds);
      setStatus(s);
      if (remaining_seconds === 0 && !expiredFiredRef.current) {
        expiredFiredRef.current = true;
        onExpired?.();
      }
    });

    socket.on('exam:auto-submit', () => {
      if (!expiredFiredRef.current) {
        expiredFiredRef.current = true;
        onExpired?.();
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [apiBase, attemptId, examCode, sessionToken, onExpired, onEvicted]);

  return {
    remainingSeconds,
    status,
    isExpired: remainingSeconds === 0 && expiredFiredRef.current,
    isWarning: remainingSeconds > 0 && remainingSeconds <= WARNING_THRESHOLD,
    isCritical: remainingSeconds > 0 && remainingSeconds <= CRITICAL_THRESHOLD,
    displayTime: formatTime(remainingSeconds),
    connectionState,
  };
}
