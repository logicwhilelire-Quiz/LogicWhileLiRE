-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20261011000001_staff_login_linking.sql
-- Adds username, phone, and must_change_password columns to the staff table
-- to support admin/inspector login linking (Requirement A.1–A.6).
-- ─────────────────────────────────────────────────────────────────────────────

-- Add username column (unique, used for USERNAME+PASSWORD login)
ALTER TABLE IF EXISTS staff
  ADD COLUMN IF NOT EXISTS username TEXT;

-- Add unique constraint on username (case-insensitive via lowercased value)
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_username_unique
  ON staff (LOWER(username))
  WHERE username IS NOT NULL;

-- Add index for fast username lookups
CREATE INDEX IF NOT EXISTS idx_staff_username
  ON staff (username)
  WHERE username IS NOT NULL;

-- Add phone column (linked contact for OTP / password reset)
ALTER TABLE IF EXISTS staff
  ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE INDEX IF NOT EXISTS idx_staff_phone
  ON staff (phone)
  WHERE phone IS NOT NULL;

-- Add must_change_password flag (force password change on first login)
ALTER TABLE IF EXISTS staff
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── Backfill: encode any existing permissions-based username hints ──────────
-- (Staff created via fallback path have user:<username> in permissions array)
-- This is a no-op if there are no such rows; runs safely.
UPDATE staff
SET
  username = split_part(perm, ':', 2),
  must_change_password = (permissions @> '["must_change_password:true"]'::jsonb)
FROM (
  SELECT id, elem AS perm
  FROM staff,
       jsonb_array_elements_text(
         CASE WHEN jsonb_typeof(permissions) = 'array' THEN permissions ELSE '[]'::jsonb END
       ) AS elem
  WHERE elem LIKE 'user:%'
    AND username IS NULL
) sub
WHERE staff.id = sub.id;
