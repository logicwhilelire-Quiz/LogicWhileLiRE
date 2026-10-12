import {
  EmailPayload,
  sendWithRetry,
  sendWelcomeCredentialsEmail,
  sendEmailVerificationOtpEmail,
  sendPasswordResetEmail,
  sendExamScheduledEmail,
  sendExamStartedReminderEmail,
  sendResultPublishedEmail,
  sendContactAutoReplyEmail,
  sendContactAdminNotificationEmail,
  logDeliverableFailure,
} from './emailService';
import { recordTerminationAndNotify, TerminationEvent } from './terminationBatcher';
import { supabase } from '../db/supabase';

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
  };
  examId?: string;
  sessionId?: string;
  participantId?: string;
}

export interface QueueJob {
  id: string;
  type: string;
  payload?: any;
  handler: () => Promise<boolean | void>;
  attempts: number;
  maxAttempts: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class EmailQueue {
  private queue: QueueJob[] = [];
  private activeCount: number = 0;
  private concurrency: number = 3;
  private totalCompleted: number = 0;
  private totalFailed: number = 0;
  private drainListeners: Array<() => void> = [];

  constructor(concurrency: number = 3) {
    this.concurrency = concurrency;
  }

  /**
   * Enqueue a generic job asynchronously (never blocks caller requests)
   * Automatically persists to database table `email_queue`
   */
  public enqueue(
    type: string,
    handler: () => Promise<boolean | void>,
    payload?: any,
    maxAttempts: number = 3,
    existingJobId?: string
  ): { success: true; queued: true; jobId: string } {
    const jobId = existingJobId || `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const job: QueueJob = {
      id: jobId,
      type,
      payload,
      handler,
      attempts: 0,
      maxAttempts,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.queue.push(job);

    // Persist to database so server restarts don't lose mail
    Promise.resolve(
      supabase
        .from('email_queue')
        .upsert({
          id: jobId,
          type,
          payload: payload || {},
          attempts: 0,
          max_attempts: maxAttempts,
          status: 'pending',
          created_at: job.createdAt.toISOString(),
          updated_at: job.updatedAt.toISOString(),
        })
    )
      .then(() => {})
      .catch((err: any) => {
        console.warn(`[EmailQueue] DB persistence warning for job ${jobId}:`, err?.message || err);
      });

    setImmediate(() => this.processNext());

    return { success: true, queued: true, jobId };
  }

  /**
   * Recreates appropriate handler based on job type and payload
   */
  private createHandlerForType(type: string, payload: any): (() => Promise<boolean | void>) | null {
    if (!payload) return null;
    switch (type) {
      case 'welcome_credentials':
        return async () => { await sendWelcomeCredentialsEmail(payload); };
      case 'email_verification_otp':
        return async () => { await sendEmailVerificationOtpEmail(payload); };
      case 'password_reset':
        return async () => { await sendPasswordResetEmail(payload.toEmail, payload.recipientName, payload.resetLink); };
      case 'exam_scheduled':
        return async () => { await sendExamScheduledEmail(payload); };
      case 'exam_started_reminder':
        return async () => { await sendExamStartedReminderEmail(payload); };
      case 'result_published':
        return async () => { await sendResultPublishedEmail(payload); };
      case 'contact_auto_reply':
        return async () => { await sendContactAutoReplyEmail(payload); };
      case 'contact_admin_notification':
        return async () => { await sendContactAdminNotificationEmail(payload); };
      case 'termination_alert':
        return async () => { await recordTerminationAndNotify(payload); };
      default:
        if (payload.to && payload.subject) {
          return async () => {
            const success = await sendWithRetry(payload, 1);
            if (!success) throw new Error(`Failed to deliver ${payload.emailType || type} to ${payload.to}`);
          };
        }
        return null;
    }
  }

  /**
   * Resumes uncompleted email jobs from the database on boot
   */
  public async resumePendingJobs(): Promise<number> {
    try {
      const { data: pendingJobs, error } = await supabase
        .from('email_queue')
        .select('*')
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: true });

      if (error || !pendingJobs || pendingJobs.length === 0) {
        return 0;
      }

      let resumedCount = 0;
      for (const record of pendingJobs) {
        if (this.queue.some((j) => j.id === record.id)) continue;

        const handler = this.createHandlerForType(record.type, record.payload);
        if (handler) {
          this.queue.push({
            id: record.id,
            type: record.type,
            payload: record.payload,
            handler,
            attempts: record.attempts || 0,
            maxAttempts: record.max_attempts || 3,
            status: 'pending',
            createdAt: new Date(record.created_at || Date.now()),
            updatedAt: new Date(),
          });
          resumedCount++;
        }
      }

      if (resumedCount > 0) {
        console.log(`[EmailQueue] 📬 Resumed ${resumedCount} pending email job(s) from database`);
        setImmediate(() => this.processNext());
      }

      return resumedCount;
    } catch (err: any) {
      console.warn('[EmailQueue] Notice: Failed to resume pending jobs from DB:', err?.message || err);
      return 0;
    }
  }

  /**
   * Directly enqueue an EmailPayload to be sent via sendWithRetry
   */
  public enqueueEmail(
    payload: EmailPayload,
    maxAttempts: number = 3
  ): { success: true; queued: true; jobId: string } {
    return this.enqueue(
      payload.emailType,
      async () => {
        const success = await sendWithRetry(payload, 1);
        if (!success) {
          throw new Error(`Failed to deliver ${payload.emailType} to ${payload.to}`);
        }
      },
      payload,
      maxAttempts
    );
  }

  /**
   * Helper: Enqueue Welcome with Credentials
   */
  public enqueueWelcomeCredentials(options: {
    toEmail: string;
    recipientName: string;
    role: string;
    identifier: string;
    tempPassword: string;
    collegeName?: string;
    portalUrl?: string;
  }) {
    return this.enqueue(
      'welcome_credentials',
      async () => {
        await sendWelcomeCredentialsEmail(options);
      },
      options
    );
  }

  /**
   * Helper: Enqueue Email Verification / OTP
   */
  public enqueueEmailVerificationOtp(options: {
    toEmail: string;
    recipientName: string;
    otp: string;
    verifyLink?: string;
    expiresMinutes?: number;
  }) {
    return this.enqueue(
      'email_verification_otp',
      async () => {
        await sendEmailVerificationOtpEmail(options);
      },
      options
    );
  }

  /**
   * Helper: Enqueue Password Reset
   */
  public enqueuePasswordReset(options: {
    toEmail: string;
    recipientName: string;
    resetLink: string;
  }) {
    return this.enqueue(
      'password_reset',
      async () => {
        await sendPasswordResetEmail(options.toEmail, options.recipientName, options.resetLink);
      },
      options
    );
  }

  /**
   * Helper: Enqueue Exam Scheduled
   */
  public enqueueExamScheduled(options: {
    toEmail: string;
    recipientName: string;
    hallTicket: string;
    examCode: string;
    examTitle: string;
    durationMinutes: number;
    scheduledAt?: string;
    lobbyUrl?: string;
  }) {
    return this.enqueue(
      'exam_scheduled',
      async () => {
        await sendExamScheduledEmail(options);
      },
      options
    );
  }

  /**
   * Helper: Enqueue Exam Started Reminder
   */
  public enqueueExamStartedReminder(options: {
    toEmail: string;
    recipientName: string;
    hallTicket: string;
    examCode: string;
    examTitle: string;
    roomUrl?: string;
  }) {
    return this.enqueue(
      'exam_started_reminder',
      async () => {
        await sendExamStartedReminderEmail(options);
      },
      options
    );
  }

  /**
   * Helper: Enqueue Result Published
   */
  public enqueueResultPublished(options: {
    toEmail: string;
    recipientName: string;
    hallTicket: string;
    examTitle: string;
    examCode: string;
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
    };
    resultsUrl?: string;
  }) {
    return this.enqueue(
      'result_published',
      async () => {
        await sendResultPublishedEmail(options);
      },
      options
    );
  }

  /**
   * Helper: Enqueue Contact Auto Reply
   */
  public enqueueContactAutoReply(options: {
    toEmail: string;
    senderName: string;
    referenceId: string;
    subject: string;
    message: string;
  }) {
    return this.enqueue(
      'contact_auto_reply',
      async () => {
        await sendContactAutoReplyEmail(options);
      },
      options
    );
  }

  /**
   * Helper: Enqueue Contact Admin Notification
   */
  public enqueueContactAdminNotification(options: {
    senderName: string;
    senderEmail: string;
    referenceId: string;
    subject: string;
    message: string;
    institution?: string;
    candidateCount?: string;
    timestamp?: string;
  }) {
    return this.enqueue(
      'contact_admin_notification',
      async () => {
        await sendContactAdminNotificationEmail(options);
      },
      options
    );
  }

  /**
   * Backwards-compatible methods
   */
  public enqueueResultEmail(job: ResultEmailJob): void {
    this.enqueueResultPublished({
      toEmail: job.toEmail,
      recipientName: job.recipientName,
      hallTicket: job.hallTicket,
      examTitle: job.examTitle,
      examCode: job.examId || 'EXAM',
      result: job.result,
    });
  }

  public enqueueTerminationAlert(event: TerminationEvent): void {
    this.enqueue(
      'termination_alert',
      async () => {
        await recordTerminationAndNotify(event);
      },
      event
    );
  }

  /**
   * Background processor loop with retry & backoff
   */
  private async processNext(): Promise<void> {
    if (this.activeCount >= this.concurrency || this.queue.length === 0) {
      if (this.activeCount === 0 && this.queue.length === 0) {
        this.notifyDrain();
      }
      return;
    }

    const jobIndex = this.queue.findIndex((j) => j.status === 'pending');
    if (jobIndex === -1) return;

    const job = this.queue[jobIndex];
    job.status = 'processing';
    job.updatedAt = new Date();
    this.activeCount++;

    Promise.resolve(
      supabase
        .from('email_queue')
        .update({ status: 'processing', updated_at: job.updatedAt.toISOString() })
        .eq('id', job.id)
    )
      .then(() => {})
      .catch(() => {});

    (async () => {
      try {
        await job.handler();
        job.status = 'completed';
        this.totalCompleted++;
        // Remove completed job from in-memory queue
        this.queue = this.queue.filter((j) => j.id !== job.id);

        Promise.resolve(
          supabase
            .from('email_queue')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', job.id)
        )
          .then(() => {})
          .catch(() => {});
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        job.attempts++;
        job.error = errMsg;
        job.updatedAt = new Date();

        console.warn(`[EmailQueue] Job ${job.id} (${job.type}) failed attempt ${job.attempts}/${job.maxAttempts}: ${errMsg}`);

        if (job.attempts < job.maxAttempts) {
          // Exponential backoff: 2s, 6s
          const delayMs = Math.pow(2, job.attempts) * 1000;
          job.status = 'pending';

          Promise.resolve(
            supabase
              .from('email_queue')
              .update({
                status: 'pending',
                attempts: job.attempts,
                error: errMsg,
                updated_at: job.updatedAt.toISOString(),
              })
              .eq('id', job.id)
          )
            .then(() => {})
            .catch(() => {});

          setTimeout(() => {
            setImmediate(() => this.processNext());
          }, delayMs);
        } else {
          job.status = 'failed';
          this.totalFailed++;
          this.queue = this.queue.filter((j) => j.id !== job.id);

          Promise.resolve(
            supabase
              .from('email_queue')
              .update({
                status: 'failed',
                attempts: job.attempts,
                error: errMsg,
                updated_at: job.updatedAt.toISOString(),
              })
              .eq('id', job.id)
          )
            .then(() => {})
            .catch(() => {});

          if (job.payload) {
            await logDeliverableFailure(job.payload, errMsg, job.attempts);
          }
          console.error(`[EmailQueue] Job ${job.id} (${job.type}) permanently failed after ${job.attempts} attempts.`);
        }
      } finally {
        this.activeCount--;
        setImmediate(() => this.processNext());
      }
    })();
  }

  private notifyDrain(): void {
    while (this.drainListeners.length > 0) {
      const listener = this.drainListeners.shift();
      if (listener) listener();
    }
  }

  /**
   * Wait for all jobs currently queued or running to settle
   */
  public async drain(timeoutMs: number = 10000): Promise<void> {
    if (this.activeCount === 0 && this.queue.length === 0) {
      return;
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        resolve();
      }, timeoutMs);

      this.drainListeners.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  public getStats(): {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    totalActiveQueue: number;
  } {
    const pending = this.queue.filter((j) => j.status === 'pending').length;
    const processing = this.queue.filter((j) => j.status === 'processing').length;
    return {
      pending,
      processing,
      completed: this.totalCompleted,
      failed: this.totalFailed,
      totalActiveQueue: this.queue.length,
    };
  }
}

export const emailQueue = new EmailQueue(3);
