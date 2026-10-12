-- ============================================================
-- GROWTHRAN 1.0 — Unified Admin-Authoritative Database Schema
-- Architecture: Single Source of Truth = ADMIN
-- Database Rule: Every table has created_by_admin, updated_by_admin
-- Author: R. Charan Sai
-- Target: growthran-prod / Supabase SQL Editor
-- ============================================================

-- ─── 0. EXTENSIONS ───────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── 1. ENUMS & DOMAINS ──────────────────────────────────────
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
  CREATE TYPE staff_role AS ENUM ('super_admin', 'faculty');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2. TABLE: staff (Admin & Faculty Accounts) ───────────────
CREATE TABLE IF NOT EXISTS staff (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                TEXT NOT NULL,
  email               TEXT UNIQUE NOT NULL,
  password_hash       TEXT NOT NULL,
  role                TEXT NOT NULL DEFAULT 'super_admin' CHECK (role IN ('super_admin', 'faculty')),
  created_by_admin    UUID REFERENCES staff(id) ON DELETE SET NULL,
  updated_by_admin    UUID REFERENCES staff(id) ON DELETE SET NULL,
  failed_attempts     INTEGER NOT NULL DEFAULT 0,
  locked_until        TIMESTAMPTZ,
  reset_token_hash    TEXT,
  reset_token_expires TIMESTAMPTZ,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 3. TABLE: platform_settings (Platform & Engine Control) ──
CREATE TABLE IF NOT EXISTS platform_settings (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform_name         TEXT NOT NULL DEFAULT 'LogicWhileLiRE',
  tagline               TEXT NOT NULL DEFAULT 'Logic. While. LiRE.',
  college_name          TEXT NOT NULL DEFAULT 'Aerospace Innovation Partner',
  logo_url              TEXT DEFAULT '/brand/logicwhilelire-logo-full.svg',
  primary_color         TEXT NOT NULL DEFAULT '#2B7FFF',
  secondary_color       TEXT NOT NULL DEFAULT '#050814',
  maintenance_mode      BOOLEAN NOT NULL DEFAULT FALSE,
  maintenance_message   TEXT DEFAULT 'LogicWhileLiRE Portal is undergoing scheduled administrative maintenance.',
  allowed_languages     TEXT[] NOT NULL DEFAULT ARRAY['python', 'javascript', 'cpp', 'java', 'go'],
  execution_timeout_ms  INTEGER NOT NULL DEFAULT 5000,
  memory_limit_mb       INTEGER NOT NULL DEFAULT 256,
  enable_plagiarism_chk BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_admin      UUID REFERENCES staff(id) ON DELETE SET NULL,
  updated_by_admin      UUID REFERENCES staff(id) ON DELETE SET NULL,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 4. TABLE: students (Admin-Created Candidates Roster) ─────
CREATE TABLE IF NOT EXISTS students (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name          TEXT,
  last_name           TEXT,
  name                TEXT NOT NULL,
  email               TEXT UNIQUE NOT NULL,
  college_id          TEXT,
  college_name        TEXT,
  year_of_passing     INTEGER CHECK (year_of_passing IN (2025, 2026, 2027, 2028, 2029, 2030)),
  roll_number         TEXT,
  hall_ticket         TEXT UNIQUE,
  branch_code         TEXT,
  section             TEXT CHECK (section IN ('A', 'B', 'C', 'D', 'E')),
  contact_number      TEXT,
  mobile              TEXT,
  password_hash       TEXT NOT NULL,
  is_blocked          BOOLEAN NOT NULL DEFAULT FALSE,
  block_reason        TEXT,
  allowed_attempts    INTEGER NOT NULL DEFAULT 1,
  failed_attempts     INTEGER NOT NULL DEFAULT 0,
  locked_until        TIMESTAMPTZ,
  reset_token_hash    TEXT,
  reset_token_expires TIMESTAMPTZ,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_admin    UUID REFERENCES staff(id) ON DELETE SET NULL,
  updated_by_admin    UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_admin_college_roll UNIQUE (college_id, roll_number)
);

-- ─── 5. TABLE: colleges ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS colleges (
  id                  SERIAL PRIMARY KEY,
  college_name        VARCHAR(150) NOT NULL,
  college_code        VARCHAR(20) UNIQUE NOT NULL,
  city                VARCHAR(100),
  state               VARCHAR(100) DEFAULT 'Telangana',
  contact_email       TEXT,
  contact_phone       TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_admin    UUID REFERENCES staff(id) ON DELETE SET NULL,
  updated_by_admin    UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 6. TABLE: exams (Admin-Controlled Assessments) ───────────
CREATE TABLE IF NOT EXISTS exams (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title                 TEXT NOT NULL,
  exam_code             VARCHAR(30) UNIQUE,
  duration_minutes      INTEGER NOT NULL CHECK (duration_minutes > 0),
  passing_percentage    NUMERIC NOT NULL DEFAULT 40,
  start_time            TIMESTAMPTZ,
  end_time              TIMESTAMPTZ,
  admin_email           TEXT,
  -- Admin Feature Toggles
  is_launched           BOOLEAN NOT NULL DEFAULT FALSE,
  is_active             BOOLEAN NOT NULL DEFAULT FALSE,
  results_published     BOOLEAN NOT NULL DEFAULT FALSE,
  proctoring_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  leaderboard_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  leaderboard_frozen    BOOLEAN NOT NULL DEFAULT FALSE,
  leaderboard_roll_only BOOLEAN NOT NULL DEFAULT FALSE,
  negative_marking      NUMERIC NOT NULL DEFAULT 0,
  shuffle_questions     BOOLEAN NOT NULL DEFAULT TRUE,
  fullscreen_lock       BOOLEAN NOT NULL DEFAULT TRUE,
  tab_switch_detection  BOOLEAN NOT NULL DEFAULT TRUE,
  allowed_languages     TEXT[] NOT NULL DEFAULT ARRAY['python', 'javascript', 'cpp', 'java'],
  execution_timeout_ms  INTEGER NOT NULL DEFAULT 5000,
  created_by_admin      UUID REFERENCES staff(id) ON DELETE SET NULL,
  updated_by_admin      UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 7. TABLE: exam_codes (Fast Portal Access Master Codes) ───
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
  created_by_admin    UUID REFERENCES staff(id) ON DELETE SET NULL,
  updated_by_admin    UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 8. TABLE: questions (MCQ / Coding / Aptitude Bank) ──────
CREATE TABLE IF NOT EXISTS questions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id           UUID REFERENCES exams(id) ON DELETE CASCADE,
  exam_code         VARCHAR(30) REFERENCES exam_codes(exam_code) ON DELETE CASCADE,
  question          TEXT NOT NULL,
  question_type     TEXT NOT NULL DEFAULT 'mcq' CHECK (question_type IN ('mcq', 'code', 'aptitude')),
  options           JSONB NOT NULL DEFAULT '{"a":"","b":"","c":"","d":""}',
  correct_option    CHAR(1) NOT NULL CHECK (correct_option IN ('a','b','c','d')),
  marks             NUMERIC NOT NULL DEFAULT 1 CHECK (marks > 0),
  topic             TEXT NOT NULL DEFAULT 'General',
  difficulty        TEXT NOT NULL DEFAULT 'Medium' CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  tags              JSONB DEFAULT '[]',
  time_limit        INT,
  explanation       TEXT,
  question_set      TEXT NOT NULL DEFAULT 'A',
  set_number        INTEGER NOT NULL DEFAULT 1,
  display_order     INTEGER,
  created_by_admin  UUID REFERENCES staff(id) ON DELETE SET NULL,
  updated_by_admin  UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 9. TABLE: test_cases (Public & Hidden Coding Tests) ──────
CREATE TABLE IF NOT EXISTS test_cases (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id       UUID REFERENCES questions(id) ON DELETE CASCADE,
  input_text        TEXT,
  expected_output   TEXT NOT NULL,
  marks             INT DEFAULT 1,
  is_hidden         BOOLEAN DEFAULT FALSE, -- Admin-only visible during authoring
  created_by_admin  UUID REFERENCES staff(id) ON DELETE SET NULL,
  updated_by_admin  UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 10. TABLE: participants (Roster Enrolled by Admin) ───────
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
  created_by_admin  UUID REFERENCES staff(id) ON DELETE SET NULL,
  updated_by_admin  UUID REFERENCES staff(id) ON DELETE SET NULL,
  CONSTRAINT uq_admin_exam_hall_ticket UNIQUE (exam_id, hall_ticket)
);

-- ─── 11. TABLE: exam_sessions (Live Session Telemetry) ────────
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
  suspicious_flags    JSONB,
  updated_by_admin    UUID REFERENCES staff(id) ON DELETE SET NULL
);

-- ─── 12. TABLE: exam_code_attempts ───────────────────────────
CREATE TABLE IF NOT EXISTS exam_code_attempts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hall_ticket_no      TEXT NOT NULL,
  exam_code           VARCHAR(30) NOT NULL REFERENCES exam_codes(exam_code) ON DELETE CASCADE,
  student_name        TEXT,
  start_time          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time            TIMESTAMPTZ,
  score               NUMERIC DEFAULT 0,
  score_override      NUMERIC,
  grace_marks         NUMERIC DEFAULT 0,
  max_score           NUMERIC DEFAULT 0,
  correct_count       INT DEFAULT 0,
  wrong_count         INT DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'terminated_cheating')),
  violation_count     INT NOT NULL DEFAULT 0,
  answers             JSONB DEFAULT '{}',
  time_taken_seconds  INT DEFAULT 0,
  topic_breakdown     JSONB DEFAULT '{}',
  updated_by_admin    UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_admin_hall_ticket_exam_code UNIQUE (hall_ticket_no, exam_code)
);

-- ─── 13. TABLE: session_answers ──────────────────────────────
CREATE TABLE IF NOT EXISTS session_answers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id        UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  question_id       UUID NOT NULL,
  chosen_option     CHAR(1) NOT NULL CHECK (chosen_option IN ('a','b','c','d')),
  answered_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answer_latency_ms INTEGER,
  CONSTRAINT uq_admin_session_question UNIQUE (session_id, question_id)
);

-- ─── 14. TABLE: violations ───────────────────────────────────
CREATE TABLE IF NOT EXISTS violations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id  UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  type        violation_type NOT NULL,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes       TEXT
);

-- ─── 15. TABLE: proctor_logs ─────────────────────────────────
CREATE TABLE IF NOT EXISTS proctor_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id  TEXT,
  exam_id       TEXT,
  event_type    TEXT NOT NULL,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 16. TABLE: results (Results & Score Overrides) ───────────
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
  updated_by_admin    UUID REFERENCES staff(id) ON DELETE SET NULL,
  graded_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- ─── 17. CERTIFICATES: DISCONTINUED (Phase C Spec) ───────────
-- Digital certificate issuance has been permanently retired.
-- For legacy database migration, see server/db/migration_remove_certificates.sql.

-- ─── 18. TABLE: leaderboard ──────────────────────────────────
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

-- ─── 19. TABLE: audit_log (Administrative Security Audit) ─────
CREATE TABLE IF NOT EXISTS audit_log (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id          TEXT NOT NULL,
  admin_name        TEXT,
  action            TEXT NOT NULL, -- CREATE_EXAM, LAUNCH_EXAM, BLOCK_STUDENT, OVERRIDE_SCORE, etc.
  target_table      TEXT,
  target_id         TEXT,
  payload           JSONB,
  ip_address        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 20. ROW LEVEL SECURITY (RLS) ────────────────────────────
ALTER TABLE staff               ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE students            ENABLE ROW LEVEL SECURITY;
ALTER TABLE colleges            ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams               ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_codes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_cases          ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants        ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_code_attempts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_answers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE proctor_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE results             ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log           ENABLE ROW LEVEL SECURITY;

-- Service Role Full Permissions
CREATE POLICY "staff admin service role"          ON staff              FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "platform settings service role"    ON platform_settings  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "students admin service role"       ON students           FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "colleges admin service role"       ON colleges           FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "exams admin service role"          ON exams              FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "exam_codes admin service role"     ON exam_codes         FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "questions admin service role"      ON questions          FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "test_cases admin service role"     ON test_cases         FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "participants admin service role"   ON participants       FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "exam_sessions admin service role"  ON exam_sessions      FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "exam_code_attempts service role"   ON exam_code_attempts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "session_answers admin service role" ON session_answers   FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "violations admin service role"     ON violations         FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "proctor_logs admin service role"   ON proctor_logs       FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "results admin service role"        ON results            FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "leaderboard admin service role"    ON leaderboard        FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "audit_log admin service role"      ON audit_log          FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Student / Public Controlled Read Policies:
-- Student can only see launched active exams
CREATE POLICY "student read launched active exams" ON exams FOR SELECT TO anon, authenticated USING (is_launched = true AND is_active = true);
CREATE POLICY "student read active exam_codes" ON exam_codes FOR SELECT TO anon, authenticated USING (is_active = true);
-- Student sees results ONLY after Admin marks results_published = true
CREATE POLICY "student read published results" ON results FOR SELECT TO anon, authenticated USING (is_published = true);
CREATE POLICY "student read platform branding" ON platform_settings FOR SELECT TO anon, authenticated USING (true);
