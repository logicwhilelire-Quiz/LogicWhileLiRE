-- ==============================================================================
-- LOGICWHILELIRE — HIERARCHY, ROSTERS & PERSISTED EMAIL QUEUE
-- Migration: 20261004000000_hierarchy_roster_email_queue.sql
-- Description: Institutional Hierarchy, Roster Imports, Email Queue & Views.
-- ==============================================================================

-- ─── 1. TABLE: academic_years ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS academic_years (
  id              TEXT PRIMARY KEY,
  college_id      TEXT NOT NULL,
  year            TEXT NOT NULL,
  yop             INTEGER,
  start_date      DATE,
  end_date        DATE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 2. TABLE: cohorts (Year of Passing Cohorts) ──────────────────────────────
CREATE TABLE IF NOT EXISTS cohorts (
  id                  TEXT PRIMARY KEY,
  college_id          TEXT NOT NULL,
  academic_year_id    TEXT REFERENCES academic_years(id) ON DELETE SET NULL,
  name                TEXT NOT NULL,
  year_of_passing     INTEGER NOT NULL,
  yop                 INTEGER,
  degree              TEXT DEFAULT 'B.Tech',
  branch              TEXT DEFAULT 'CSE',
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 3. TABLE: sections ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sections (
  id                  TEXT PRIMARY KEY,
  college_id          TEXT NOT NULL,
  cohort_id           TEXT REFERENCES cohorts(id) ON DELETE SET NULL,
  academic_year_id    TEXT REFERENCES academic_years(id) ON DELETE SET NULL,
  name                TEXT NOT NULL,
  section_name        TEXT,
  room_number         TEXT,
  capacity            INTEGER DEFAULT 60,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 4. TABLE: batches (Lab / Practical Cohort Batches) ───────────────────────
CREATE TABLE IF NOT EXISTS batches (
  id                  TEXT PRIMARY KEY,
  college_id          TEXT NOT NULL,
  cohort_id           TEXT REFERENCES cohorts(id) ON DELETE SET NULL,
  section_id          TEXT REFERENCES sections(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  batch_name          TEXT,
  batch_code          TEXT,
  max_capacity        INTEGER DEFAULT 30,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 5. TABLE: student_roster (Admin Uploaded Roster Records) ─────────────────
CREATE TABLE IF NOT EXISTS student_roster (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  college_id          TEXT NOT NULL,
  roll_number         TEXT NOT NULL,
  name                TEXT NOT NULL,
  email               TEXT,
  phone               TEXT,
  section             TEXT,
  section_id          TEXT,
  cohort_id           TEXT,
  academic_year_id    TEXT,
  batch_id            TEXT,
  batch               TEXT,
  imported_by         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_roster_college_roll UNIQUE (college_id, roll_number)
);

-- ─── 6. TABLE: email_queue (Durable Email Persistence Across Reboots) ─────────
CREATE TABLE IF NOT EXISTS email_queue (
  id                  TEXT PRIMARY KEY,
  type                TEXT NOT NULL,
  payload             JSONB NOT NULL,
  attempts            INTEGER NOT NULL DEFAULT 0,
  max_attempts        INTEGER NOT NULL DEFAULT 3,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 7. COMPATIBILITY VIEWS (security_invoker = true) ──────────────────────────
CREATE OR REPLACE VIEW candidates WITH (security_invoker = true) AS SELECT * FROM participants;
CREATE OR REPLACE VIEW sessions WITH (security_invoker = true) AS SELECT * FROM exam_sessions;
CREATE OR REPLACE VIEW audit_logs WITH (security_invoker = true) AS SELECT * FROM audit_log;

-- ─── 8. PERFORMANCE INDEXES ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_academic_years_college ON academic_years(college_id);
CREATE INDEX IF NOT EXISTS idx_cohorts_college ON cohorts(college_id);
CREATE INDEX IF NOT EXISTS idx_cohorts_ay ON cohorts(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_sections_college ON sections(college_id);
CREATE INDEX IF NOT EXISTS idx_sections_cohort ON sections(cohort_id);
CREATE INDEX IF NOT EXISTS idx_batches_section ON batches(section_id);
CREATE INDEX IF NOT EXISTS idx_batches_college ON batches(college_id);
CREATE INDEX IF NOT EXISTS idx_roster_college_roll ON student_roster(college_id, roll_number);
CREATE INDEX IF NOT EXISTS idx_email_queue_status_created ON email_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_students_college_roll ON students(college_id, roll_number);
CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);
CREATE INDEX IF NOT EXISTS idx_exam_code_attempts_lookup ON exam_code_attempts(exam_code, hall_ticket_no);
CREATE INDEX IF NOT EXISTS idx_results_attempt ON results(attempt_id);
CREATE INDEX IF NOT EXISTS idx_results_exam ON results(exam_id);
