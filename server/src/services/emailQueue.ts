import { sendResultEmail } from './emailService';
import { recordTerminationAndNotify, TerminationEvent } from './terminationBatcher';

export interface ResultEmailJob {
  toEmail: string;
  recipientName: string;
  hallTicket: string;
  examTitle: string;
  result: {
    totalScore: number;
    maxScore: number;
    normalizedScore?: number;
    correctCount: number;
    wrongCount: number;
    timeTakenSeconds: number;
    rank?: number | null;
    totalParticipants?: number;
    isLeaderboardPublic?: boolean;
    topicBreakdown?: Record<string, { correct: number; wrong: number; score: number; maxScore: number }>;
    hasCodingQuestions?: boolean;
    mcqScore?: number;
    mcqMaxScore?: number;
  };
  examId?: string;
  sessionId?: string;
  participantId?: string;
}

type QueueTask =
  | { type: 'result_email'; data: ResultEmailJob }
  | { type: 'termination_alert'; data: TerminationEvent };

class EmailQueue {
  private queue: QueueTask[] = [];
  private processing: boolean = false;
  private totalProcessed: number = 0;
  private totalErrors: number = 0;

  /**
   * Enqueue a result email job asynchronously (non-blocking)
   */
  public enqueueResultEmail(job: ResultEmailJob): void {
    this.queue.push({ type: 'result_email', data: job });
    setImmediate(() => this.processNext());
  }

  /**
   * Enqueue a termination alert job asynchronously (non-blocking)
   */
  public enqueueTerminationAlert(event: TerminationEvent): void {
    this.queue.push({ type: 'termination_alert', data: event });
    setImmediate(() => this.processNext());
  }

  /**
   * Background processor loop
   */
  private async processNext(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const task = this.queue.shift();

    if (task) {
      try {
        if (task.type === 'result_email') {
          await sendResultEmail(
            task.data.toEmail,
            task.data.recipientName,
            task.data.hallTicket,
            task.data.examTitle,
            task.data.result,
            task.data.examId,
            task.data.sessionId,
            task.data.participantId
          );
        } else if (task.type === 'termination_alert') {
          await recordTerminationAndNotify(task.data);
        }
        this.totalProcessed++;
      } catch (err) {
        this.totalErrors++;
        console.error(`[EmailQueue] Failed processing task (${task.type}):`, err);
      }
    }

    this.processing = false;

    // Process remaining jobs
    if (this.queue.length > 0) {
      setImmediate(() => this.processNext());
    }
  }

  public getStats(): { pending: number; processed: number; errors: number } {
    return {
      pending: this.queue.length,
      processed: this.totalProcessed,
      errors: this.totalErrors,
    };
  }
}

export const emailQueue = new EmailQueue();
