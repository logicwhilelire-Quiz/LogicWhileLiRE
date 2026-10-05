-- ==============================================================================
-- LogicWhileLiRE — DELTA MIGRATION FOR EXISTING PRODUCTION DATABASES
-- Use this script if your Supabase project already contains tables/data.
-- 
-- SAFE TO RUN:
--  - ZERO DROP TABLE or TRUNCATE statements.
--  - ZERO demo inserts or default passwords.
--  - Idempotent: uses CREATE TABLE IF NOT EXISTS & ADD COLUMN IF NOT EXISTS.
--  - Preserves all existing candidates, exams, and question data intact.
-- ==============================================================================

-- ─── 1. EXTENSIONS ───────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── 2. NEW COLUMNS ON EXISTING TABLES ────────────────────────────────────────

-- colleges
ALTER TABLE colleges ADD COLUMN IF NOT EXISTS registration_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE colleges ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- staff (RBAC, 2FA & lockout)
ALTER TABLE staff ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_2fa_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS totp_secret TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS reset_token_hash TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;

-- students (verification, active session, hierarchy, lockout)
ALTER TABLE students ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS verification_otp TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS verification_token TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMPTZ;
ALTER TABLE students ADD COLUMN IF NOT EXISTS active_session_id TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS cohort_id TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS section_id TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS batch_id TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS branch VARCHAR(100);
ALTER TABLE students ADD COLUMN IF NOT EXISTS branch_code VARCHAR(100);
ALTER TABLE students ADD COLUMN IF NOT EXISTS passout_year INT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS year_of_passing INT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS section VARCHAR(50);
ALTER TABLE students ADD COLUMN IF NOT EXISTS batch VARCHAR(50);
ALTER TABLE students ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE students ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE students ADD COLUMN IF NOT EXISTS reset_token_hash TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;

-- exam_codes (Section targeting & Question paper allocation)
ALTER TABLE exam_codes ADD COLUMN IF NOT EXISTS branch VARCHAR(100);
ALTER TABLE exam_codes ADD COLUMN IF NOT EXISTS passout_year INT;
ALTER TABLE exam_codes ADD COLUMN IF NOT EXISTS section_id TEXT;
ALTER TABLE exam_codes ADD COLUMN IF NOT EXISTS section_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE exam_codes ADD COLUMN IF NOT EXISTS batch_id TEXT;
ALTER TABLE exam_codes ADD COLUMN IF NOT EXISTS assigned_faculty_id UUID REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE exam_codes ADD COLUMN IF NOT EXISTS assigned_inspector_id UUID REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE exam_codes ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE exam_codes ADD COLUMN IF NOT EXISTS paper_status TEXT DEFAULT 'draft';

-- exams (Section targeting & Question paper allocation)
ALTER TABLE exams ADD COLUMN IF NOT EXISTS branch VARCHAR(100);
ALTER TABLE exams ADD COLUMN IF NOT EXISTS passout_year INT;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS section_id TEXT;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS section_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS batch_id TEXT;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS assigned_faculty_id UUID REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS assigned_inspector_id UUID REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS paper_status TEXT DEFAULT 'draft';

-- proctor_logs (Inspector telemetry attempt linking)
ALTER TABLE IF EXISTS public.proctor_logs
  ADD COLUMN IF NOT EXISTS attempt_id UUID
  REFERENCES public.exam_code_attempts(id) ON DELETE CASCADE;

-- email_queue (Retry scheduling)
ALTER TABLE IF EXISTS public.email_queue
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

-- Ensure composite uniqueness for students (college_id, roll_number)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_student_college_roll'
  ) THEN
    ALTER TABLE students ADD CONSTRAINT uq_student_college_roll UNIQUE (college_id, roll_number);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ─── 3. NEW INSTITUTIONAL HIERARCHY TABLES ────────────────────────────────────

CREATE TABLE IF NOT EXISTS academic_years (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  college_id          TEXT NOT NULL,
  label               TEXT NOT NULL,
  start_year          INTEGER NOT NULL,
  end_year            INTEGER NOT NULL,
  is_current          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_ay_college_label UNIQUE (college_id, label)
);

CREATE TABLE IF NOT EXISTS cohorts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  college_id          TEXT NOT NULL,
  academic_year_id    UUID REFERENCES academic_years(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  degree              TEXT NOT NULL DEFAULT 'B.Tech',
  department          TEXT NOT NULL,
  graduation_year     INTEGER NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_cohort_college_dept_year UNIQUE (college_id, department, graduation_year)
);

CREATE TABLE IF NOT EXISTS sections (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  college_id          TEXT NOT NULL,
  cohort_id           UUID REFERENCES cohorts(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  capacity            INTEGER DEFAULT 60,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_section_cohort_name UNIQUE (cohort_id, name)
);

CREATE TABLE IF NOT EXISTS batches (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  college_id          TEXT NOT NULL,
  section_id          UUID REFERENCES sections(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  type                TEXT NOT NULL DEFAULT 'lab' CHECK (type IN ('lab', 'theory', 'tutorial')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_batch_section_name UNIQUE (section_id, name)
);

CREATE TABLE IF NOT EXISTS student_roster (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- ─── 4. AUDIT & TELEMETRY TABLES ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             TEXT,
  actor_name          TEXT,
  role                TEXT,
  action              TEXT NOT NULL,
  target_table        TEXT,
  target_id           TEXT,
  details             JSONB DEFAULT '{}'::jsonb,
  ip_address          TEXT,
  user_agent          TEXT,
  college_id          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deliverable_failures (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source              TEXT NOT NULL DEFAULT 'assessment_deliverable',
  error_type          TEXT NOT NULL,
  message             TEXT NOT NULL,
  stack               TEXT,
  payload             JSONB DEFAULT '{}'::jsonb,
  resolved            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_queue (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id              TEXT UNIQUE NOT NULL,
  template            TEXT NOT NULL,
  recipient           TEXT NOT NULL,
  subject             TEXT NOT NULL,
  payload             JSONB DEFAULT '{}'::jsonb,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempts            INTEGER NOT NULL DEFAULT 0,
  max_attempts        INTEGER NOT NULL DEFAULT 3,
  next_retry_at       TIMESTAMPTZ,
  sent_at             TIMESTAMPTZ,
  error               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 5. COMPATIBILITY VIEWS (security_invoker = true) ──────────────────────────
CREATE OR REPLACE VIEW candidates WITH (security_invoker = true) AS SELECT * FROM participants;
CREATE OR REPLACE VIEW sessions WITH (security_invoker = true) AS SELECT * FROM exam_sessions;
CREATE OR REPLACE VIEW audit_logs WITH (security_invoker = true) AS SELECT * FROM audit_log;

-- ─── 6. PERFORMANCE INDEXES ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_colleges_code ON colleges(college_code);
CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);
CREATE INDEX IF NOT EXISTS idx_students_college_roll ON students(college_id, roll_number);
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
CREATE INDEX IF NOT EXISTS idx_students_targeting ON students(college_id, branch_code, year_of_passing, section);
CREATE INDEX IF NOT EXISTS idx_exam_codes_targeting ON exam_codes(college_id, branch, passout_year);
CREATE INDEX IF NOT EXISTS idx_exams_targeting ON exams(college_id, branch, passout_year);
CREATE INDEX IF NOT EXISTS idx_roster_college_roll ON student_roster(college_id, roll_number);
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);

-- ─── 7. ROW LEVEL SECURITY (RLS) POLICIES ─────────────────────────────────────
ALTER TABLE IF EXISTS academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS deliverable_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS student_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS students ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'academic_years',
    'audit_log',
    'batches',
    'cohorts',
    'colleges',
    'deliverable_failures',
    'email_queue',
    'sections',
    'staff',
    'student_roster',
    'students'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "service_role_full_access" ON %I;', tbl);
    EXECUTE format('
      CREATE POLICY "service_role_full_access"
        ON %I
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    ', tbl);
  END LOOP;
END $$;

-- Revoke anon and authenticated access (Service Role Only)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

-- ─── DONE ────────────────────────────────────────────────────────────────────
