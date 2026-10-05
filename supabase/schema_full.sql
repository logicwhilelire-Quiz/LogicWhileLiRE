-- ==============================================================================
-- LOGICWHILELIRE — FULL PRODUCTION SUPABASE DATABASE SCHEMA (CONSOLIDATED)
-- File: supabase/schema_full.sql
-- Compatible with: Supabase / PostgreSQL 15+
-- Instructions: Run this entire script in Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- ─── 0. EXTENSIONS ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── 1. CUSTOM ENUMS & TYPES ──────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE session_status AS ENUM ('not_started', 'in_progress', 'terminated', 'submitted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE violation_type AS ENUM (
    'tab_switch',
    'window_blur',
    'fullscreen_exit',
    'devtools',
    'copy_paste',
    'multiple_faces',
    'no_face'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE staff_role AS ENUM (
    'super_admin',
    'faculty',
    'inspector',
    'college_admin',
    'exam_coordinator',
    'proctor'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2. TABLE: colleges ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS colleges (
  id                  SERIAL PRIMARY KEY,
  college_id          TEXT,
  college_name        VARCHAR(150) NOT NULL,
  college_code        VARCHAR(20) UNIQUE NOT NULL,
  city                VARCHAR(100),
  state               VARCHAR(100) DEFAULT 'Telangana',
  contact_email       TEXT,
  contact_phone       TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  registration_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 3. TABLE: staff (Super Admins, Inspectors, Faculty) ──────────────────────
CREATE TABLE IF NOT EXISTS staff (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                    TEXT NOT NULL,
  email                   TEXT UNIQUE NOT NULL,
  password_hash           TEXT NOT NULL,
  role                    TEXT NOT NULL DEFAULT 'faculty' CHECK (role IN ('super_admin', 'inspector', 'faculty', 'college_admin', 'exam_coordinator', 'proctor')),
  college_id              INT REFERENCES colleges(id) ON DELETE SET NULL,
  permissions             JSONB DEFAULT '[]'::jsonb,
  failed_attempts         INTEGER NOT NULL DEFAULT 0,
  locked_until            TIMESTAMPTZ,
  reset_token_hash        TEXT,
  reset_token_expires     TIMESTAMPTZ,
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  is_2fa_enabled          BOOLEAN NOT NULL DEFAULT FALSE,
  totp_secret             TEXT,
  two_factor_secret       TEXT,
  two_factor_backup_codes JSONB DEFAULT '[]'::jsonb,
  created_by              UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 3b. TABLE: curriculum (Sector Assessment Taxonomy) ────────────────────────
CREATE TABLE IF NOT EXISTS curriculum (
  id                      TEXT PRIMARY KEY,
  code                    TEXT UNIQUE NOT NULL,
  name                    TEXT NOT NULL,
  short_name              TEXT,
  sector_number           INTEGER DEFAULT 1,
  color                   TEXT DEFAULT '#3B82F6',
  description             TEXT,
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 4. TABLE: students (Enrolled Student Directory) ──────────────────────────
CREATE TABLE IF NOT EXISTS students (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name              TEXT,
  last_name               TEXT,
  name                    TEXT NOT NULL,
  email                   TEXT UNIQUE NOT NULL,
  college_id              TEXT NOT NULL,
  college_name            TEXT,
  year_of_passing         INTEGER,
  roll_number             TEXT NOT NULL,
  hall_ticket             TEXT,
  branch_code             TEXT,
  section                 TEXT,
  section_id              TEXT,
  cohort_id               TEXT,
  academic_year_id        TEXT,
  batch_id                TEXT,
  batch                   TEXT,
  contact_number          TEXT,
  mobile                  TEXT,
  password_hash           TEXT NOT NULL,
  temp_password           TEXT,
  failed_attempts         INTEGER NOT NULL DEFAULT 0,
  locked_until            TIMESTAMPTZ,
  reset_token_hash        TEXT,
  reset_token_expires     TIMESTAMPTZ,
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  is_verified             BOOLEAN NOT NULL DEFAULT FALSE,
  verification_otp        TEXT,
  verification_token      TEXT,
  verification_expires_at TIMESTAMPTZ,
  must_change_password    BOOLEAN NOT NULL DEFAULT FALSE,
  active_session_id       TEXT,
  is_2fa_enabled          BOOLEAN NOT NULL DEFAULT FALSE,
  two_factor_secret       TEXT,
  two_factor_backup_codes JSONB DEFAULT '[]'::jsonb,
  totp_secret             TEXT,
  is_blocked              BOOLEAN NOT NULL DEFAULT FALSE,
  block_reason            TEXT,
  allowed_attempts        INTEGER NOT NULL DEFAULT 1,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_student_college_roll UNIQUE (college_id, roll_number)
);

-- ─── 5. TABLE: platform_settings (Global Engine Configuration) ────────────────
CREATE TABLE IF NOT EXISTS platform_settings (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform_name         TEXT NOT NULL DEFAULT 'LogicWhileLiRE',
  tagline               TEXT NOT NULL DEFAULT 'Logic. While. LiRE.',
  college_name          TEXT NOT NULL DEFAULT 'Aerospace & Software Excellence Partner',
  logo_url              TEXT DEFAULT '/brand/logicwhilelire-logo-full.svg',
  primary_color         TEXT NOT NULL DEFAULT '#2B7FFF',
  secondary_color       TEXT NOT NULL DEFAULT '#050814',
  maintenance_mode      BOOLEAN NOT NULL DEFAULT FALSE,
  maintenance_message   TEXT DEFAULT 'Platform is undergoing scheduled administrative maintenance.',
  allowed_languages     TEXT[] NOT NULL DEFAULT ARRAY['python', 'javascript', 'cpp', 'java', 'go'],
  execution_timeout_ms  INTEGER NOT NULL DEFAULT 5000,
  memory_limit_mb       INTEGER NOT NULL DEFAULT 256,
  enable_plagiarism_chk BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 6. TABLE: exams (Traditional & Custom Examinations) ──────────────────────
CREATE TABLE IF NOT EXISTS exams (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title                 TEXT NOT NULL,
  exam_code             TEXT UNIQUE,
  description           TEXT,
  duration_minutes      INTEGER NOT NULL CHECK (duration_minutes > 0),
  passing_percentage    NUMERIC NOT NULL DEFAULT 40,
  start_time            TIMESTAMPTZ,
  end_time              TIMESTAMPTZ,
  admin_email           TEXT,
  is_leaderboard_public BOOLEAN NOT NULL DEFAULT TRUE,
  is_active             BOOLEAN NOT NULL DEFAULT FALSE,
  is_launched           BOOLEAN NOT NULL DEFAULT FALSE,
  results_published     BOOLEAN NOT NULL DEFAULT FALSE,
  proctoring_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  leaderboard_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  negative_marking      NUMERIC NOT NULL DEFAULT 0,
  shuffle_questions     BOOLEAN NOT NULL DEFAULT TRUE,
  fullscreen_lock       BOOLEAN NOT NULL DEFAULT TRUE,
  tab_switch_detection  BOOLEAN NOT NULL DEFAULT TRUE,
  college_id            INT REFERENCES colleges(id) ON DELETE SET NULL,
  created_by_staff_id   UUID REFERENCES staff(id) ON DELETE SET NULL,
  branch                VARCHAR(100),
  passout_year          INT,
  section_id            TEXT,
  section_ids           JSONB DEFAULT '[]'::jsonb,
  batch_id              TEXT,
  assigned_faculty_id   UUID REFERENCES staff(id) ON DELETE SET NULL,
  assigned_inspector_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  is_locked             BOOLEAN NOT NULL DEFAULT FALSE,
  paper_status          TEXT DEFAULT 'draft',
  total_score           NUMERIC NOT NULL DEFAULT 100,
  session_id            TEXT,
  participant_id        TEXT,
  normalized_score      NUMERIC,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 7. TABLE: questions (Traditional Exam Bank) ──────────────────────────────
CREATE TABLE IF NOT EXISTS questions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id           UUID REFERENCES exams(id) ON DELETE CASCADE,
  exam_code         TEXT,
  question          TEXT,
  question_text     TEXT,
  options           JSONB NOT NULL DEFAULT '{"a":"","b":"","c":"","d":""}',
  correct_option    TEXT,
  correct_answer    TEXT,
  marks             NUMERIC NOT NULL DEFAULT 1 CHECK (marks > 0),
  penalty           NUMERIC NOT NULL DEFAULT 0,
  negative_marks    NUMERIC NOT NULL DEFAULT 0,
  topic             TEXT NOT NULL DEFAULT 'General',
  section           TEXT NOT NULL DEFAULT 'General',
  difficulty        TEXT NOT NULL DEFAULT 'Medium' CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  question_set      TEXT NOT NULL DEFAULT 'A',
  set_number        INTEGER NOT NULL DEFAULT 1,
  display_order     INTEGER,
  time_limit        INTEGER,
  type              TEXT DEFAULT 'mcq',
  explanation       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 8. TABLE: participants (Exam Registrations & Hall Tickets) ───────────────
CREATE TABLE IF NOT EXISTS participants (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_id    TEXT,
  exam_id           UUID REFERENCES exams(id) ON DELETE CASCADE,
  student_id        UUID REFERENCES students(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  student_name      TEXT,
  hall_ticket       TEXT NOT NULL,
  mobile            TEXT,
  contact_number    TEXT,
  email             TEXT NOT NULL,
  branch            TEXT,
  branch_code       TEXT,
  section           TEXT,
  year_of_passing   INTEGER,
  is_blocked        BOOLEAN NOT NULL DEFAULT FALSE,
  extra_time_mins   INTEGER NOT NULL DEFAULT 0,
  enrolled_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  registered_at     TIMESTAMPTZ DEFAULT NOW(),
  timestamp         TIMESTAMPTZ DEFAULT NOW(),
  status            TEXT DEFAULT 'registered',
  otp_hash          TEXT,
  otp_expires_at    TIMESTAMPTZ,
  otp_verified      BOOLEAN NOT NULL DEFAULT FALSE,
  session_id        TEXT,
  question_id       TEXT,
  chosen_option     TEXT,
  answer_latency_ms INTEGER,
  total_score       NUMERIC DEFAULT 0,
  max_score         NUMERIC DEFAULT 0,
  time_taken_seconds INTEGER DEFAULT 0,
  ip_address        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 9. TABLE: exam_sessions (Active Exam Sessions) ───────────────────────────
CREATE TABLE IF NOT EXISTS exam_sessions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id          TEXT,
  participant_id      UUID REFERENCES participants(id) ON DELETE CASCADE,
  exam_id             UUID REFERENCES exams(id) ON DELETE CASCADE,
  exam_code           TEXT,
  name                TEXT,
  student_name        TEXT,
  hall_ticket         TEXT,
  email               TEXT,
  token_hash          TEXT,
  session_token       TEXT,
  started_at          TIMESTAMPTZ,
  start_time          TIMESTAMPTZ DEFAULT NOW(),
  submitted_at        TIMESTAMPTZ,
  end_time            TIMESTAMPTZ,
  status              session_status NOT NULL DEFAULT 'not_started',
  termination_reason  TEXT,
  extended_minutes    INTEGER NOT NULL DEFAULT 0,
  question_order      JSONB,
  question_set        TEXT NOT NULL DEFAULT 'A',
  set_number          INTEGER NOT NULL DEFAULT 1,
  violation_count     INTEGER NOT NULL DEFAULT 0,
  ip_address          TEXT,
  browser_fingerprint TEXT,
  fingerprint         TEXT,
  suspicious_flags    JSONB DEFAULT '[]',
  score               NUMERIC DEFAULT 0,
  max_score           NUMERIC DEFAULT 0,
  percentage          NUMERIC DEFAULT 0,
  answers             JSONB DEFAULT '{}',
  code_answers        JSONB DEFAULT '{}',
  time_remaining_seconds INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 10. TABLE: session_answers (Per-Question Answer Tracking) ────────────────
CREATE TABLE IF NOT EXISTS session_answers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id        UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  question_id       UUID NOT NULL,
  chosen_option     TEXT NOT NULL,
  selected_option   TEXT,
  is_correct        BOOLEAN DEFAULT FALSE,
  marks_awarded     NUMERIC DEFAULT 0,
  answered_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answer_latency_ms INTEGER,
  CONSTRAINT uq_session_question UNIQUE (session_id, question_id)
);

-- ─── 11. TABLE: results (Graded Institutional Performance Records) ───────────
CREATE TABLE IF NOT EXISTS results (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id          UUID REFERENCES exam_sessions(id) ON DELETE CASCADE,
  attempt_id          UUID,
  participant_id      UUID REFERENCES participants(id) ON DELETE CASCADE,
  exam_id             TEXT,
  exam_code           TEXT,
  student_id          TEXT,
  student_name        TEXT,
  name                TEXT,
  hall_ticket         TEXT,
  hall_ticket_no      TEXT,
  email               TEXT,
  mobile              TEXT,
  total_score         NUMERIC NOT NULL DEFAULT 0,
  score               NUMERIC NOT NULL DEFAULT 0,
  score_override      NUMERIC,
  grace_marks         NUMERIC NOT NULL DEFAULT 0,
  override_reason     TEXT,
  max_score           NUMERIC NOT NULL DEFAULT 0,
  percentage          NUMERIC NOT NULL DEFAULT 0,
  grade               TEXT,
  normalized_score    NUMERIC NOT NULL DEFAULT 0,
  correct_count       INTEGER NOT NULL DEFAULT 0,
  wrong_count         INTEGER NOT NULL DEFAULT 0,
  total_questions     INTEGER NOT NULL DEFAULT 0,
  time_taken_seconds  INTEGER NOT NULL DEFAULT 0,
  topic_breakdown     JSONB DEFAULT '{}',
  breakdown           JSONB DEFAULT '{}',
  answers             JSONB DEFAULT '{}',
  status              TEXT DEFAULT 'completed',
  is_published        BOOLEAN NOT NULL DEFAULT FALSE,
  graded_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 12. TABLE: exam_codes (Fast Portal Access Master Codes) ──────────────────
CREATE TABLE IF NOT EXISTS exam_codes (
  id                  SERIAL PRIMARY KEY,
  exam_code           VARCHAR(30) UNIQUE NOT NULL,
  college_id          INT REFERENCES colleges(id) ON DELETE CASCADE,
  college_code        VARCHAR(20),
  college             TEXT,
  exam_name           VARCHAR(150) NOT NULL,
  subject             VARCHAR(100),
  total_questions     INT NOT NULL DEFAULT 30,
  duration_minutes    INT NOT NULL DEFAULT 60,
  passing_percentage  NUMERIC NOT NULL DEFAULT 40,
  start_time          TIMESTAMPTZ NOT NULL,
  end_time            TIMESTAMPTZ NOT NULL,
  is_launched         BOOLEAN NOT NULL DEFAULT FALSE,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  results_published   BOOLEAN NOT NULL DEFAULT FALSE,
  proctoring_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  negative_marking    NUMERIC NOT NULL DEFAULT 0,
  total_marks         NUMERIC NOT NULL DEFAULT 100,
  score               NUMERIC NOT NULL DEFAULT 0,
  max_participants    INT NOT NULL DEFAULT 1000,
  max_violations      INT NOT NULL DEFAULT 5,
  auto_terminate      BOOLEAN NOT NULL DEFAULT TRUE,
  grace_period_seconds INT NOT NULL DEFAULT 60,
  allowed_languages   TEXT[] NOT NULL DEFAULT ARRAY['python', 'javascript', 'cpp', 'java'],
  branch              VARCHAR(100),
  passout_year        INT,
  section_id          TEXT,
  section_ids         JSONB DEFAULT '[]'::jsonb,
  batch_id            TEXT,
  assigned_faculty_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  assigned_inspector_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  is_locked           BOOLEAN NOT NULL DEFAULT FALSE,
  paper_status        TEXT DEFAULT 'draft',
  created_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_by          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 13. TABLE: questions_ec (Questions Linked to Exam Codes) ─────────────────
CREATE TABLE IF NOT EXISTS questions_ec (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_code       VARCHAR(30) NOT NULL REFERENCES exam_codes(exam_code) ON DELETE CASCADE,
  question        TEXT,
  question_text   TEXT,
  options         JSONB,
  option_a        TEXT NOT NULL,
  option_b        TEXT NOT NULL,
  option_c        TEXT NOT NULL,
  option_d        TEXT NOT NULL,
  correct_answer  TEXT NOT NULL,
  marks           NUMERIC NOT NULL DEFAULT 1,
  penalty         NUMERIC NOT NULL DEFAULT 0,
  negative_marks  NUMERIC NOT NULL DEFAULT 0,
  difficulty      TEXT DEFAULT 'Medium' CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  topic           TEXT NOT NULL DEFAULT 'General',
  section         TEXT DEFAULT 'General',
  tags            JSONB DEFAULT '[]',
  display_order   INTEGER,
  order_index     INTEGER,
  explanation     TEXT,
  question_type   VARCHAR(20) NOT NULL DEFAULT 'mcq' CHECK (question_type IN ('mcq', 'coding')),
  starter_code    TEXT,
  test_cases      JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 14. TABLE: exam_code_attempts (Candidate Live Attempts) ──────────────────
CREATE TABLE IF NOT EXISTS exam_code_attempts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hall_ticket_no      TEXT NOT NULL,
  hall_ticket         TEXT,
  exam_code           VARCHAR(30) NOT NULL REFERENCES exam_codes(exam_code) ON DELETE CASCADE,
  student_name        TEXT,
  student_id          TEXT,
  college_name        TEXT,
  branch              TEXT,
  section             TEXT,
  year_of_passing     INTEGER,
  start_time          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time            TIMESTAMPTZ,
  submitted_at        TIMESTAMPTZ,
  score               NUMERIC DEFAULT 0,
  score_override      NUMERIC,
  grace_marks         NUMERIC DEFAULT 0,
  override_reason     TEXT,
  max_score           NUMERIC DEFAULT 0,
  correct_count       INT DEFAULT 0,
  wrong_count         INT DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'terminated_cheating', 'auto_submitted_expired', 'submitted')),
  violation_count     INT NOT NULL DEFAULT 0,
  answers             JSONB DEFAULT '{}',
  code_answers        JSONB DEFAULT '{}',
  partial_answers     JSONB DEFAULT '{}',
  last_question_index INTEGER DEFAULT 0,
  time_taken_seconds  INT DEFAULT 0,
  topic_breakdown     JSONB DEFAULT '{}',
  session_token       TEXT,
  violation_timeline  JSONB DEFAULT '[]',
  violations          JSONB DEFAULT '[]',
  screen_thumbnails   JSONB DEFAULT '[]',
  ip_address          TEXT,
  client_fingerprint  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_hall_ticket_exam_code UNIQUE (hall_ticket_no, exam_code)
);

-- ─── 15. TABLE: violations (Live Proctoring Infractions) ──────────────────────
CREATE TABLE IF NOT EXISTS violations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id      UUID REFERENCES exam_sessions(id) ON DELETE CASCADE,
  attempt_id      UUID REFERENCES exam_code_attempts(id) ON DELETE CASCADE,
  participant_id  UUID REFERENCES participants(id) ON DELETE CASCADE,
  participant     TEXT,
  hall_ticket     TEXT,
  exam_id         TEXT,
  exam_code       TEXT,
  type            TEXT,
  violation_type  TEXT,
  violation_count INTEGER DEFAULT 1,
  details         JSONB DEFAULT '{}'::jsonb,
  notes           TEXT,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 16. TABLE: suspicious_activity (Proctoring & Conflict Tracking) ──────────
CREATE TABLE IF NOT EXISTS suspicious_activity (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id                 TEXT,
  session_id              UUID REFERENCES exam_sessions(id) ON DELETE CASCADE,
  attempt_id              UUID REFERENCES exam_code_attempts(id) ON DELETE CASCADE,
  participant_id          UUID REFERENCES participants(id) ON DELETE CASCADE,
  hall_ticket             TEXT NOT NULL,
  conflict_session_id     UUID REFERENCES exam_sessions(id) ON DELETE SET NULL,
  conflict_participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  conflict_hall_ticket    TEXT,
  activity_type           TEXT NOT NULL DEFAULT 'duplicate_fingerprint',
  fingerprint             TEXT,
  details                 JSONB,
  severity                TEXT DEFAULT 'medium',
  status                  TEXT NOT NULL DEFAULT 'pending_review',
  reviewed_by             TEXT,
  reviewed_at             TIMESTAMPTZ,
  detected_at             TIMESTAMPTZ DEFAULT NOW(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 17. TABLE: proctor_logs (Inspector Telemetry & Event Stream) ─────────────
CREATE TABLE IF NOT EXISTS proctor_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id  TEXT,
  exam_id       TEXT,
  event_type    TEXT NOT NULL,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 18. TABLE: deliverable_failures (Email Queue Dead-Letter Store) ──────────
CREATE TABLE IF NOT EXISTS deliverable_failures (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  to_email        TEXT NOT NULL,
  recipient_email TEXT,
  email_type      TEXT NOT NULL,
  exam_id         TEXT,
  session_id      TEXT,
  participant_id  TEXT,
  subject         TEXT NOT NULL,
  error_message   TEXT NOT NULL,
  attempt_count   INTEGER NOT NULL DEFAULT 1,
  payload         JSONB DEFAULT '{}'::jsonb,
  metadata        JSONB DEFAULT '{}'::jsonb,
  status          TEXT NOT NULL DEFAULT 'failed',
  failed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 19. TABLE: audit_log (Comprehensive Append-Only Security Trail) ──────────
CREATE TABLE IF NOT EXISTS audit_log (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id          TEXT,
  actor_email       TEXT,
  actor_role        TEXT,
  admin_id          TEXT,
  admin_name        TEXT,
  action            TEXT NOT NULL,
  resource_type     TEXT,
  resource_id       TEXT,
  target_table      TEXT,
  target_id         TEXT,
  before_state      JSONB,
  payload           JSONB,
  details           JSONB DEFAULT '{}'::jsonb,
  ip_address        TEXT,
  user_agent        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 20. TABLE: leaderboard (Cached Cross-College Standing Ranks) ──────────────
CREATE TABLE IF NOT EXISTS leaderboard (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id             TEXT NOT NULL,
  exam_code           TEXT,
  rank                INTEGER,
  candidate_id        TEXT,
  hall_ticket         TEXT,
  student_name        TEXT,
  name                TEXT,
  score               NUMERIC NOT NULL DEFAULT 0,
  percentage          NUMERIC NOT NULL DEFAULT 0,
  time_taken_seconds  INTEGER NOT NULL DEFAULT 0,
  violations_count    INTEGER NOT NULL DEFAULT 0,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_leaderboard_exam_candidate UNIQUE (exam_id, candidate_id)
);

-- ─── 21. TABLE: academic_years ────────────────────────────────────────────────
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

-- ─── 22. TABLE: cohorts (Year of Passing Cohorts) ─────────────────────────────
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

-- ─── 23. TABLE: sections ──────────────────────────────────────────────────────
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

-- ─── 24. TABLE: batches (Lab / Practical Cohort Batches) ──────────────────────
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

-- ─── 25. TABLE: student_roster (Admin Uploaded Roster Records) ────────────────
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

-- ─── 26. TABLE: email_queue (Durable Email Persistence Across Reboots) ────────
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

-- ─── 27. COMPATIBILITY VIEWS (security_invoker = true) ──────────────────────────
CREATE OR REPLACE VIEW candidates WITH (security_invoker = true) AS SELECT * FROM participants;
CREATE OR REPLACE VIEW sessions WITH (security_invoker = true) AS SELECT * FROM exam_sessions;
CREATE OR REPLACE VIEW audit_logs WITH (security_invoker = true) AS SELECT * FROM audit_log;

-- ─── 28. PERFORMANCE INDEXES ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_colleges_code ON colleges(college_code);
CREATE INDEX IF NOT EXISTS idx_colleges_active ON colleges(is_active);

CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);
CREATE INDEX IF NOT EXISTS idx_staff_role ON staff(role);
CREATE INDEX IF NOT EXISTS idx_staff_college ON staff(college_id);

CREATE INDEX IF NOT EXISTS idx_students_college_roll ON students(college_id, roll_number);
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
CREATE INDEX IF NOT EXISTS idx_students_hall_ticket ON students(hall_ticket);
CREATE INDEX IF NOT EXISTS idx_students_active ON students(is_active);

CREATE INDEX IF NOT EXISTS idx_academic_years_college ON academic_years(college_id);
CREATE INDEX IF NOT EXISTS idx_cohorts_college ON cohorts(college_id);
CREATE INDEX IF NOT EXISTS idx_cohorts_ay ON cohorts(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_sections_college ON sections(college_id);
CREATE INDEX IF NOT EXISTS idx_sections_cohort ON sections(cohort_id);
CREATE INDEX IF NOT EXISTS idx_batches_section ON batches(section_id);
CREATE INDEX IF NOT EXISTS idx_batches_college ON batches(college_id);
CREATE INDEX IF NOT EXISTS idx_roster_college_roll ON student_roster(college_id, roll_number);

CREATE INDEX IF NOT EXISTS idx_exams_active ON exams(is_active, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_exams_code ON exams(exam_code);

CREATE INDEX IF NOT EXISTS idx_participants_exam_hall ON participants(exam_id, hall_ticket);
CREATE INDEX IF NOT EXISTS idx_participants_student ON participants(student_id);

CREATE INDEX IF NOT EXISTS idx_exam_sessions_part ON exam_sessions(participant_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_exam ON exam_sessions(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_status ON exam_sessions(status);

CREATE INDEX IF NOT EXISTS idx_session_answers_session ON session_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_questions_exam ON questions(exam_id);

CREATE INDEX IF NOT EXISTS idx_exam_codes_code ON exam_codes(exam_code);
CREATE INDEX IF NOT EXISTS idx_exam_codes_college ON exam_codes(college_id);
CREATE INDEX IF NOT EXISTS idx_exam_codes_active ON exam_codes(is_active, start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_questions_ec_code ON questions_ec(exam_code);
CREATE INDEX IF NOT EXISTS idx_questions_ec_order ON questions_ec(exam_code, display_order);

CREATE INDEX IF NOT EXISTS idx_exam_code_attempts_hall ON exam_code_attempts(hall_ticket_no, exam_code);
CREATE INDEX IF NOT EXISTS idx_exam_code_attempts_exam ON exam_code_attempts(exam_code);
CREATE INDEX IF NOT EXISTS idx_exam_code_attempts_status ON exam_code_attempts(status);
CREATE INDEX IF NOT EXISTS idx_exam_code_attempts_token ON exam_code_attempts(session_token);
CREATE INDEX IF NOT EXISTS idx_exam_code_attempts_lookup ON exam_code_attempts(exam_code, hall_ticket_no);

CREATE INDEX IF NOT EXISTS idx_proctor_logs_attempt ON proctor_logs(attempt_id);
CREATE INDEX IF NOT EXISTS idx_proctor_logs_created ON proctor_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_results_attempt ON results(attempt_id);
CREATE INDEX IF NOT EXISTS idx_results_exam ON results(exam_id);
CREATE INDEX IF NOT EXISTS idx_results_part ON results(participant_id);

CREATE INDEX IF NOT EXISTS idx_email_queue_status_created ON email_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_email_queue_retry ON email_queue(status, next_retry_at);

CREATE INDEX IF NOT EXISTS idx_audit_log_target ON audit_log(target_table, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);

-- ─── 29. ROW LEVEL SECURITY (RLS) POLICIES ON ALL 26 TABLES ───────────────────
ALTER TABLE IF EXISTS academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS deliverable_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS exam_code_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS exam_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS proctor_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS questions_ec ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS results ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS session_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS student_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS suspicious_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS violations ENABLE ROW LEVEL SECURITY;

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
    'exam_code_attempts',
    'exam_codes',
    'exam_sessions',
    'exams',
    'leaderboard',
    'participants',
    'platform_settings',
    'proctor_logs',
    'questions',
    'questions_ec',
    'results',
    'sections',
    'session_answers',
    'staff',
    'student_roster',
    'students',
    'suspicious_activity',
    'violations'
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

-- ─── 30. REVOKE ALL FROM anon & authenticated (SERVICE ROLE ONLY) ─────────────
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon, authenticated;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;

-- ─── 31. IDEMPOTENT COLUMN BACKFILL (For Pre-Existing Tables) ─────────────────
-- Guarantees that re-running schema_full.sql on databases that already had
-- earlier versions of tables adds any newly required columns safely.
ALTER TABLE IF EXISTS colleges ADD COLUMN IF NOT EXISTS registration_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE IF EXISTS colleges ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE IF EXISTS staff ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE IF EXISTS staff ADD COLUMN IF NOT EXISTS is_2fa_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS staff ADD COLUMN IF NOT EXISTS totp_secret TEXT;
ALTER TABLE IF EXISTS staff ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS staff ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE IF EXISTS staff ADD COLUMN IF NOT EXISTS reset_token_hash TEXT;
ALTER TABLE IF EXISTS staff ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;

ALTER TABLE IF EXISTS students ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS students ADD COLUMN IF NOT EXISTS verification_otp TEXT;
ALTER TABLE IF EXISTS students ADD COLUMN IF NOT EXISTS verification_token TEXT;
ALTER TABLE IF EXISTS students ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS students ADD COLUMN IF NOT EXISTS active_session_id TEXT;
ALTER TABLE IF EXISTS students ADD COLUMN IF NOT EXISTS cohort_id TEXT;
ALTER TABLE IF EXISTS students ADD COLUMN IF NOT EXISTS section_id TEXT;
ALTER TABLE IF EXISTS students ADD COLUMN IF NOT EXISTS batch_id TEXT;
ALTER TABLE IF EXISTS students ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS students ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE IF EXISTS students ADD COLUMN IF NOT EXISTS reset_token_hash TEXT;
ALTER TABLE IF EXISTS students ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;

ALTER TABLE IF EXISTS exam_codes ADD COLUMN IF NOT EXISTS branch VARCHAR(100);
ALTER TABLE IF EXISTS exam_codes ADD COLUMN IF NOT EXISTS passout_year INT;
ALTER TABLE IF EXISTS exam_codes ADD COLUMN IF NOT EXISTS section_id TEXT;
ALTER TABLE IF EXISTS exam_codes ADD COLUMN IF NOT EXISTS section_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE IF EXISTS exam_codes ADD COLUMN IF NOT EXISTS batch_id TEXT;
ALTER TABLE IF EXISTS exam_codes ADD COLUMN IF NOT EXISTS assigned_faculty_id UUID;
ALTER TABLE IF EXISTS exam_codes ADD COLUMN IF NOT EXISTS assigned_inspector_id UUID;
ALTER TABLE IF EXISTS exam_codes ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS exam_codes ADD COLUMN IF NOT EXISTS paper_status TEXT DEFAULT 'draft';

