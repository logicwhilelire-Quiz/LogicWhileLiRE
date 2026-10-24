/**
 * socketService.ts
 * Phase 1d + Sprint 2: Synchronous Live Assessment Dispatch Engine
 *
 * Real-Time Telemetry & Inspector-Led Exam Flow:
 * - Inspector live command telemetry: queue count, joined/submitted counts, live ranks.
 * - Strict Rate Limiting: Batched and emitted at NO MORE THAN 1 UPDATE PER SECOND PER ROOM.
 * - Idempotent EXAM_STARTED broadcast: synchronous dispatch to all candidates in room.
 * - Reconnect sync for late joiners with server-authoritative clock.
 */

import { Server as HttpServer } from 'http';
import { Server as IOServer, Socket } from 'socket.io';
import { supabase } from '../db/supabase';
import { isStudentEligibleForExam } from '../utils/academicYear';
import { validateStudentEligibility } from '../controllers/examCodeController';

export let io: IOServer | null = null;

const timerIntervals = new Map<string, ReturnType<typeof setInterval>>();
const lobbyConnections = new Map<string, Set<string>>();
const leaderboardIntervals = new Map<string, ReturnType<typeof setInterval>>();

export interface LobbyStudent {
  socketId: string;
  examCode: string;
  hallTicket: string;
  studentName: string;
  section: string;
  joinedAt: number;
}
const socketStudents = new Map<string, LobbyStudent>();

export interface ExamStartedState {
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

// ─────────────────────────────────────────────
// ROOM UPDATE THROTTLER (Strict: <= 1 update / sec / room)
// ─────────────────────────────────────────────

interface ThrottlerState {
  lastEmitTime: number;
  scheduledTimeout: NodeJS.Timeout | null;
  isDirty: boolean;
  pulseInterval: NodeJS.Timeout | null;
}

const roomThrottlers = new Map<string, ThrottlerState>();

export function scheduleThrottledRoomUpdate(examCode: string): void {
  if (!examCode) return;
  const code = examCode.toUpperCase();
  let state = roomThrottlers.get(code);
  if (!state) {
    state = { lastEmitTime: 0, scheduledTimeout: null, isDirty: false, pulseInterval: null };
    roomThrottlers.set(code, state);
  }
  state.isDirty = true;

  const now = Date.now();
  const timeSinceLastEmit = now - state.lastEmitTime;

  if (timeSinceLastEmit >= 1000 && !state.scheduledTimeout) {
    state.lastEmitTime = now;
    state.isDirty = false;
    emitBatchRoomTelemetry(code).catch(() => {});
  } else if (!state.scheduledTimeout) {
    const delay = Math.max(50, 1000 - timeSinceLastEmit);
    state.scheduledTimeout = setTimeout(async () => {
      const curr = roomThrottlers.get(code);
      if (curr) {
        curr.scheduledTimeout = null;
        if (curr.isDirty) {
          curr.lastEmitTime = Date.now();
          curr.isDirty = false;
          await emitBatchRoomTelemetry(code).catch(() => {});
        }
      }
    }, delay);
  }
}

export function getWaitingStudents(examCode: string): LobbyStudent[] {
  const code = examCode.toUpperCase();
  const list: LobbyStudent[] = [];
  for (const s of socketStudents.values()) {
    if (s.examCode === code) {
      list.push(s);
    }
  }
  return list;
}

/**
 * Consolidates telemetry and emits at most once every 1000ms to rooms:
 * - lobby:{code}
 * - leaderboard:{code}
 * - monitor:{code}
 */
export async function emitBatchRoomTelemetry(examCode: string): Promise<void> {
  if (!io) return;
  const code = examCode.toUpperCase();

  // 1. Waiting students in lobby
  const waitingSockets = getWaitingStudents(code);
  const connectedCount = lobbyConnections.get(code)?.size ?? 0;

  // 2. Fetch attempts from DB
  const { data: attempts } = await supabase
    .from('exam_code_attempts')
    .select('hall_ticket_no, student_name, score, max_score, correct_count, time_taken_seconds, status, created_at')
    .eq('exam_code', code);

  const attemptList = attempts || [];
  const completedList = attemptList.filter(
    (a) => a.status === 'completed' || a.status === 'auto_submitted_expired' || a.status === 'submitted'
  );
  const terminatedCount = attemptList.filter(
    (a) => a.status === 'terminated_cheating' || a.status === 'terminated' || a.status === 'Terminated - violation'
  ).length;

  // 3. Compute live rankings
  const { data: examData } = await supabase
    .from('exam_codes')
    .select('duration_minutes, is_active')
    .eq('exam_code', code)
    .maybeSingle();

  const totalDurationSec = (examData?.duration_minutes ?? 60) * 60;

  const ranked = completedList
    .map((r) => ({
      ...r,
      percentage: (r.max_score || 0) > 0 ? Math.round(((r.score || 0) / r.max_score) * 100) : 0,
      rank_score: (r.score || 0) - ((r.time_taken_seconds || 0) / (totalDurationSec || 3600)),
    }))
    .sort((a, b) => b.rank_score - a.rank_score)
    .map((r, i) => ({
      rank: i + 1,
      student_id: r.hall_ticket_no,
      student_name: r.student_name,
      score: r.score ?? 0,
      percentage: r.percentage,
      answered: r.correct_count ?? 0,
      time_taken_seconds: r.time_taken_seconds ?? 0,
    }));

  const waitingFormatted = waitingSockets.map((s) => ({
    hall_ticket_no: s.hallTicket,
    student_name: s.studentName,
    section: s.section,
    joined_at: new Date(s.joinedAt).toISOString(),
    status: 'waiting',
  }));

  const payload = {
    event: 'ROOM_TELEMETRY',
    exam_code: code,
    queue_count: waitingSockets.length,
    joined_count: connectedCount,
    submitted_count: completedList.length,
    terminated_count: terminatedCount,
    total_enrolled: Math.max(attemptList.length, connectedCount),
    live_ranks: ranked.slice(0, 50),
    waiting_students: waitingFormatted,
    timestamp: Date.now(),
  };

  // Broadcast unified telemetry to all rooms
  io.to(`lobby:${code}`).emit('telemetry:update', payload);
  io.to(`leaderboard:${code}`).emit('telemetry:update', payload);
  io.to(`monitor:${code}`).emit('telemetry:update', payload);

  // Backwards compatibility for existing views
  io.to(`lobby:${code}`).emit('lobby:update', {
    participants: waitingFormatted,
    meta: {
      enrolled: payload.total_enrolled,
      connected: connectedCount,
      pending: Math.max(0, payload.total_enrolled - connectedCount),
      queue_count: waitingSockets.length,
      submitted_count: completedList.length,
      terminated_count: terminatedCount,
    },
  });

  const snapshot = {
    event: 'LEADERBOARD_SNAPSHOT',
    exam_id: code,
    top_ranks: ranked.slice(0, 50),
    total_active: completedList.length,
    timestamp: Date.now(),
  };
  io.to(`leaderboard:${code}`).emit('LEADERBOARD_SNAPSHOT', snapshot);
  io.to(`lobby:${code}`).emit('LEADERBOARD_SNAPSHOT', snapshot);
}

// ─────────────────────────────────────────────
// SOCKET.IO INITIALIZATION
// ─────────────────────────────────────────────

export function initSocketIO(httpServer: HttpServer): IOServer {
  const allowedOrigins = (process.env.CLIENT_ORIGIN || process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  io = new IOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const cleanOrigin = origin.replace(/\/+$/, '');
        let isAllowed = allowedOrigins.includes(cleanOrigin) || allowedOrigins.includes(origin);
        if (!isAllowed) {
          try {
            const url = new URL(cleanOrigin);
            if (
              url.hostname.endsWith('.pages.dev') ||
              url.hostname.endsWith('.netlify.app') ||
              url.hostname.endsWith('.logicwhilelire.com') ||
              url.hostname === 'logicwhilelire.com'
            ) {
              isAllowed = true;
            }
          } catch {}
        }
        if (isAllowed) {
          return callback(null, true);
        }
        callback(new Error('CORS: Socket origin not allowed'));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    // Exam timer room
    socket.on('exam:join', async ({ attemptId, examCode }: {
      attemptId: string;
      examCode: string;
      sessionToken?: string;
    }) => {
      if (!attemptId || !examCode) return;
      const code = examCode.toUpperCase();

      const { data: exam } = await supabase
        .from('exam_codes')
        .select('*')
        .eq('exam_code', code)
        .maybeSingle();

      if (!exam) {
        socket.emit('error', { status: 404, code: 'EXAM_NOT_FOUND', message: 'Exam not found or unavailable' });
        return;
      }

      const { data: att } = await supabase
        .from('exam_code_attempts')
        .select('hall_ticket_no')
        .eq('id', attemptId)
        .maybeSingle();

      const isEligible = await validateStudentEligibility(exam, att?.hall_ticket_no);
      if (!isEligible) {
        socket.emit('error', { status: 404, code: 'EXAM_NOT_FOUND', message: 'Exam not found or unavailable for your section' });
        return;
      }

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

    // Waiting lobby room
    socket.on('lobby:join', async (data: {
      examCode: string;
      hallTicket?: string;
      studentName?: string;
      section?: string;
    }) => {
      if (!data?.examCode) return;
      const code = data.examCode.toUpperCase();

      const { data: exam } = await supabase
        .from('exam_codes')
        .select('*')
        .eq('exam_code', code)
        .maybeSingle();

      if (!exam) {
        socket.emit('error', { status: 404, code: 'EXAM_NOT_FOUND', message: 'Exam not found or unavailable' });
        return;
      }

      const isEligible = await validateStudentEligibility(exam, data.hallTicket);
      if (!isEligible) {
        socket.emit('error', { status: 404, code: 'EXAM_NOT_FOUND', message: 'Exam not found or unavailable for your section' });
        return;
      }

      socket.join(`lobby:${code}`);

      if (!lobbyConnections.has(code)) lobbyConnections.set(code, new Set());
      lobbyConnections.get(code)!.add(socket.id);

      let resolvedName = data.studentName;
      let resolvedSection = data.section;
      if (data.hallTicket) {
        const { data: stu } = await supabase
          .from('students')
          .select('name, first_name, last_name, section')
          .or(`hall_ticket.eq.${data.hallTicket},roll_number.eq.${data.hallTicket}`)
          .maybeSingle();
        if (stu) {
          if (!resolvedName || resolvedName === data.hallTicket || resolvedName === 'Student Candidate') {
            resolvedName = stu.name || `${stu.first_name || ''} ${stu.last_name || ''}`.trim() || data.hallTicket;
          }
          if (!resolvedSection || resolvedSection === 'General') {
            resolvedSection = stu.section || 'A';
          }
        }
      }

      // Record student details for queue tracking
      const studentInfo: LobbyStudent = {
        socketId: socket.id,
        examCode: code,
        hallTicket: data.hallTicket || `HT-${socket.id.slice(0, 6).toUpperCase()}`,
        studentName: resolvedName || data.studentName || 'Student Candidate',
        section: resolvedSection || data.section || 'General',
        joinedAt: Date.now(),
      };
      socketStudents.set(socket.id, studentInfo);

      // Schedule throttled room update (max 1/sec)
      scheduleThrottledRoomUpdate(code);

      // RECONNECT SYNC:
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

    // Live monitor room for inspectors
    socket.on('monitor:join', async ({ examCode }: { examCode: string }) => {
      if (!examCode) return;
      const code = examCode.toUpperCase();
      socket.join(`monitor:${code}`);
      scheduleThrottledRoomUpdate(code);
    });

    // Leaderboard room
    socket.on('leaderboard:join', async ({ examCode }: { examCode: string }) => {
      if (!examCode) return;
      const code = examCode.toUpperCase();
      socket.join(`leaderboard:${code}`);
      scheduleThrottledRoomUpdate(code);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
      const student = socketStudents.get(socket.id);
      if (student) {
        socketStudents.delete(socket.id);
        const code = student.examCode;
        if (lobbyConnections.has(code)) {
          lobbyConnections.get(code)!.delete(socket.id);
        }
        scheduleThrottledRoomUpdate(code);
      } else {
        for (const [code, sockets] of lobbyConnections.entries()) {
          if (sockets.has(socket.id)) {
            sockets.delete(socket.id);
            scheduleThrottledRoomUpdate(code);
          }
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

export async function emitLobbyUpdate(examCode: string) {
  scheduleThrottledRoomUpdate(examCode);
}

export async function emitLeaderboardSnapshot(examCode: string) {
  scheduleThrottledRoomUpdate(examCode);
}

export async function emitLeaderboardUpdate(examCode: string) {
  scheduleThrottledRoomUpdate(examCode);
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

  // Start throttled 1-second pulse for ranks and monitor
  const throttler = roomThrottlers.get(code);
  if (throttler && !throttler.pulseInterval) {
    throttler.pulseInterval = setInterval(() => {
      scheduleThrottledRoomUpdate(code);
    }, 1000);
  }

  scheduleThrottledRoomUpdate(code);

  return { payload: state, alreadyStarted: false };
}

export function stopLeaderboardStream(examCode: string) {
  const code = examCode.toUpperCase();
  const throttler = roomThrottlers.get(code);
  if (throttler?.pulseInterval) {
    clearInterval(throttler.pulseInterval);
    throttler.pulseInterval = null;
  }
  const interval = leaderboardIntervals.get(code);
  if (interval) {
    clearInterval(interval);
    leaderboardIntervals.delete(code);
  }
}

export function getLobbyStats(examCode: string): { enrolled: number; connected: number; pending: number; queue_count: number } {
  const code = examCode.toUpperCase();
  const connected = lobbyConnections.get(code)?.size ?? 0;
  const waiting = getWaitingStudents(code).length;
  return { enrolled: connected, connected, pending: 0, queue_count: waiting };
}

export function stopAttemptTimer(attemptId: string) {
  const room = `exam:${attemptId}`;
  const interval = timerIntervals.get(room);
  if (interval) {
    clearInterval(interval);
    timerIntervals.delete(room);
  }
}

export function broadcastViolationToMonitor(examCode: string, payload: any): void {
  if (!io) return;
  const code = examCode.toUpperCase();
  io.to(`monitor:${code}`).emit('proctor:violation', payload);
  io.to(`monitor:${code}`).emit('violation:new', payload);
  scheduleThrottledRoomUpdate(code);
}
