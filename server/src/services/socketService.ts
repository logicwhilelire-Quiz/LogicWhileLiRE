/**
 * socketService.ts
 * Phase 1d: Socket.io server-pushed timer + waiting lobby + leaderboard
 *
 * Timer protocol (server is the only authority):
 * - Client joins room `exam:${attemptId}` on connect
 * - Server emits `timer:tick` every second with { remaining_seconds, status }
 * - Client renders the received value; never self-calculates
 * - On reconnect: server sends current remaining immediately
 *
 * Waiting lobby / leaderboard:
 * - Rooms: `lobby:${examCode}` and `leaderboard:${examCode}`
 * - Server emits `lobby:update` and `leaderboard:update` when data changes
 */

import { Server as HttpServer } from 'http';
import { Server as IOServer, Socket } from 'socket.io';
import { supabase } from '../db/supabase';

export let io: IOServer | null = null;

// exam attempt timer intervals
const timerIntervals = new Map<string, ReturnType<typeof setInterval>>();

export function initSocketIO(httpServer: HttpServer): IOServer {
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

  io = new IOServer(httpServer, {
    cors: {
      origin: clientOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    // ── Exam timer ───────────────────────────────────────────────────────
    socket.on('exam:join', async ({ attemptId, examCode, sessionToken }: {
      attemptId: string;
      examCode: string;
      sessionToken: string;
    }) => {
      if (!attemptId || !examCode) return;
      const room = `exam:${attemptId}`;
      socket.join(room);

      // Fetch remaining time from the exam_codes end_time
      await sendTimerTick(socket, attemptId, examCode);

      // Start a per-second tick for this socket (idempotent)
      if (!timerIntervals.has(room)) {
        const interval = setInterval(async () => {
          if (!io) return;
          await sendTimerTickToRoom(room, attemptId, examCode);
        }, 1000);
        timerIntervals.set(room, interval);
      }
    });

    // ── Waiting lobby ────────────────────────────────────────────────────
    socket.on('lobby:join', async ({ examCode }: { examCode: string }) => {
      if (!examCode) return;
      socket.join(`lobby:${examCode}`);
      await emitLobbyUpdate(examCode);
    });

    // ── Leaderboard ──────────────────────────────────────────────────────
    socket.on('leaderboard:join', async ({ examCode }: { examCode: string }) => {
      if (!examCode) return;
      socket.join(`leaderboard:${examCode}`);
      await emitLeaderboardUpdate(examCode);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
      // Note: room timer intervals persist until exam window closes (by design)
      // — they are cleared when an attempt is submitted
    });
  });

  return io;
}

// ── Timer helpers ────────────────────────────────────────────────────────────

async function computeRemainingSeconds(examCode: string): Promise<{ remaining: number; status: string }> {
  const { data: exam } = await supabase
    .from('exam_codes')
    .select('end_time, is_active')
    .eq('exam_code', examCode.toUpperCase())
    .maybeSingle();

  if (!exam || !exam.is_active) return { remaining: 0, status: 'expired' };
  const endTime = new Date(exam.end_time).getTime();
  const now = Date.now();
  const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
  return { remaining, status: remaining > 0 ? 'in_progress' : 'expired' };
}

async function sendTimerTick(socket: Socket, attemptId: string, examCode: string) {
  const { remaining, status } = await computeRemainingSeconds(examCode);
  socket.emit('timer:tick', { remaining_seconds: remaining, status });
  if (remaining === 0) {
    // Auto-submit signal
    socket.emit('exam:auto-submit', { reason: 'time_expired' });
  }
}

async function sendTimerTickToRoom(room: string, attemptId: string, examCode: string) {
  if (!io) return;
  const { remaining, status } = await computeRemainingSeconds(examCode);
  io.to(room).emit('timer:tick', { remaining_seconds: remaining, status });
  if (remaining === 0) {
    io.to(room).emit('exam:auto-submit', { reason: 'time_expired' });
    // Stop ticking once expired
    const interval = timerIntervals.get(room);
    if (interval) {
      clearInterval(interval);
      timerIntervals.delete(room);
    }
  }
}

// ── Lobby / leaderboard emitters (called by REST routes after mutations) ─────

export async function emitLobbyUpdate(examCode: string) {
  if (!io) return;
  const { data } = await supabase
    .from('exam_code_attempts')
    .select('hall_ticket_no, student_name, status, created_at')
    .eq('exam_code', examCode.toUpperCase())
    .order('created_at', { ascending: false });
  io.to(`lobby:${examCode}`).emit('lobby:update', { participants: data || [] });
}

export async function emitLeaderboardUpdate(examCode: string) {
  if (!io) return;
  const { data } = await supabase
    .from('exam_code_attempts')
    .select('hall_ticket_no, student_name, score, max_score, correct_count, time_taken_seconds, status')
    .eq('exam_code', examCode.toUpperCase())
    .in('status', ['completed', 'terminated_cheating'])
    .order('score', { ascending: false })
    .order('time_taken_seconds', { ascending: true });
  io.to(`leaderboard:${examCode}`).emit('leaderboard:update', {
    leaderboard: (data || []).map((r, i) => ({
      rank: i + 1,
      ...r,
      percentage: r.max_score > 0 ? Math.round((r.score / r.max_score) * 100) : 0,
    })),
  });
}

/** Stop timer interval for a given attempt (called on submit) */
export function stopAttemptTimer(attemptId: string) {
  const room = `exam:${attemptId}`;
  const interval = timerIntervals.get(room);
  if (interval) {
    clearInterval(interval);
    timerIntervals.delete(room);
  }
}
