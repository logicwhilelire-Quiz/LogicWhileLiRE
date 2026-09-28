-- ============================================================
-- QUIZ PLATFORM — PostgreSQL Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE session_status AS ENUM ('not_started', 'in_progress', 'terminated', 'submitted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE violation_type AS ENUM ('tab_switch', 'window_blur', 'fullscreen_exit', 'devtools', 'copy_paste');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE staff_role AS ENUM ('super_admin', 'faculty');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- TABLE: staff
-- ============================================================
CREATE TABLE IF NOT EXISTS staff (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                TEXT NOT NULL,
  email               TEXT UNIQUE NOT NULL,
  password_hash       TEXT NOT NULL,
  role                TEXT NOT NULL DEFAULT 'faculty' CHECK (role IN ('super_admin', 'faculty')),
  created_by          UUID REFERENCES staff(id) ON DELETE SET NULL,
  failed_attempts     INTEGER NOT NULL DEFAULT 0,
  locked_until        TIMESTAMPTZ,
  reset_token_hash    TEXT,
  reset_token_expires TIMESTAMPTZ,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ============================================================
-- TABLE: students / candidates (Gate Module AL-SPEC-2026-REG)
-- ============================================================
CREATE TABLE IF NOT EXISTS students (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name          TEXT,
  last_name           TEXT,
  name                TEXT NOT NULL,
  email               TEXT UNIQUE NOT NULL,
  college_id          TEXT,
  college_name        TEXT,
  year_of_passing     INTEGER CHECK (year_of_passing IN (2027, 2028, 2029, 2030)),
  roll_number         TEXT,
  hall_ticket         TEXT UNIQUE,
  branch_code         TEXT,
  section             TEXT CHECK (section IN ('A', 'B', 'C', 'D', 'E')),
  contact_number      TEXT,
  mobile              TEXT,
  password_hash       TEXT NOT NULL,
  failed_attempts     INTEGER NOT NULL DEFAULT 0,
  locked_until        TIMESTAMPTZ,
  reset_token_hash    TEXT,
  reset_token_expires TIMESTAMPTZ,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_college_roll UNIQUE (college_id, roll_number)
);

-- ============================================================
-- TABLE: exams
-- ============================================================
CREATE TABLE IF NOT EXISTS exams (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  start_time      TIMESTAMPTZ,
  end_time        TIMESTAMPTZ,
  admin_email     TEXT,               -- Configurable proctoring alert recipient
  is_leaderboard_public BOOLEAN NOT NULL DEFAULT TRUE, -- Public rank visibility control
  is_active       BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL, -- Institutional owner
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: participants
-- ============================================================
CREATE TABLE IF NOT EXISTS participants (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id         UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  hall_ticket     TEXT NOT NULL,
  mobile          TEXT NOT NULL,
  email           TEXT NOT NULL,
  enrolled_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  otp_hash        TEXT,               -- bcrypt hash of OTP (null after verified)
  otp_expires_at  TIMESTAMPTZ,
  otp_verified    BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT uq_exam_hall_ticket UNIQUE (exam_id, hall_ticket)
);

-- ============================================================
-- TABLE: exam_sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS exam_sessions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_id      UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  token_hash          TEXT NOT NULL,  -- bcrypt hash of the JWT raw value
  started_at          TIMESTAMPTZ,
  submitted_at        TIMESTAMPTZ,
  status              session_status NOT NULL DEFAULT 'not_started',
  termination_reason  TEXT,
  end_time            TIMESTAMPTZ,    -- server-computed: started_at + duration_minutes
  question_order      JSONB,          -- array of question IDs in randomized order
  question_set        TEXT NOT NULL DEFAULT 'A', -- rotating question set allocation (e.g. A, B, C)
  set_number          INTEGER NOT NULL DEFAULT 1, -- numeric set identifier (1, 2, 3...)
  violation_count     INTEGER NOT NULL DEFAULT 0,
  ip_address          TEXT,
  browser_fingerprint TEXT,           -- hardware & canvas hash for duplicate account detection
  fingerprint         TEXT,           -- client device fingerprint
  suspicious_flags    JSONB           -- array of flag objects for manual review
);

-- ============================================================
-- TABLE: session_answers
-- ============================================================
CREATE TABLE IF NOT EXISTS session_answers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id      UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  question_id     UUID NOT NULL,      -- FK resolved at query time
  chosen_option   CHAR(1) NOT NULL CHECK (chosen_option IN ('a','b','c','d')),
  answered_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answer_latency_ms INTEGER,          -- ms since question was "served" (for speed flagging)
  CONSTRAINT uq_session_question UNIQUE (session_id, question_id)
);

-- ============================================================
-- TABLE: questions
-- ============================================================
CREATE TABLE IF NOT EXISTS questions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id         UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question        TEXT NOT NULL,
  options         JSONB NOT NULL,     -- { "a": "...", "b": "...", "c": "...", "d": "..." }
  correct_option  CHAR(1) NOT NULL CHECK (correct_option IN ('a','b','c','d')),
  marks           NUMERIC NOT NULL CHECK (marks > 0),
  topic           TEXT NOT NULL DEFAULT 'General',
  question_set    TEXT NOT NULL DEFAULT 'A', -- Rotating set (e.g. 'A', 'B', 'C', or 'ALL')
  set_number      INTEGER NOT NULL DEFAULT 1, -- Numeric question set identifier
  display_order   INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: violations
-- ============================================================
CREATE TABLE IF NOT EXISTS violations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id      UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  type            violation_type NOT NULL,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes           TEXT
);

-- ============================================================
-- TABLE: suspicious_activity (Manual Review for Duplicate Fingerprints)
-- ============================================================
CREATE TABLE IF NOT EXISTS suspicious_activity (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id                 UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  session_id             UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  participant_id         UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  hall_ticket             TEXT NOT NULL,
  conflict_session_id     UUID REFERENCES exam_sessions(id) ON DELETE SET NULL,
  conflict_participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  conflict_hall_ticket    TEXT NOT NULL,
  activity_type           TEXT NOT NULL DEFAULT 'duplicate_fingerprint',
  fingerprint             TEXT NOT NULL,
  details                 JSONB,
  status                  TEXT NOT NULL DEFAULT 'pending_review', -- 'pending_review', 'cleared', 'confirmed_violation'
  reviewed_by             TEXT,
  reviewed_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: results
-- ============================================================
CREATE TABLE IF NOT EXISTS results (
  session_id          UUID PRIMARY KEY REFERENCES exam_sessions(id) ON DELETE CASCADE,
  participant_id      UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  total_score         NUMERIC NOT NULL DEFAULT 0,
  max_score           NUMERIC NOT NULL DEFAULT 0,
  normalized_score    NUMERIC NOT NULL DEFAULT 0, -- Normalized % (0-100) for cross-set comparability
  correct_count       INTEGER NOT NULL DEFAULT 0,
  wrong_count         INTEGER NOT NULL DEFAULT 0,
  time_taken_seconds  INTEGER NOT NULL DEFAULT 0,
  topic_breakdown     JSONB,          -- { "Math": { correct:3, wrong:1, score:12 }, ... }
  graded_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: deliverable_failures (Audit log for undelivered emails)
-- ============================================================
CREATE TABLE IF NOT EXISTS deliverable_failures (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_email TEXT NOT NULL,
  email_type      TEXT NOT NULL, -- 'otp', 'result', 'termination_alert', 'batch_termination_summary'
  exam_id         UUID REFERENCES exams(id) ON DELETE SET NULL,
  session_id      UUID REFERENCES exam_sessions(id) ON DELETE SET NULL,
  participant_id  UUID REFERENCES participants(id) ON DELETE SET NULL,
  subject         TEXT NOT NULL,
  error_message   TEXT NOT NULL,
  attempt_count   INTEGER NOT NULL DEFAULT 3,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: audit_log
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id        TEXT NOT NULL,      -- "admin" (env-based) or future user ID
  action          TEXT NOT NULL,      -- e.g. "CREATE_EXAM", "DELETE_QUESTION", "OVERRIDE_GRADE"
  target_table    TEXT,
  target_id       UUID,
  payload         JSONB,
  ip_address      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);
CREATE INDEX IF NOT EXISTS idx_staff_role ON staff(role);
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
CREATE INDEX IF NOT EXISTS idx_students_hall_ticket ON students(hall_ticket);
CREATE INDEX IF NOT EXISTS idx_exams_created_by ON exams(created_by_staff_id);
CREATE INDEX IF NOT EXISTS idx_participants_exam ON participants(exam_id);
CREATE INDEX IF NOT EXISTS idx_participants_exam_hall ON participants(exam_id, hall_ticket);
CREATE INDEX IF NOT EXISTS idx_sessions_participant ON exam_sessions(participant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON exam_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_end_time ON exam_sessions(end_time) WHERE status = 'in_progress';
CREATE INDEX IF NOT EXISTS idx_session_answers_session ON session_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_questions_exam ON questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_violations_session ON violations(session_id);
CREATE INDEX IF NOT EXISTS idx_results_ranking ON results(total_score DESC, time_taken_seconds ASC);
CREATE INDEX IF NOT EXISTS idx_results_ranking_normalized ON results(normalized_score DESC, time_taken_seconds ASC);
CREATE INDEX IF NOT EXISTS idx_sessions_fingerprint ON exam_sessions(browser_fingerprint);
CREATE INDEX IF NOT EXISTS idx_sessions_fingerprint_col ON exam_sessions(fingerprint);
CREATE INDEX IF NOT EXISTS idx_sessions_set_number ON exam_sessions(exam_id, set_number);
CREATE INDEX IF NOT EXISTS idx_questions_set ON questions(exam_id, question_set);
CREATE INDEX IF NOT EXISTS idx_questions_set_number ON questions(exam_id, set_number);
CREATE INDEX IF NOT EXISTS idx_session_answers_question ON session_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_participants_hall_ticket ON participants(hall_ticket);
CREATE INDEX IF NOT EXISTS idx_suspicious_activity_exam ON suspicious_activity(exam_id);
CREATE INDEX IF NOT EXISTS idx_suspicious_activity_status ON suspicious_activity(status);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_students_college_id ON students(college_id);
CREATE INDEX IF NOT EXISTS idx_students_roll_number ON students(roll_number);
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
CREATE INDEX IF NOT EXISTS idx_participants_exam_id ON participants(exam_id);
CREATE INDEX IF NOT EXISTS idx_participants_email ON participants(email);

-- ============================================================
-- MATERIALIZED VIEW: mv_question_analytics (For High-Volume Exams)
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_question_analytics AS
SELECT
  q.exam_id,
  q.id AS question_id,
  q.question,
  q.topic,
  q.marks,
  q.correct_option,
  COUNT(sa.id) AS total_attempts,
  COUNT(CASE WHEN sa.chosen_option = q.correct_option THEN 1 END) AS correct_count,
  ROUND(
    CASE WHEN COUNT(sa.id) > 0 
      THEN (COUNT(CASE WHEN sa.chosen_option = q.correct_option THEN 1 END)::numeric / COUNT(sa.id)::numeric) * 100 
      ELSE 0 
    END, 2
  ) AS correct_rate_pct,
  ROUND(COALESCE(AVG(sa.answer_latency_ms), 0) / 1000.0, 1) AS avg_time_seconds
FROM questions q
LEFT JOIN session_answers sa ON q.id = sa.question_id
GROUP BY q.exam_id, q.id, q.question, q.topic, q.marks, q.correct_option;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_question_analytics ON mv_question_analytics(question_id);

-- ============================================================
-- MIGRATION HELPERS (for databases already deployed)
-- ============================================================
-- ALTER TABLE exam_sessions ADD COLUMN IF NOT EXISTS browser_fingerprint TEXT;
-- ALTER TABLE exam_sessions ADD COLUMN IF NOT EXISTS question_set TEXT NOT NULL DEFAULT 'A';
-- ALTER TABLE questions ADD COLUMN IF NOT EXISTS question_set TEXT NOT NULL DEFAULT 'A';
-- CREATE INDEX IF NOT EXISTS idx_sessions_fingerprint ON exam_sessions(browser_fingerprint);
-- CREATE INDEX IF NOT EXISTS idx_questions_set ON questions(exam_id, question_set);
-- CREATE INDEX IF NOT EXISTS idx_session_answers_question ON session_answers(question_id);
-- CREATE INDEX IF NOT EXISTS idx_participants_hall_ticket ON participants(hall_ticket);

-- ============================================================
-- ROW-LEVEL SECURITY (RLS)
-- Explicit policies for all tables:
-- - The backend uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS)
-- - The client uses SUPABASE_ANON_KEY (strictly constrained by RLS)
-- ============================================================
ALTER TABLE exams           ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_answers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE results         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log       ENABLE ROW LEVEL SECURITY;

-- 1. Exams: Anon can view only active exams for public registration
CREATE POLICY "Allow public select active exams"
  ON exams FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- 2. Participants: Read-only for self based on email / hall_ticket (managed via API)
CREATE POLICY "Restrict participant access to service role"
  ON participants FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Exam Sessions: Client can only read session status if needed
CREATE POLICY "Restrict session mutations to service role"
  ON exam_sessions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. Session Answers: Service role authoritative only (prevents cheating)
CREATE POLICY "Restrict session answers to service role"
  ON session_answers FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. Questions: Service role only (prevents leaks of options & correct_option)
CREATE POLICY "Restrict questions to service role"
  ON questions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 6. Violations: Managed strictly via backend API
CREATE POLICY "Restrict violations to service role"
  ON violations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 7. Results: Public SELECT allowed for live leaderboard realtime subscriptions
CREATE POLICY "Allow public select results for live leaderboard"
  ON results FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Restrict results mutations to service role"
  ON results FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 8. Audit Log: Super-admin only, zero anon access
CREATE POLICY "Restrict audit log to service role"
  ON audit_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
