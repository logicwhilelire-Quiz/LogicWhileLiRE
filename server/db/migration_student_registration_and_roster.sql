-- ============================================================
-- MIGRATION: Student Registration, Approved Roster & Session Security
-- LogicWhileLiRE Assessment Platform
-- ============================================================

-- 1. Ensure students table has registration verification, session tracking, and hierarchy columns
ALTER TABLE students ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS verification_otp TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS verification_token TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMPTZ;
ALTER TABLE students ADD COLUMN IF NOT EXISTS active_session_id TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS cohort_id TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS section_id TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS batch_id TEXT;

-- Composite unique constraint (college_id, roll_number) if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_college_roll'
  ) THEN
    ALTER TABLE students ADD CONSTRAINT uq_college_roll UNIQUE (college_id, roll_number);
  END IF;
END $$;

-- 2. Approved Student Roster Table
-- Admin/Principal imports approved rolls by CSV/Excel or Google Sheet export
CREATE TABLE IF NOT EXISTS student_roster (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id          TEXT NOT NULL,
  academic_year_id    TEXT,
  cohort_id           TEXT,
  section_id          TEXT,
  batch_id            TEXT,
  roll_number         TEXT NOT NULL,
  name                TEXT,
  email               TEXT,
  section             TEXT,
  batch               TEXT,
  is_enrolled         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_roster_college_roll UNIQUE (college_id, roll_number)
);

CREATE INDEX IF NOT EXISTS idx_student_roster_college_roll ON student_roster(college_id, roll_number);
CREATE INDEX IF NOT EXISTS idx_students_active_session ON students(active_session_id);
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
