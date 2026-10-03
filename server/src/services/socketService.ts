/**
 * socketService.ts
 * Phase 1d + Sprint 2: Synchronous Live Assessment Dispatch Engine
 *
 * EXAM_STARTED broadcast (Sprint 2):
 * - Idempotent: a second call returns the existing payload without re-broadcasting.
 * - Reconnect sync: if a student connects AFTER EXAM_STARTED was fired,
 *   lobby:join emits EXAM_STARTED to that socket alone with correct elapsed data.
 * - Server-authoritative: the REST endpoint writes
 *     end_time = server_start_time + duration_seconds
 *   to DB so computeRemainingSeconds() gives correct time for all clients,
 *   including late joiners.
 *
 * EXAM_STARTED schema (PRD §5):
 *   { event, exam_id, server_start_time, duration_seconds, allow_late_join }
 */

import { Server as HttpServer } from 'http';
import { Server as IOServer, Socket } from 'socket.io';
import { supabase } from '../db/supabase';

export let io: IOServer | null = null;

const timerIntervals = new Map<string, ReturnType<typeof setInterval>>();
const lobbyConnections = new Map<string, Set<string>>();
const leaderboardIntervals = new Map<string, ReturnType<typeof setInterval>>();

interface ExamStartedState {
  exam_id: string;
  server_start_time: number;
  duration_seconds: number;
  allow_late_join: boolean;
}
// Idempotency + reconnect-sync store
const examStartedState = new Map<string, ExamStartedState>();

export function getExamStartedState(examCode: string): ExamStartedState | undefined {
  return examStartedState.get(examCode.toUpperCase());
}

export function resetExamStartedState(examCode?: string): void {
  if (examCode) {
    examStartedState.delete(examCode.toUpperCase());
  } else {
    examStartedState.clear();
  }
}

export function initSocketIO(httpServer: HttpServer): IOServer {
  const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  io = new IOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error('CORS: Socket origin not allowed'));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });


  io.on('connection', (socket: Socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    // Exam timer
    socket.on('exam:join', async ({ attemptId, examCode }: {
      attemptId: string;
      examCode: string;
      sessionToken?: string;
    }) => {
      if (!attemptId || !examCode) return;
      const room = `exam:${attemptId}`;
      socket.join(room);
      await sendTimerTick(socket, examCode);
      if (!timerIntervals.has(room)) {
        const interval = setInterval(async () => {
          if (!io) return;
          await sendTimerTickToRoom(room, examCode);
        }, 1000);
        timerIntervals.set(room, interval);
      }
    });

    // Waiting lobby
    socket.on('lobby:join', async ({ examCode }: { examCode: string }) => {
      if (!examCode) return;
      const code = examCode.toUpperCase();
      socket.join(`lobby:${code}`);

      if (!lobbyConnections.has(code)) lobbyConnections.set(code, new Set());
      lobbyConnections.get(code)!.add(socket.id);

      await emitLobbyUpdate(code);

      // RECONNECT SYNC (Sprint 2, item 5):
      // If EXAM_STARTED already fired, immediately push it to this socket
      // with correct elapsed time so late joiners / reconnectors catch up.
      const startedState = examStartedState.get(code);
      if (startedState) {
        const elapsed = Math.floor((Date.now() - startedState.server_start_time) / 1000);
        const remainingSeconds = Math.max(0, startedState.duration_seconds - elapsed);
        if (startedState.allow_late_join || remainingSeconds > 0) {
          console.log(
            `[Socket.io] Reconnect-sync EXAM_STARTED -> ${socket.id} ` +
            `(${code}, elapsed=${elapsed}s, remaining=${remainingSeconds}s)`
          );
          socket.emit('EXAM_STARTED', {
            event: 'EXAM_STARTED',
            exam_id: startedState.exam_id,
            server_start_time: startedState.server_start_time,
            duration_seconds: startedState.duration_seconds,
            allow_late_join: startedState.allow_late_join,
            elapsed_seconds: elapsed,
          });
        }
      }
    });

    // Leaderboard
    socket.on('leaderboard:join', async ({ examCode }: { examCode: string }) => {
      if (!examCode) return;
      const code = examCode.toUpperCase();
      socket.join(`leaderboard:${code}`);
      await emitLeaderboardSnapshot(code);
      if (!leaderboardIntervals.has(code)) {
        const interval = setInterval(async () => {
          await emitLeaderboardSnapshot(code);
        }, 1000);
        leaderboardIntervals.set(code, interval);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
      for (const [code, sockets] of lobbyConnections.entries()) {
        if (sockets.has(socket.id)) {
          sockets.delete(socket.id);
          emitLobbyUpdate(code).catch(() => {});
        }
      }
    });
  });

  return io;
}

// Timer helpers

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

async function sendTimerTick(socket: Socket, examCode: string) {
  const { remaining, status } = await computeRemainingSeconds(examCode);
  socket.emit('timer:tick', { remaining_seconds: remaining, status });
  if (remaining === 0) {
    socket.emit('exam:auto-submit', { reason: 'time_expired' });
  }
}

async function sendTimerTickToRoom(room: string, examCode: string) {
  if (!io) return;
  const { remaining, status } = await computeRemainingSeconds(examCode);
  io.to(room).emit('timer:tick', { remaining_seconds: remaining, status });
  if (remaining === 0) {
    io.to(room).emit('exam:auto-submit', { reason: 'time_expired' });
    const interval = timerIntervals.get(room);
    if (interval) {
      clearInterval(interval);
      timerIntervals.delete(room);
    }
  }
}

// Lobby / leaderboard emitters

export async function emitLobbyUpdate(examCode: string) {
  if (!io) return;
  const code = examCode.toUpperCase();
  const { data } = await supabase
    .from('exam_code_attempts')
    .select('hall_ticket_no, student_name, status, created_at')
    .eq('exam_code', code)
    .order('created_at', { ascending: false });

  const connectedSockets = lobbyConnections.get(code)?.size ?? 0;
  const enrolled = data?.length ?? 0;
  const pending = Math.max(0, enrolled - connectedSockets);

  io.to(`lobby:${code}`).emit('lobby:update', {
    participants: data || [],
    meta: { enrolled, connected: connectedSockets, pending },
  });
}

export async function emitLeaderboardSnapshot(examCode: string) {
  if (!io) return;
  const code = examCode.toUpperCase();

  const { data: examData } = await supabase
    .from('exam_codes')
    .select('duration_minutes, is_active')
    .eq('exam_code', code)
    .maybeSingle();

  const totalDurationSec = (examData?.duration_minutes ?? 60) * 60;

  const { data } = await supabase
    .from('exam_code_attempts')
    .select('hall_ticket_no, student_name, score, max_score, correct_count, time_taken_seconds, status')
    .eq('exam_code', code)
    .in('status', ['completed', 'terminated_cheating']);

  const ranked = (data || [])
    .map((r) => ({
      ...r,
      percentage: r.max_score > 0 ? Math.round((r.score / r.max_score) * 100) : 0,
      rank_score: r.score - (r.time_taken_seconds / totalDurationSec),
    }))
    .sort((a, b) => b.rank_score - a.rank_score)
    .map((r, i) => ({
      rank: i + 1,
      student_id: r.hall_ticket_no,
      student_name: r.student_name,
      score: r.score,
      percentage: r.percentage,
      answered: r.correct_count,
      time_taken_seconds: r.time_taken_seconds,
    }));

  const snapshot = {
    event: 'LEADERBOARD_SNAPSHOT',
    exam_id: code,
    top_ranks: ranked.slice(0, 50),
    total_active: data?.length ?? 0,
    timestamp: Date.now(),
  };

  io.to(`leaderboard:${code}`).emit('LEADERBOARD_SNAPSHOT', snapshot);
  io.to(`lobby:${code}`).emit('LEADERBOARD_SNAPSHOT', snapshot);
}

export async function emitLeaderboardUpdate(examCode: string) {
  return emitLeaderboardSnapshot(examCode);
}

/**
 * Broadcast EXAM_STARTED to all sockets in lobby:{examCode}.
 * IDEMPOTENT: second call returns existing payload, does NOT re-broadcast.
 */
export async function broadcastExamStarted(params: {
  examCode: string;
  durationSeconds: number;
  allowLateJoin?: boolean;
  serverStartTime?: number;
}): Promise<{ payload: ExamStartedState; alreadyStarted: boolean }> {
  const code = params.examCode.toUpperCase();

  // Idempotency: return existing state without re-broadcasting
  const existing = examStartedState.get(code);
  if (existing) {
    console.log(`[Socket.io] EXAM_STARTED idempotency hit for ${code}`);
    return { payload: existing, alreadyStarted: true };
  }

  const serverStartTime = params.serverStartTime ?? Date.now();
  const state: ExamStartedState = {
    exam_id: code,
    server_start_time: serverStartTime,
    duration_seconds: params.durationSeconds,
    allow_late_join: params.allowLateJoin ?? false,
  };

  // Store before emitting so reconnectors immediately see it
  examStartedState.set(code, state);

  if (io) {
    const payload = { event: 'EXAM_STARTED', ...state };
    console.log(`[Socket.io] Broadcasting EXAM_STARTED to lobby:${code}`, payload);
    io.to(`lobby:${code}`).emit('EXAM_STARTED', payload);
  }

  // Start per-second leaderboard stream
  if (io && !leaderboardIntervals.has(code)) {
    const interval = setInterval(async () => {
      await emitLeaderboardSnapshot(code);
    }, 1000);
    leaderboardIntervals.set(code, interval);
  }

  return { payload: state, alreadyStarted: false };
}

export function stopLeaderboardStream(examCode: string) {
  const code = examCode.toUpperCase();
  const interval = leaderboardIntervals.get(code);
  if (interval) {
    clearInterval(interval);
    leaderboardIntervals.delete(code);
  }
}

export function getLobbyStats(examCode: string): { enrolled: number; connected: number; pending: number } {
  const code = examCode.toUpperCase();
  const connected = lobbyConnections.get(code)?.size ?? 0;
  return { enrolled: connected, connected, pending: 0 };
}

export function stopAttemptTimer(attemptId: string) {
  const room = `exam:${attemptId}`;
  const interval = timerIntervals.get(room);
  if (interval) {
    clearInterval(interval);
    timerIntervals.delete(room);
  }
}
