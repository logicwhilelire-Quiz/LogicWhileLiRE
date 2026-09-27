-- ============================================================
-- LOGICWHILE MIGRATION: Exam Code System (No OTP)
-- Run this in the Supabase SQL Editor AFTER schema.sql
-- ============================================================

-- TABLE: colleges
CREATE TABLE IF NOT EXISTS colleges (
  id              SERIAL PRIMARY KEY,
  college_name    VARCHAR(150) NOT NULL,
  college_code    VARCHAR(20) UNIQUE NOT NULL,  -- e.g., KLUNIV, VRSEC
  city            VARCHAR(100),
  state           VARCHAR(100) DEFAULT 'Andhra Pradesh',
  contact_email   TEXT,
  contact_phone   TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TABLE: exam_codes (the master code per college exam)
CREATE TABLE IF NOT EXISTS exam_codes (
  id                SERIAL PRIMARY KEY,
  exam_code         VARCHAR(20) UNIQUE NOT NULL,  -- e.g., LW-VRSEC-8X9P2Q
  college_id        INT REFERENCES colleges(id) ON DELETE CASCADE,
  exam_name         VARCHAR(150) NOT NULL,         -- e.g., CRT-DAY-12
  subject           VARCHAR(100),
  total_questions   INT NOT NULL DEFAULT 30,
  duration_minutes  INT NOT NULL DEFAULT 60,
  start_time        TIMESTAMPTZ NOT NULL,
  end_time          TIMESTAMPTZ NOT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TABLE: exam_code_attempts (one hall ticket per exam_code)
CREATE TABLE IF NOT EXISTS exam_code_attempts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hall_ticket_no  TEXT NOT NULL,
  exam_code       VARCHAR(20) NOT NULL REFERENCES exam_codes(exam_code) ON DELETE CASCADE,
  student_name    TEXT,
  start_time      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time        TIMESTAMPTZ,
  score           NUMERIC DEFAULT 0,
  max_score       NUMERIC DEFAULT 0,
  correct_count   INT DEFAULT 0,
  wrong_count     INT DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'terminated_cheating')),
  violation_count INT NOT NULL DEFAULT 0,
  answers         JSONB DEFAULT '{}',
  time_taken_seconds INT DEFAULT 0,
  topic_breakdown JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_hall_ticket_exam_code UNIQUE (hall_ticket_no, exam_code)
);

-- TABLE: questions_ec (questions linked to exam_codes)
CREATE TABLE IF NOT EXISTS questions_ec (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_code       VARCHAR(20) NOT NULL REFERENCES exam_codes(exam_code) ON DELETE CASCADE,
  question        TEXT NOT NULL,
  option_a        TEXT NOT NULL,
  option_b        TEXT NOT NULL,
  option_c        TEXT NOT NULL,
  option_d        TEXT NOT NULL,
  correct_answer  CHAR(1) NOT NULL CHECK (correct_answer IN ('A','B','C','D')),
  marks           NUMERIC NOT NULL DEFAULT 1,
  difficulty      TEXT DEFAULT 'Medium' CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  topic           TEXT NOT NULL DEFAULT 'General',
  explanation     TEXT,
  display_order   INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_colleges_code ON colleges(college_code);
CREATE INDEX IF NOT EXISTS idx_exam_codes_code ON exam_codes(exam_code);
CREATE INDEX IF NOT EXISTS idx_exam_codes_college ON exam_codes(college_id);
CREATE INDEX IF NOT EXISTS idx_exam_codes_active ON exam_codes(is_active, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_exam_code_attempts_hall ON exam_code_attempts(hall_ticket_no, exam_code);
CREATE INDEX IF NOT EXISTS idx_questions_ec_code ON questions_ec(exam_code);

-- RLS
ALTER TABLE colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_code_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions_ec ENABLE ROW LEVEL SECURITY;

CREATE POLICY "colleges service role" ON colleges FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "exam_codes service role" ON exam_codes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "exam_code_attempts service role" ON exam_code_attempts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "questions_ec service role" ON questions_ec FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow anon to read active colleges (for dropdown in entry form)
CREATE POLICY "public read active colleges" ON colleges FOR SELECT TO anon, authenticated USING (is_active = true);
-- Allow anon to read active exam codes (for validation -- correct_answer never exposed)
CREATE POLICY "public read active exam_codes" ON exam_codes FOR SELECT TO anon, authenticated USING (is_active = true);
