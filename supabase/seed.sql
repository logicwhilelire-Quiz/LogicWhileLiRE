-- ==============================================================================
-- LOGICWHILELIRE — PRODUCTION-SAFE SEED SCRIPT
-- File: supabase/seed.sql
-- Note: Super Admin accounts are NEVER seeded in SQL.
--       Use `npm run create-admin` from server/ CLI to provision the Super Admin.
-- ==============================================================================

-- ─── 1. PLATFORM SETTINGS ─────────────────────────────────────────────────────
INSERT INTO platform_settings (
  id,
  platform_name,
  tagline,
  college_name,
  logo_url,
  primary_color,
  secondary_color,
  maintenance_mode,
  maintenance_message,
  allowed_languages,
  execution_timeout_ms,
  memory_limit_mb,
  enable_plagiarism_chk,
  updated_at
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'LogicWhileLiRE',
  'Logic. While. LiRE.',
  'Partner Institutions Network',
  '/brand/logicwhilelire-logo-full.svg',
  '#2B7FFF',
  '#050814',
  false,
  'Platform is undergoing scheduled administrative maintenance.',
  ARRAY['python', 'javascript', 'cpp', 'java', 'go'],
  5000,
  256,
  true,
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  platform_name = EXCLUDED.platform_name,
  tagline = EXCLUDED.tagline,
  updated_at = NOW();
