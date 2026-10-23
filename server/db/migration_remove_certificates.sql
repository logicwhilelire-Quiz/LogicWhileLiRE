-- ==============================================================================
-- LOGICWHILELIRE MIGRATION: RETIRE CERTIFICATES (Phase C Spec)
-- ==============================================================================
--
-- ⚠️ WARNING / DATA LOSS IMPACT:
-- Executing this script will DROP the 'certificates' table and all associated
-- certificate issuance records, public verification metadata, and RLS policies.
-- 
-- DATA LOST UPON EXECUTION:
-- 1. All rows in 'certificates' table (candidate_id, qr_token, pdf_url, issued_at).
-- 2. Foreign key references, RLS policies ("certificates admin service role",
--    "student read verified certificates").
--
-- DO NOT EXECUTE ON PRODUCTION WITHOUT PRIOR EXPLICIT OWNER APPROVAL.
--
-- ==============================================================================

BEGIN;

-- 1. Remove RLS Policies
DROP POLICY IF EXISTS "certificates admin service role" ON certificates;
DROP POLICY IF EXISTS "student read verified certificates" ON certificates;
DROP POLICY IF EXISTS "Anyone can verify certificates by token" ON certificates;
DROP POLICY IF EXISTS "Service can insert certificates" ON certificates;

-- 2. Drop Indexes
DROP INDEX IF EXISTS idx_certificates_exam;
DROP INDEX IF EXISTS idx_certificates_candidate;
DROP INDEX IF EXISTS idx_certificates_qr_token;

-- 3. Drop Table
DROP TABLE IF EXISTS certificates CASCADE;

COMMIT;

-- ==============================================================================
-- ROLLBACK SCRIPT (In case certificate issuance is ever reinstated)
-- ==============================================================================
/*
BEGIN;

CREATE TABLE IF NOT EXISTS certificates (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id          TEXT,
  hall_ticket           TEXT,
  exam_id               TEXT,
  score                 NUMERIC(5,2),
  percentage            NUMERIC(5,2),
  qr_token              TEXT UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  template_name         TEXT DEFAULT 'aerospace_standard',
  criteria_pass_pct     NUMERIC DEFAULT 40,
  is_revoked            BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_reason        TEXT,
  pdf_url               TEXT,
  created_by_admin      UUID REFERENCES staff(id) ON DELETE SET NULL,
  updated_by_admin      UUID REFERENCES staff(id) ON DELETE SET NULL,
  issued_at             TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "certificates admin service role" ON certificates FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "student read verified certificates" ON certificates FOR SELECT TO anon, authenticated USING (is_revoked = false);

CREATE INDEX IF NOT EXISTS idx_certificates_exam ON certificates(exam_id);
CREATE INDEX IF NOT EXISTS idx_certificates_candidate ON certificates(candidate_id);
CREATE INDEX IF NOT EXISTS idx_certificates_qr_token ON certificates(qr_token);

COMMIT;
*/
