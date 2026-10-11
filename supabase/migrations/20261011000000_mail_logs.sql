-- ==============================================================================
-- LOGICWHILELIRE — ROLE-BASED EMAIL LOGS (RESEND DISPATCH TRACKING)
-- Migration: 20261011000000_mail_logs.sql
-- Description: Audit and operational tracking for all outbound emails.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS mail_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email        TEXT NOT NULL,
  template        TEXT NOT NULL,
  subject         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed', 'resending')),
  resend_id       TEXT,
  error_message   TEXT,
  metadata        JSONB DEFAULT '{}'::jsonb,
  html_content    TEXT,
  sent_by         TEXT DEFAULT 'system',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mail_logs_to_email ON mail_logs(to_email);
CREATE INDEX IF NOT EXISTS idx_mail_logs_template ON mail_logs(template);
CREATE INDEX IF NOT EXISTS idx_mail_logs_status ON mail_logs(status);
CREATE INDEX IF NOT EXISTS idx_mail_logs_created_at ON mail_logs(created_at DESC);

-- Enable RLS
ALTER TABLE mail_logs ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'mail_logs' AND policyname = 'Service role full access on mail_logs'
  ) THEN
    CREATE POLICY "Service role full access on mail_logs"
      ON mail_logs
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Ensure must_change_password column exists on staff
ALTER TABLE staff ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;
