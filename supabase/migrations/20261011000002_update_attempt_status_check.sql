-- Migration: 20261011000002_update_attempt_status_check.sql
-- Description: Allow waiting lobby, verification and invigilator release lifecycle statuses on exam_code_attempts

ALTER TABLE exam_code_attempts DROP CONSTRAINT IF EXISTS exam_code_attempts_status_check;

ALTER TABLE exam_code_attempts ADD CONSTRAINT exam_code_attempts_status_check 
  CHECK (status IN (
    'in_progress', 
    'completed', 
    'terminated_cheating', 
    'auto_submitted_expired', 
    'submitted', 
    'waiting_verification', 
    'released', 
    'in_lobby', 
    'waiting', 
    'blocked', 
    'rejected'
  ));

ALTER TABLE exam_code_attempts ALTER COLUMN start_time DROP NOT NULL;
