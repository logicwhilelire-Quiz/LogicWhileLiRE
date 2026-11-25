-- Add cryptographic gate pass columns to students table
ALTER TABLE IF EXISTS students
  ADD COLUMN IF NOT EXISTS student_gate_pass TEXT,
  ADD COLUMN IF NOT EXISTS candidate_gate_pass TEXT;
