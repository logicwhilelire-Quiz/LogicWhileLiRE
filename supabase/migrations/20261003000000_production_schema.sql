-- ==============================================================================
-- LOGICWHILELIRE — PRODUCTION SUPABASE (POSTGRESQL) SCHEMA MIGRATION
-- Migration: 20261003000000_production_schema.sql
-- Compatible with: Supabase / PostgreSQL 15+
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
    'college_admin',
    'exam_coordinator',
    'proctor'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2. TABLE: colleges ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS colleges (
  id                  SERIAL PRIMARY KEY,
  college_name        VARCHAR(150) NOT NULL,
  college_code        VARCHAR(20) UNIQUE NOT NULL,
  city                VARCHAR(100),
  state               VARCHAR(100) DEFAULT 'Telangana',
  contact_email       TEXT,
  contact_phone       TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 3. TABLE: staff (Admins, Faculty & Staff Accounts) ────────────────────────
CREATE TABLE IF NOT EXISTS staff (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                TEXT NOT NULL,
  email               TEXT UNIQUE NOT NULL,
  password_hash       TEXT NOT NULL,
  role                TEXT NOT NULL DEFAULT 'faculty' CHECK (role IN ('super_admin', 'faculty', 'college_admin', 'exam_coordinator', 'proctor')),
  college_id          INT REFERENCES colleges(id) ON DELETE SET NULL,
  failed_attempts     INTEGER NOT NULL DEFAULT 0,
  locked_until        TIMESTAMPTZ,
  reset_token_hash    TEXT,
  reset_token_expires TIMESTAMPTZ,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_by          UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 4. TABLE: students (Enrolled Student Directory) ──────────────────────────
CREATE TABLE IF NOT EXISTS students (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name          TEXT,
  last_name           TEXT,
  name                TEXT NOT NULL,
  email               TEXT UNIQUE NOT NULL,
  college_id          INT REFERENCES colleges(id) ON DELETE CASCADE,
  college_name        TEXT,
  year_of_passing     INTEGER,
  roll_number         TEXT NOT NULL,
  hall_ticket         TEXT UNIQUE,
  branch_code         TEXT,
  section             VARCHAR(10),
  contact_number      TEXT,
  mobile              TEXT,
  password_hash       TEXT NOT NULL,
  failed_attempts     INTEGER NOT NULL DEFAULT 0,
  locked_until        TIMESTAMPTZ,
  reset_token_hash    TEXT,
  reset_token_expires TIMESTAMPTZ,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  is_blocked          BOOLEAN NOT NULL DEFAULT FALSE,
  block_reason        TEXT,
  allowed_attempts    INTEGER NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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

-- ─── 6. TABLE: exams (Traditional / GATE Exams) ───────────────────────────────
CREATE TABLE IF NOT EXISTS exams (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title                 TEXT NOT NULL,
  duration_minutes      INTEGER NOT NULL CHECK (duration_minutes > 0),
  passing_percentage    NUMERIC NOT NULL DEFAULT 40,
  start_time            TIMESTAMPTZ,
  end_time              TIMESTAMPTZ,
  admin_email           TEXT,
  is_leaderboard_public BOOLEAN NOT NULL DEFAULT TRUE,
  is_active             BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_staff_id   UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 7. TABLE: questions (Traditional Exam Bank) ──────────────────────────────
CREATE TABLE IF NOT EXISTS questions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id           UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question          TEXT NOT NULL,
  options           JSONB NOT NULL DEFAULT '{"a":"","b":"","c":"","d":""}',
  correct_option    CHAR(1) NOT NULL CHECK (correct_option IN ('a','b','c','d')),
  marks             NUMERIC NOT NULL DEFAULT 1 CHECK (marks > 0),
  topic             TEXT NOT NULL DEFAULT 'General',
  difficulty        TEXT NOT NULL DEFAULT 'Medium' CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  question_set      TEXT NOT NULL DEFAULT 'A',
  set_number        INTEGER NOT NULL DEFAULT 1,
  display_order     INTEGER,
  explanation       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 8. TABLE: participants (Exam-specific Candidate Registrations) ───────────
CREATE TABLE IF NOT EXISTS participants (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id           UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id        UUID REFERENCES students(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  hall_ticket       TEXT NOT NULL,
  mobile            TEXT NOT NULL,
  email             TEXT NOT NULL,
  branch            TEXT,
  is_blocked        BOOLEAN NOT NULL DEFAULT FALSE,
  extra_time_mins   INTEGER NOT NULL DEFAULT 0,
  enrolled_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  otp_hash          TEXT,
  otp_expires_at    TIMESTAMPTZ,
  otp_verified      BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT uq_exam_hall_ticket UNIQUE (exam_id, hall_ticket)
);

-- ─── 9. TABLE: exam_sessions (Active Exam Sessions) ───────────────────────────
CREATE TABLE IF NOT EXISTS exam_sessions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_id      UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  exam_id             UUID REFERENCES exams(id) ON DELETE CASCADE,
  token_hash          TEXT NOT NULL,
  started_at          TIMESTAMPTZ,
  submitted_at        TIMESTAMPTZ,
  status              session_status NOT NULL DEFAULT 'not_started',
  termination_reason  TEXT,
  end_time            TIMESTAMPTZ,
  extended_minutes    INTEGER NOT NULL DEFAULT 0,
  question_order      JSONB,
  question_set        TEXT NOT NULL DEFAULT 'A',
  set_number          INTEGER NOT NULL DEFAULT 1,
  violation_count     INTEGER NOT NULL DEFAULT 0,
  ip_address          TEXT,
  browser_fingerprint TEXT,
  fingerprint         TEXT,
  suspicious_flags    JSONB DEFAULT '[]',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 10. TABLE: session_answers (Traditional Exam Per-Question Answers) ───────
CREATE TABLE IF NOT EXISTS session_answers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id        UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  question_id       UUID NOT NULL,
  chosen_option     CHAR(1) NOT NULL CHECK (chosen_option IN ('a','b','c','d')),
  answered_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answer_latency_ms INTEGER,
  CONSTRAINT uq_session_question UNIQUE (session_id, question_id)
);

-- ─── 11. TABLE: results (Traditional Exam Graded Results) ─────────────────────
CREATE TABLE IF NOT EXISTS results (
  session_id          UUID PRIMARY KEY REFERENCES exam_sessions(id) ON DELETE CASCADE,
  participant_id      UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  total_score         NUMERIC NOT NULL DEFAULT 0,
  score_override      NUMERIC,
  grace_marks         NUMERIC NOT NULL DEFAULT 0,
  override_reason     TEXT,
  max_score           NUMERIC NOT NULL DEFAULT 0,
  normalized_score    NUMERIC NOT NULL DEFAULT 0,
  correct_count       INTEGER NOT NULL DEFAULT 0,
  wrong_count         INTEGER NOT NULL DEFAULT 0,
  time_taken_seconds  INTEGER NOT NULL DEFAULT 0,
  topic_breakdown     JSONB,
  is_published        BOOLEAN NOT NULL DEFAULT FALSE,
  graded_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 12. TABLE: exam_codes (Fast Portal Access Master Codes) ──────────────────
CREATE TABLE IF NOT EXISTS exam_codes (
  id                  SERIAL PRIMARY KEY,
  exam_code           VARCHAR(30) UNIQUE NOT NULL,
  college_id          INT REFERENCES colleges(id) ON DELETE CASCADE,
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
  max_violations      INT NOT NULL DEFAULT 5,
  auto_terminate      BOOLEAN NOT NULL DEFAULT TRUE,
  grace_period_seconds INT NOT NULL DEFAULT 60,
  allowed_languages   TEXT[] NOT NULL DEFAULT ARRAY['python', 'javascript', 'cpp', 'java'],
  created_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 13. TABLE: questions_ec (Questions Linked to Exam Codes) ─────────────────
CREATE TABLE IF NOT EXISTS questions_ec (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_code       VARCHAR(30) NOT NULL REFERENCES exam_codes(exam_code) ON DELETE CASCADE,
  question        TEXT NOT NULL,
  option_a        TEXT NOT NULL,
  option_b        TEXT NOT NULL,
  option_c        TEXT NOT NULL,
  option_d        TEXT NOT NULL,
  correct_answer  CHAR(1) NOT NULL,
  marks           NUMERIC NOT NULL DEFAULT 1,
  difficulty      TEXT DEFAULT 'Medium' CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  topic           TEXT NOT NULL DEFAULT 'General',
  section         TEXT DEFAULT 'General',
  tags            JSONB DEFAULT '[]',
  display_order   INTEGER,
  explanation     TEXT,
  question_type   VARCHAR(20) NOT NULL DEFAULT 'mcq' CHECK (question_type IN ('mcq', 'coding')),
  starter_code    TEXT,
  test_cases      JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 14. TABLE: exam_code_attempts (Student Attempts for Exam Codes) ──────────
CREATE TABLE IF NOT EXISTS exam_code_attempts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hall_ticket_no      TEXT NOT NULL,
  exam_code           VARCHAR(30) NOT NULL REFERENCES exam_codes(exam_code) ON DELETE CASCADE,
  student_name        TEXT,
  student_id          UUID REFERENCES students(id) ON DELETE SET NULL,
  start_time          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time            TIMESTAMPTZ,
  score               NUMERIC DEFAULT 0,
  score_override      NUMERIC,
  grace_marks         NUMERIC DEFAULT 0,
  override_reason     TEXT,
  max_score           NUMERIC DEFAULT 0,
  correct_count       INT DEFAULT 0,
  wrong_count         INT DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'terminated_cheating')),
  violation_count     INT NOT NULL DEFAULT 0,
  answers             JSONB DEFAULT '{}',
  code_answers        JSONB DEFAULT '{}',
  time_taken_seconds  INT DEFAULT 0,
  topic_breakdown     JSONB DEFAULT '{}',
  session_token       TEXT,
  violation_timeline  JSONB DEFAULT '[]',
  screen_thumbnails   JSONB DEFAULT '[]',
  ip_address          TEXT,
  client_fingerprint  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_hall_ticket_exam_code UNIQUE (hall_ticket_no, exam_code)
);

-- ─── 15. TABLE: violations (Legacy/Detailed Violation Events) ──────────────────
CREATE TABLE IF NOT EXISTS violations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id  UUID REFERENCES exam_sessions(id) ON DELETE CASCADE,
  attempt_id  UUID REFERENCES exam_code_attempts(id) ON DELETE CASCADE,
  type        violation_type NOT NULL,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes       TEXT
);

-- ─── 16. TABLE: suspicious_activity (Duplicate Fingerprint Flags) ─────────────
CREATE TABLE IF NOT EXISTS suspicious_activity (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id                 UUID REFERENCES exams(id) ON DELETE CASCADE,
  session_id              UUID REFERENCES exam_sessions(id) ON DELETE CASCADE,
  participant_id          UUID REFERENCES participants(id) ON DELETE CASCADE,
  hall_ticket             TEXT NOT NULL,
  conflict_session_id     UUID REFERENCES exam_sessions(id) ON DELETE SET NULL,
  conflict_participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  conflict_hall_ticket    TEXT NOT NULL,
  activity_type           TEXT NOT NULL DEFAULT 'duplicate_fingerprint',
  fingerprint             TEXT NOT NULL,
  details                 JSONB,
  status                  TEXT NOT NULL DEFAULT 'pending_review',
  reviewed_by             TEXT,
  reviewed_at             TIMESTAMPTZ,
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

-- ─── 18. TABLE: deliverable_failures (Async Email Queue Dead-Letter Store) ────
CREATE TABLE IF NOT EXISTS deliverable_failures (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_email TEXT NOT NULL,
  email_type      TEXT NOT NULL,
  exam_id         UUID REFERENCES exams(id) ON DELETE SET NULL,
  session_id      UUID REFERENCES exam_sessions(id) ON DELETE SET NULL,
  participant_id  UUID REFERENCES participants(id) ON DELETE SET NULL,
  subject         TEXT NOT NULL,
  error_message   TEXT NOT NULL,
  attempt_count   INTEGER NOT NULL DEFAULT 3,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 19. TABLE: audit_log (Comprehensive Append-Only Security Trail) ──────────
CREATE TABLE IF NOT EXISTS audit_log (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id          TEXT NOT NULL,
  admin_name        TEXT,
  action            TEXT NOT NULL,
  target_table      TEXT,
  target_id         TEXT,
  before_state      JSONB,
  payload           JSONB,
  ip_address        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 20. TABLE: leaderboard (Cached Cross-College Standing Ranks) ──────────────
CREATE TABLE IF NOT EXISTS leaderboard (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id       TEXT NOT NULL,
  candidate_id  TEXT,
  hall_ticket   TEXT,
  score         NUMERIC(5,2),
  percentage    NUMERIC(5,2),
  rank          INT,
  department    TEXT,
  is_frozen     BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 21. HIGH-PERFORMANCE INDEXES ON HOT QUERY PATHS
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_colleges_code ON colleges(college_code);
CREATE INDEX IF NOT EXISTS idx_colleges_active ON colleges(is_active);

CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);
CREATE INDEX IF NOT EXISTS idx_staff_role ON staff(role);
CREATE INDEX IF NOT EXISTS idx_staff_college ON staff(college_id);

CREATE INDEX IF NOT EXISTS idx_students_college_roll ON students(college_id, roll_number);
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
CREATE INDEX IF NOT EXISTS idx_students_hall_ticket ON students(hall_ticket);
CREATE INDEX IF NOT EXISTS idx_students_active ON students(is_active);

CREATE INDEX IF NOT EXISTS idx_exams_active ON exams(is_active, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_exams_code ON exams(exam_code);

CREATE INDEX IF NOT EXISTS idx_participants_exam_hall ON participants(exam_id, hall_ticket);
CREATE INDEX IF NOT EXISTS idx_participants_student ON participants(student_id);

CREATE INDEX IF NOT EXISTS idx_exam_sessions_part ON exam_sessions(participant_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_exam ON exam_sessions(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_status ON exam_sessions(status);

CREATE INDEX IF NOT EXISTS idx_session_answers_session ON session_answers(session_id);

CREATE INDEX IF NOT EXISTS idx_questions_exam ON questions(exam_id);

CREATE INDEX IF NOT EXISTS idx_results_part ON results(participant_id);

CREATE INDEX IF NOT EXISTS idx_exam_codes_code ON exam_codes(exam_code);
CREATE INDEX IF NOT EXISTS idx_exam_codes_college ON exam_codes(college_id);
CREATE INDEX IF NOT EXISTS idx_exam_codes_active ON exam_codes(is_active, start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_questions_ec_code ON questions_ec(exam_code);
CREATE INDEX IF NOT EXISTS idx_questions_ec_order ON questions_ec(exam_code, display_order);

CREATE INDEX IF NOT EXISTS idx_exam_code_attempts_hall ON exam_code_attempts(hall_ticket_no, exam_code);
CREATE INDEX IF NOT EXISTS idx_exam_code_attempts_exam ON exam_code_attempts(exam_code);
CREATE INDEX IF NOT EXISTS idx_exam_code_attempts_status ON exam_code_attempts(status);
CREATE INDEX IF NOT EXISTS idx_exam_code_attempts_token ON exam_code_attempts(session_token);
CREATE INDEX IF NOT EXISTS idx_exam_code_attempts_submitted ON exam_code_attempts(end_time);

CREATE INDEX IF NOT EXISTS idx_audit_log_target ON audit_log(target_table, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);

-- ==============================================================================
-- 22. ROW LEVEL SECURITY (RLS) POLICIES — DENY-BY-DEFAULT
-- ==============================================================================
-- Enable RLS across all tables
ALTER TABLE colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions_ec ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_code_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE suspicious_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE proctor_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliverable_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

-- Service Role Full Access (The Node.js backend uses SUPABASE_SERVICE_ROLE_KEY)
CREATE POLICY "service_role_colleges" ON colleges FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_staff" ON staff FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_students" ON students FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_settings" ON platform_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_exams" ON exams FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_questions" ON questions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_participants" ON participants FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_exam_sessions" ON exam_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_session_answers" ON session_answers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_results" ON results FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_exam_codes" ON exam_codes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_questions_ec" ON questions_ec FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_exam_code_attempts" ON exam_code_attempts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_violations" ON violations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_suspicious" ON suspicious_activity FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_proctor_logs" ON proctor_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_deliverables" ON deliverable_failures FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_audit_log" ON audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_leaderboard" ON leaderboard FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Public Read Policies (Only where strictly required for anonymous client flows)
CREATE POLICY "public_read_active_colleges" ON colleges FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "public_read_active_exam_codes" ON exam_codes FOR SELECT TO anon, authenticated USING (is_active = true);
