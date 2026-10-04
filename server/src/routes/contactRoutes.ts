import { Router, Request, Response } from 'express';
import { emailQueue } from '../services/emailQueue';
import { dailyEmailQuota } from '../services/emailService';
import { contactRateLimit } from '../middleware/rateLimiter';

const router = Router();

/**
 * POST /api/contact
 * Handles contact form submissions, dispatches non-blocking auto-reply to candidate and admin notification
 */
router.post('/', contactRateLimit, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, subject, message, institution, candidateCount } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ success: false, error: 'Full name is required' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
      res.status(400).json({ success: false, error: 'A valid email address is required' });
      return;
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({ success: false, error: 'Message content is required' });
      return;
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const finalSubject = (subject && typeof subject === 'string' && subject.trim().length > 0)
      ? subject.trim()
      : 'General Inquiry / Pilot Program';
    const trimmedMessage = message.trim();
    const trimmedInstitution = institution && typeof institution === 'string' ? institution.trim() : undefined;
    const trimmedCandidateCount = candidateCount && typeof candidateCount === 'string' ? candidateCount.trim() : undefined;

    const referenceId = `REF-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    // 1. Asynchronously enqueue auto-reply to the user (non-blocking)
    emailQueue.enqueueContactAutoReply({
      toEmail: trimmedEmail,
      senderName: trimmedName,
      referenceId,
      subject: finalSubject,
      message: trimmedMessage,
    });

    // 2. Asynchronously enqueue admin alert notification (non-blocking)
    emailQueue.enqueueContactAdminNotification({
      senderName: trimmedName,
      senderEmail: trimmedEmail,
      referenceId,
      subject: finalSubject,
      message: trimmedMessage,
      institution: trimmedInstitution,
      candidateCount: trimmedCandidateCount,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: 'Your inquiry has been received. Our team will contact you shortly.',
      reference_id: referenceId,
      email: trimmedEmail,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to process contact form';
    res.status(500).json({ success: false, error: errorMsg });
  }
});

/**
 * GET /api/contact/mail-stats
 * Real-time email telemetry (Daily quota stats & queue stats)
 */
router.get('/mail-stats', (_req: Request, res: Response) => {
  const quota = dailyEmailQuota.getStats();
  const queue = emailQueue.getStats();
  res.json({
    success: true,
    quota,
    queue,
    timestamp: new Date().toISOString(),
  });
});

export default router;
