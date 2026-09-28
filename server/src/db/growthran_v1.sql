-- ============================================================
-- GROWRAN 1.0 — Unified Clean Production Database Schema
-- Architecture: GROWRAN Clean Portal Architecture
-- Author: R. Charan Sai
-- Target: growran-prod / Supabase SQL Editor
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

-- ─── 2. TABLE: staff ─────────────────────────────────────────
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

-- ─── 3. TABLE: students (Candidates Roster) ───────────────────
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
  failed_attempts     INTEGER NOT NULL DEFAULT 0,
  locked_until        TIMESTAMPTZ,
  reset_token_hash    TEXT,
  reset_token_expires TIMESTAMPTZ,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_college_roll UNIQUE (college_id, roll_number)
);

-- ─── 4. TABLE: colleges ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS colleges (
  id              SERIAL PRIMARY KEY,
  college_name    VARCHAR(150) NOT NULL,
  college_code    VARCHAR(20) UNIQUE NOT NULL,
  city            VARCHAR(100),
  state           VARCHAR(100) DEFAULT 'Telangana',
  contact_email   TEXT,
  contact_phone   TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 5. TABLE: exams ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exams (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title                 TEXT NOT NULL,
  duration_minutes      INTEGER NOT NULL CHECK (duration_minutes > 0),
  start_time            TIMESTAMPTZ,
  end_time              TIMESTAMPTZ,
  admin_email           TEXT,
  is_leaderboard_public BOOLEAN NOT NULL DEFAULT TRUE,
  is_active             BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_staff_id   UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 6. TABLE: exam_codes (Fast Portal Access Codes) ──────────
CREATE TABLE IF NOT EXISTS exam_codes (
  id                  SERIAL PRIMARY KEY,
  exam_code           VARCHAR(30) UNIQUE NOT NULL,
  college_id          INT REFERENCES colleges(id) ON DELETE CASCADE,
  exam_name           VARCHAR(150) NOT NULL,
  subject             VARCHAR(100),
  total_questions     INT NOT NULL DEFAULT 30,
  duration_minutes    INT NOT NULL DEFAULT 60,
  start_time          TIMESTAMPTZ NOT NULL,
  end_time            TIMESTAMPTZ NOT NULL,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 7. TABLE: questions (Assessment Bank) ───────────────────
CREATE TABLE IF NOT EXISTS questions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id         UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question        TEXT NOT NULL,
  question_type   TEXT NOT NULL DEFAULT 'mcq' CHECK (question_type IN ('mcq', 'code', 'aptitude')),
  options         JSONB NOT NULL DEFAULT '{"a":"","b":"","c":"","d":""}',
  correct_option  CHAR(1) NOT NULL CHECK (correct_option IN ('a','b','c','d')),
  marks           NUMERIC NOT NULL DEFAULT 1 CHECK (marks > 0),
  topic           TEXT NOT NULL DEFAULT 'General',
  difficulty      TEXT NOT NULL DEFAULT 'Medium' CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  time_limit      INT, -- seconds per question if timed
  explanation     TEXT,
  question_set    TEXT NOT NULL DEFAULT 'A',
  set_number      INTEGER NOT NULL DEFAULT 1,
  display_order   INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 8. TABLE: questions_ec (Mapped to Exam Codes) ───────────
CREATE TABLE IF NOT EXISTS questions_ec (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_code       VARCHAR(30) NOT NULL REFERENCES exam_codes(exam_code) ON DELETE CASCADE,
  question        TEXT NOT NULL,
  option_a        TEXT NOT NULL,
  option_b        TEXT NOT NULL,
  option_c        TEXT NOT NULL,
  option_d        TEXT NOT NULL,
  correct_answer  CHAR(1) NOT NULL CHECK (correct_answer IN ('A','B','C','D')),
  marks           NUMERIC NOT NULL DEFAULT 1,
  difficulty      TEXT DEFAULT 'Medium' CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  topic           TEXT NOT NULL DEFAULT 'General',
  section         TEXT,
  tags            JSONB DEFAULT '[]',
  explanation     TEXT,
  display_order   INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 9. TABLE: test_cases (Code Execution Evaluation) ────────
CREATE TABLE IF NOT EXISTS test_cases (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id     UUID REFERENCES questions(id) ON DELETE CASCADE,
  input_text      TEXT,
  expected_output TEXT NOT NULL,
  marks           INT DEFAULT 1,
  is_hidden       BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 10. TABLE: participants (Enrolled Exam Candidates) ───────
CREATE TABLE IF NOT EXISTS participants (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id         UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  hall_ticket     TEXT NOT NULL,
  mobile          TEXT NOT NULL,
  email           TEXT NOT NULL,
  enrolled_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  otp_hash        TEXT,
  otp_expires_at  TIMESTAMPTZ,
  otp_verified    BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT uq_exam_hall_ticket UNIQUE (exam_id, hall_ticket)
);

-- ─── 11. TABLE: exam_sessions (Authoritative Session State) ───
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
  question_order      JSONB,
  question_set        TEXT NOT NULL DEFAULT 'A',
  set_number          INTEGER NOT NULL DEFAULT 1,
  violation_count     INTEGER NOT NULL DEFAULT 0,
  ip_address          TEXT,
  browser_fingerprint TEXT,
  fingerprint         TEXT,
  suspicious_flags    JSONB
);

-- ─── 12. TABLE: exam_code_attempts (Direct Code Candidate Runs)
CREATE TABLE IF NOT EXISTS exam_code_attempts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hall_ticket_no      TEXT NOT NULL,
  exam_code           VARCHAR(30) NOT NULL REFERENCES exam_codes(exam_code) ON DELETE CASCADE,
  student_name        TEXT,
  start_time          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time            TIMESTAMPTZ,
  score               NUMERIC DEFAULT 0,
  max_score           NUMERIC DEFAULT 0,
  correct_count       INT DEFAULT 0,
  wrong_count         INT DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'terminated_cheating')),
  violation_count     INT NOT NULL DEFAULT 0,
  answers             JSONB DEFAULT '{}',
  time_taken_seconds  INT DEFAULT 0,
  topic_breakdown     JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_hall_ticket_exam_code UNIQUE (hall_ticket_no, exam_code)
);

-- ─── 13. TABLE: session_answers ──────────────────────────────
CREATE TABLE IF NOT EXISTS session_answers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id        UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  question_id       UUID NOT NULL,
  chosen_option     CHAR(1) NOT NULL CHECK (chosen_option IN ('a','b','c','d')),
  answered_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answer_latency_ms INTEGER,
  CONSTRAINT uq_session_question UNIQUE (session_id, question_id)
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

-- ─── 16. TABLE: suspicious_activity ──────────────────────────
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
  status                  TEXT NOT NULL DEFAULT 'pending_review',
  reviewed_by             TEXT,
  reviewed_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 17. TABLE: results ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS results (
  session_id          UUID PRIMARY KEY REFERENCES exam_sessions(id) ON DELETE CASCADE,
  participant_id      UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  total_score         NUMERIC NOT NULL DEFAULT 0,
  max_score           NUMERIC NOT NULL DEFAULT 0,
  normalized_score    NUMERIC NOT NULL DEFAULT 0,
  correct_count       INTEGER NOT NULL DEFAULT 0,
  wrong_count         INTEGER NOT NULL DEFAULT 0,
  time_taken_seconds  INTEGER NOT NULL DEFAULT 0,
  topic_breakdown     JSONB,
  graded_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 18. TABLE: leaderboard (Real-Time Synchronized Ranks) ────
CREATE TABLE IF NOT EXISTS leaderboard (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id       TEXT NOT NULL,
  candidate_id  TEXT,
  hall_ticket   TEXT,
  score         NUMERIC(5,2),
  percentage    NUMERIC(5,2),
  rank          INT,
  department    TEXT,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 19. TABLE: deliverable_failures ─────────────────────────
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

-- ─── 20. TABLE: audit_log ────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id        TEXT NOT NULL,
  action          TEXT NOT NULL,
  target_table    TEXT,
  target_id       UUID,
  payload         JSONB,
  ip_address      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 21. PERFORMANCE INDEXES ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);
CREATE INDEX IF NOT EXISTS idx_staff_role ON staff(role);
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
CREATE INDEX IF NOT EXISTS idx_students_hall_ticket ON students(hall_ticket);
CREATE INDEX IF NOT EXISTS idx_colleges_code ON colleges(college_code);
CREATE INDEX IF NOT EXISTS idx_exams_created_by ON exams(created_by_staff_id);
CREATE INDEX IF NOT EXISTS idx_exam_codes_code ON exam_codes(exam_code);
CREATE INDEX IF NOT EXISTS idx_exam_codes_college ON exam_codes(college_id);
CREATE INDEX IF NOT EXISTS idx_exam_codes_active ON exam_codes(is_active, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_participants_exam ON participants(exam_id);
CREATE INDEX IF NOT EXISTS idx_participants_exam_hall ON participants(exam_id, hall_ticket);
CREATE INDEX IF NOT EXISTS idx_participants_hall_ticket ON participants(hall_ticket);
CREATE INDEX IF NOT EXISTS idx_sessions_participant ON exam_sessions(participant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON exam_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_end_time ON exam_sessions(end_time) WHERE status = 'in_progress';
CREATE INDEX IF NOT EXISTS idx_sessions_fingerprint ON exam_sessions(browser_fingerprint);
CREATE INDEX IF NOT EXISTS idx_sessions_set_number ON exam_sessions(set_number);
CREATE INDEX IF NOT EXISTS idx_exam_code_attempts_hall ON exam_code_attempts(hall_ticket_no, exam_code);
CREATE INDEX IF NOT EXISTS idx_questions_exam ON questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_questions_set ON questions(exam_id, question_set);
CREATE INDEX IF NOT EXISTS idx_questions_ec_code ON questions_ec(exam_code);
CREATE INDEX IF NOT EXISTS idx_test_cases_question ON test_cases(question_id);
CREATE INDEX IF NOT EXISTS idx_session_answers_session ON session_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_session_answers_question ON session_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_violations_session ON violations(session_id);
CREATE INDEX IF NOT EXISTS idx_proctor_logs_exam ON proctor_logs(exam_id);
CREATE INDEX IF NOT EXISTS idx_proctor_logs_candidate ON proctor_logs(candidate_id);
CREATE INDEX IF NOT EXISTS idx_suspicious_activity_exam ON suspicious_activity(exam_id);
CREATE INDEX IF NOT EXISTS idx_suspicious_activity_status ON suspicious_activity(status);
CREATE INDEX IF NOT EXISTS idx_results_ranking ON results(total_score DESC, time_taken_seconds ASC);
CREATE INDEX IF NOT EXISTS idx_results_ranking_normalized ON results(normalized_score DESC, time_taken_seconds ASC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_leaderboard_exam_candidate ON leaderboard(exam_id, hall_ticket);
CREATE INDEX IF NOT EXISTS idx_leaderboard_exam_rank ON leaderboard(exam_id, rank);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);

-- ─── 22. MATERIALIZED VIEW: mv_question_analytics ────────────
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

-- ─── 23. ROW LEVEL SECURITY (RLS) ────────────────────────────
ALTER TABLE staff               ENABLE ROW LEVEL SECURITY;
ALTER TABLE students            ENABLE ROW LEVEL SECURITY;
ALTER TABLE colleges            ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams               ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_codes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions_ec        ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_cases          ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants        ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_code_attempts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_answers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE proctor_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE suspicious_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE results             ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard         ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliverable_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log           ENABLE ROW LEVEL SECURITY;

-- Service Role Full Access Policies
CREATE POLICY "staff service role"               ON staff               FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "students service role"            ON students            FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "colleges service role"            ON colleges            FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "exams service role"               ON exams               FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "exam_codes service role"          ON exam_codes          FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "questions service role"           ON questions           FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "questions_ec service role"        ON questions_ec        FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "test_cases service role"          ON test_cases          FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "participants service role"        ON participants        FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "exam_sessions service role"       ON exam_sessions       FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "exam_code_attempts service role"  ON exam_code_attempts  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "session_answers service role"     ON session_answers     FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "violations service role"          ON violations          FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "proctor_logs service role"        ON proctor_logs        FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "suspicious_activity service role" ON suspicious_activity FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "results service role"             ON results             FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "leaderboard service role"         ON leaderboard         FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "deliverable_failures service"     ON deliverable_failures FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "audit_log service role"           ON audit_log           FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Public & Authenticated Read Policies
CREATE POLICY "public read active colleges"      ON colleges            FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "public read active exams"         ON exams               FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "public read active exam_codes"    ON exam_codes          FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "public read results leaderboard"  ON results             FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read live leaderboard"     ON leaderboard         FOR SELECT TO anon, authenticated USING (true);
