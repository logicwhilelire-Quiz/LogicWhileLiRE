/**
 * POST /api/webhooks/resend
 *
 * Receives delivery-status events from Resend (delivered, bounced, failed, etc.)
 * Verifies the SVIX-Signature header using RESEND_WEBHOOK_SECRET from env, then
 * updates the corresponding mail_logs row.
 *
 * Docs: https://resend.com/docs/dashboard/webhooks/introduction
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { supabase } from '../db/supabase';
import { memoryMailLogs } from '../services/mailService';

const router = Router();

// ── Signature verification ─────────────────────────────────────────────────
function verifyResendSignature(
  rawBody: Buffer,
  headers: Record<string, string | string[] | undefined>
): boolean {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    // No secret configured — reject all webhooks in production
    if (process.env.NODE_ENV === 'production') {
      console.warn('[ResendWebhook] RESEND_WEBHOOK_SECRET not set; rejecting webhook in production.');
      return false;
    }
    // Dev/test: allow without verification
    console.warn('[ResendWebhook] RESEND_WEBHOOK_SECRET not set; accepting webhook in non-production.');
    return true;
  }

  // Resend uses the Svix webhook standard: three headers to validate
  const msgId        = String(headers['svix-id']        || '');
  const msgTimestamp = String(headers['svix-timestamp'] || '');
  const msgSignature = String(headers['svix-signature'] || '');

  if (!msgId || !msgTimestamp || !msgSignature) {
    console.warn('[ResendWebhook] Missing Svix headers.');
    return false;
  }

  // Replay protection: reject timestamps older than 5 minutes
  const tsSeconds = parseInt(msgTimestamp, 10);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - tsSeconds) > 300) {
    console.warn('[ResendWebhook] Timestamp outside 5-minute tolerance window.');
    return false;
  }

  // The signed content is: "<msgId>.<msgTimestamp>.<rawBody>"
  const toSign = `${msgId}.${msgTimestamp}.${rawBody.toString('utf8')}`;

  // Secret may be prefixed with "whsec_"; strip it for base64 decode
  const secretBase64 = webhookSecret.startsWith('whsec_')
    ? webhookSecret.slice('whsec_'.length)
    : webhookSecret;

  const secretBytes = Buffer.from(secretBase64, 'base64');
  const computedHmac = crypto
    .createHmac('sha256', secretBytes)
    .update(toSign)
    .digest('base64');

  // msgSignature can be a space-separated list of "v1,<base64>" tokens
  const signatures = msgSignature.split(' ');
  for (const sig of signatures) {
    const parts = sig.split(',');
    if (parts.length === 2 && parts[0] === 'v1') {
      if (crypto.timingSafeEqual(Buffer.from(computedHmac), Buffer.from(parts[1]))) {
        return true;
      }
    }
  }

  console.warn('[ResendWebhook] Signature mismatch.');
  return false;
}

// ── Event → mail_logs status map ──────────────────────────────────────────
const EVENT_STATUS_MAP: Record<string, string> = {
  'email.delivered':     'delivered',
  'email.bounced':       'failed',
  'email.complained':    'failed',
  'email.delivery_delayed': 'sent',  // still in transit
  'email.opened':        'delivered',
  'email.clicked':       'delivered',
  'email.failed':        'failed',
};

// ── Webhook handler ────────────────────────────────────────────────────────

// IMPORTANT: This route MUST receive the raw body for HMAC verification.
// Register it BEFORE express.json() in index.ts, or use express.raw() here.
router.post(
  '/',
  express_rawBody,
  async (req: Request & { rawBody?: Buffer }, res: Response) => {
    const rawBody: Buffer = req.rawBody || Buffer.from(JSON.stringify(req.body));

    // Verify signature
    if (!verifyResendSignature(rawBody, req.headers as Record<string, string | undefined>)) {
      res.status(401).json({ error: 'Invalid webhook signature' });
      return;
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }

    const eventType: string = payload?.type || '';
    const resendEmailId: string = payload?.data?.email_id || payload?.data?.id || '';
    const newStatus = EVENT_STATUS_MAP[eventType];

    console.log(`[ResendWebhook] Event: ${eventType} | Resend ID: ${resendEmailId} | Status: ${newStatus || 'unknown'}`);

    if (!newStatus || !resendEmailId) {
      // Unrecognized event type — acknowledge but take no action
      res.status(200).json({ received: true, action: 'ignored', event: eventType });
      return;
    }

    const updatedAt = new Date().toISOString();

    // 1. Update Supabase mail_logs (non-blocking)
    let dbUpdated = false;
    try {
      const { error } = await supabase
        .from('mail_logs')
        .update({ status: newStatus, updated_at: updatedAt })
        .eq('resend_id', resendEmailId);
      if (!error) dbUpdated = true;
    } catch (err: any) {
      console.warn(`[ResendWebhook] DB update warning: ${err?.message}`);
    }

    // 2. Update in-memory buffer
    const memEntry = memoryMailLogs.find((l) => l.resend_id === resendEmailId);
    if (memEntry) {
      memEntry.status = newStatus as any;
      memEntry.updated_at = updatedAt;
    }

    res.status(200).json({
      received: true,
      event: eventType,
      resend_id: resendEmailId,
      new_status: newStatus,
      db_updated: dbUpdated,
    });
  }
);

// ── Inline raw-body middleware (avoids registering globally) ───────────────
import { NextFunction } from 'express';
function express_rawBody(req: Request & { rawBody?: Buffer }, _res: Response, next: NextFunction) {
  if (req.rawBody) { next(); return; }
  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    req.rawBody = Buffer.concat(chunks);
    next();
  });
  req.on('error', next);
}

export default router;
