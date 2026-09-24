import {
  sendTerminationAlertEmail,
  sendBatchTerminationSummaryEmail,
} from './emailService';

export interface TerminationEvent {
  sessionId: string;
  participantId: string;
  participantName: string;
  hallTicket: string;
  examId: string;
  examTitle: string;
  adminEmail: string;
  reason: string;
  violationCount: number;
  ipAddress?: string;
  violations: Array<{ type: string; timestamp: string; notes?: string }>;
  timestamp: Date;
}

interface ExamBatchState {
  windowStartTime: number;
  events: TerminationEvent[];
  timer: NodeJS.Timeout | null;
}

const examBatchMap = new Map<string, ExamBatchState>();
const WINDOW_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const BATCH_THRESHOLD = 3; // more than 3 terminations in 5 min triggers batching

/**
 * Handle a termination event:
 * - If <= 3 terminations in 5 minutes: send individual notification immediately.
 * - If > 3 terminations in 5 minutes: debounce to one summary email for the 5-minute window.
 */
export async function recordTerminationAndNotify(event: TerminationEvent): Promise<void> {
  const { examId, adminEmail, examTitle } = event;
  const now = Date.now();

  let state = examBatchMap.get(examId);

  // If no state or window has expired, reset window
  if (!state || now - state.windowStartTime > WINDOW_DURATION_MS) {
    if (state?.timer) {
      clearTimeout(state.timer);
    }
    state = {
      windowStartTime: now,
      events: [],
      timer: null,
    };
    examBatchMap.set(examId, state);
  }

  // Filter events within last 5 minutes
  state.events = state.events.filter((e) => now - e.timestamp.getTime() <= WINDOW_DURATION_MS);
  state.events.push(event);

  const count = state.events.length;

  if (count <= BATCH_THRESHOLD) {
    // Under or at threshold: Send individual alert immediately
    try {
      await sendTerminationAlertEmail(
        adminEmail,
        event.participantName,
        event.hallTicket,
        examTitle,
        event.reason,
        event.violationCount,
        event.violations,
        event.ipAddress,
        examId,
        event.sessionId,
        event.participantId
      );
    } catch (err) {
      console.error('[TerminationBatcher] Failed to send individual termination alert:', err);
    }
  } else {
    // Exceeded threshold (> 3 terminations in 5 min):
    // Enter batch mode if timer not already running
    if (!state.timer) {
      const remainingTime = Math.max(1000, WINDOW_DURATION_MS - (now - state.windowStartTime));
      console.log(
        `[TerminationBatcher] High termination frequency (${count} in window) for exam "${examTitle}". Scheduling 5-minute summary batch in ${Math.round(remainingTime / 1000)}s.`
      );

      state.timer = setTimeout(async () => {
        await flushBatch(examId);
      }, remainingTime);
    }
  }
}

/**
 * Flush accumulated terminations and dispatch summary email
 */
export async function flushBatch(examId: string): Promise<void> {
  const state = examBatchMap.get(examId);
  if (!state || state.events.length === 0) return;

  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }

  // Only send summary if there are events and it exceeded threshold
  const batchedEvents = [...state.events];
  // Reset events list
  state.events = [];
  examBatchMap.delete(examId);

  if (batchedEvents.length > BATCH_THRESHOLD) {
    const first = batchedEvents[0];
    try {
      await sendBatchTerminationSummaryEmail(
        first.adminEmail,
        first.examTitle,
        batchedEvents.map((e) => ({
          participantName: e.participantName,
          hallTicket: e.hallTicket,
          reason: e.reason,
          violationCount: e.violationCount,
          timestamp: e.timestamp,
          violationsCount: e.violations.length,
        })),
        examId
      );
      console.log(`[TerminationBatcher] Dispatched batch summary for ${batchedEvents.length} terminations in exam "${first.examTitle}".`);
    } catch (err) {
      console.error('[TerminationBatcher] Failed to dispatch batch termination summary:', err);
    }
  }
}

/**
 * Export for automated tests
 */
export function getExamBatchCount(examId: string): number {
  return examBatchMap.get(examId)?.events.length || 0;
}
