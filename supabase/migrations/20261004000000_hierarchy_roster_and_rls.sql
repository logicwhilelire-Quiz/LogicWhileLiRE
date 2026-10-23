-- ==============================================================================
-- LOGICWHILELIRE — HIERARCHY, ROSTERS & COMPREHENSIVE RLS POLICIES
-- Migration: 20261004000000_hierarchy_roster_and_rls.sql
-- Compatible with: Supabase / PostgreSQL 15+
-- ==============================================================================

-- ─── 1. TABLE: academic_years ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS academic_years (
  id              TEXT PRIMARY KEY,
  college_id      TEXT NOT NULL,
  year            TEXT NOT NULL,
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
  name                TEXT NOT NULL,
  room_number         TEXT,
  capacity            INTEGER DEFAULT 60,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 4. TABLE: batches (Lab/Practical Batches) ────────────────────────────────
CREATE TABLE IF NOT EXISTS batches (
  id                  TEXT PRIMARY KEY,
  college_id          TEXT NOT NULL,
  section_id          TEXT REFERENCES sections(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  batch_code          TEXT,
  max_capacity        INTEGER DEFAULT 30,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 5. TABLE: student_roster (Admin Roster Imports) ───────────────────────────
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
  batch_id            TEXT,
  imported_by         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_roster_college_roll UNIQUE (college_id, roll_number)
);

-- ─── 6. INDEXES FOR HIERARCHY TABLES ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_academic_years_college ON academic_years(college_id);
CREATE INDEX IF NOT EXISTS idx_cohorts_college ON cohorts(college_id);
CREATE INDEX IF NOT EXISTS idx_cohorts_ay ON cohorts(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_sections_college ON sections(college_id);
CREATE INDEX IF NOT EXISTS idx_sections_cohort ON sections(cohort_id);
CREATE INDEX IF NOT EXISTS idx_batches_section ON batches(section_id);
CREATE INDEX IF NOT EXISTS idx_batches_college ON batches(college_id);
CREATE INDEX IF NOT EXISTS idx_roster_college_roll ON student_roster(college_id, roll_number);

-- ==============================================================================
-- 7. COMPLETE ROW LEVEL SECURITY (RLS) ENFORCEMENT ON ALL TABLES
-- ==============================================================================
-- Ensure RLS is active on every single database table
ALTER TABLE IF EXISTS colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS session_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS results ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS exam_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS questions_ec ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS exam_code_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS suspicious_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS proctor_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS deliverable_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS student_roster ENABLE ROW LEVEL SECURITY;

-- ─── SERVICE ROLE FULL ACCESS (Backend Node.js Service Key) ───────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_academic_years' AND tablename = 'academic_years') THEN
    CREATE POLICY "service_role_academic_years" ON academic_years FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_cohorts' AND tablename = 'cohorts') THEN
    CREATE POLICY "service_role_cohorts" ON cohorts FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_sections' AND tablename = 'sections') THEN
    CREATE POLICY "service_role_sections" ON sections FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_batches' AND tablename = 'batches') THEN
    CREATE POLICY "service_role_batches" ON batches FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_student_roster' AND tablename = 'student_roster') THEN
    CREATE POLICY "service_role_student_roster" ON student_roster FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─── REVOKE ALL ACCESS FROM ANON & AUTHENTICATED (SERVICE ROLE ONLY) ───────────
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

