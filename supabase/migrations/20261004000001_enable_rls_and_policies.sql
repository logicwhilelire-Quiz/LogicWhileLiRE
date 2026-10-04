-- ==============================================================================
-- LOGICWHILELIRE — ROW LEVEL SECURITY (RLS) POLICIES & SCHEMA HARDENING
-- Migration: 20261004000001_enable_rls_and_policies.sql
-- Description:
--   1. Enables deny-by-default RLS across all 25 public tables.
--   2. Enforces security_invoker = true on all compatibility views.
--   3. REVOKES ALL permissions on all tables, views, and sequences from anon and authenticated.
--   4. Grants exclusive access to service_role (Node.js API backend).
-- ==============================================================================

-- ─── 1. ENABLE ROW LEVEL SECURITY ACROSS ALL TABLES ────────────────────────────
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

-- ─── 2. ENFORCE security_invoker = true ON COMPATIBILITY VIEWS ─────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'candidates') THEN
    ALTER VIEW candidates SET (security_invoker = true);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'sessions') THEN
    ALTER VIEW sessions SET (security_invoker = true);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'audit_logs') THEN
    ALTER VIEW audit_logs SET (security_invoker = true);
  END IF;
END $$;

-- ─── 3. DROP RESIDUAL PUBLIC POLICIES FOR ANON & AUTHENTICATED ─────────────────
DROP POLICY IF EXISTS "public_read_active_colleges" ON colleges;
DROP POLICY IF EXISTS "public_read_active_exam_codes" ON exam_codes;
DROP POLICY IF EXISTS "public_read_active_sections" ON sections;
DROP POLICY IF EXISTS "public_read_active_cohorts" ON cohorts;
DROP POLICY IF EXISTS "public_read_active_academic_years" ON academic_years;

-- ─── 4. REVOKE ALL FROM anon & authenticated (TABLES, VIEWS, SEQUENCES) ─────────
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon, authenticated;

-- ─── 5. GRANT EXCLUSIVE ACCESS TO service_role ─────────────────────────────────
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;

-- ─── 6. SERVICE ROLE FULL-ACCESS POLICIES FOR ALL 25 TABLES ────────────────────
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
