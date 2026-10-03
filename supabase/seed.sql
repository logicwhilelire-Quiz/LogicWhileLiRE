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

-- ─── 2. PARTNER COLLEGES ──────────────────────────────────────────────────────
INSERT INTO colleges (id, college_name, college_code, city, state, is_active)
VALUES
  (1, 'Velagapudi Ramakrishna Siddhartha Engineering College', 'VRSEC', 'Vijayawada', 'Andhra Pradesh', true),
  (2, 'Koneru Lakshmaiah Education Foundation (KL University)', 'KLUNIV', 'Vaddeswaram', 'Andhra Pradesh', true),
  (3, 'VNR Vignana Jyothi Institute of Engineering and Technology', 'VNRVJIET', 'Hyderabad', 'Telangana', true),
  (4, 'Chaitanya Bharathi Institute of Technology', 'CBIT', 'Hyderabad', 'Telangana', true)
ON CONFLICT (college_code) DO UPDATE SET
  college_name = EXCLUDED.college_name,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  is_active = EXCLUDED.is_active;

-- Synchronize serial sequence for colleges
SELECT setval('colleges_id_seq', (SELECT MAX(id) FROM colleges));

-- ─── 3. SAMPLE PRODUCTION EXAM CODE ───────────────────────────────────────────
INSERT INTO exam_codes (
  id,
  exam_code,
  college_id,
  exam_name,
  subject,
  total_questions,
  duration_minutes,
  passing_percentage,
  start_time,
  end_time,
  is_launched,
  is_active,
  results_published,
  proctoring_enabled,
  negative_marking,
  max_violations,
  auto_terminate,
  grace_period_seconds,
  allowed_languages
) VALUES (
  1,
  'GR-VRSEC-SAMPLE',
  1,
  'Campus Placement Aptitude & Technical Benchmark',
  'Computer Science & General Aptitude',
  5,
  60,
  40.0,
  NOW() - INTERVAL '1 hour',
  NOW() + INTERVAL '30 days',
  true,
  true,
  false,
  true,
  0.25,
  5,
  true,
  60,
  ARRAY['python', 'javascript', 'cpp', 'java']
) ON CONFLICT (exam_code) DO UPDATE SET
  exam_name = EXCLUDED.exam_name,
  is_active = true,
  end_time = NOW() + INTERVAL '30 days';

-- Synchronize serial sequence for exam_codes
SELECT setval('exam_codes_id_seq', (SELECT MAX(id) FROM exam_codes));

-- ─── 4. SAMPLE QUESTIONS FOR GR-VRSEC-SAMPLE ──────────────────────────────────
-- (Answers are stored securely server-side; NEVER sent to candidates)
DELETE FROM questions_ec WHERE exam_code = 'GR-VRSEC-SAMPLE';

INSERT INTO questions_ec (
  id,
  exam_code,
  question,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  marks,
  difficulty,
  topic,
  section,
  display_order,
  explanation,
  question_type,
  starter_code,
  test_cases
) VALUES
(
  'b0000000-0000-0000-0000-000000000001',
  'GR-VRSEC-SAMPLE',
  'What is the worst-case time complexity of searching for an element in a balanced Binary Search Tree (AVL / Red-Black Tree) containing N elements?',
  'O(1)',
  'O(log N)',
  'O(N)',
  'O(N log N)',
  'B',
  1,
  'Medium',
  'Data Structures',
  'Technical Core',
  1,
  'In balanced BSTs, the height is guaranteed to be O(log N), so search operations take O(log N) worst-case time.',
  'mcq',
  NULL,
  '[]'::jsonb
),
(
  'b0000000-0000-0000-0000-000000000002',
  'GR-VRSEC-SAMPLE',
  'Which of the following HTTP status codes indicates that the client must authenticate itself to get the requested response?',
  '400 Bad Request',
  '401 Unauthorized',
  '403 Forbidden',
  '404 Not Found',
  'B',
  1,
  'Easy',
  'Web Architecture',
  'Technical Core',
  2,
  '401 Unauthorized indicates the request has not been applied because it lacks valid authentication credentials.',
  'mcq',
  NULL,
  '[]'::jsonb
),
(
  'b0000000-0000-0000-0000-000000000003',
  'GR-VRSEC-SAMPLE',
  'A train running at 54 km/hr crosses an electric pole in 20 seconds. What is the length of the train in meters?',
  '250 m',
  '300 m',
  '350 m',
  '270 m',
  'B',
  1,
  'Medium',
  'Quantitative Aptitude',
  'General Aptitude',
  3,
  'Speed = 54 * (5/18) = 15 m/s. Length = Speed * Time = 15 m/s * 20 s = 300 meters.',
  'mcq',
  NULL,
  '[]'::jsonb
),
(
  'b0000000-0000-0000-0000-000000000004',
  'GR-VRSEC-SAMPLE',
  'In SQL, which clause is evaluated BEFORE the SELECT clause and filters grouped records based on aggregate conditions?',
  'WHERE',
  'HAVING',
  'ORDER BY',
  'GROUP BY',
  'B',
  1,
  'Medium',
  'Database Management',
  'Technical Core',
  4,
  'HAVING filters groups created by GROUP BY after WHERE has filtered individual rows.',
  'mcq',
  NULL,
  '[]'::jsonb
),
(
  'b0000000-0000-0000-0000-000000000005',
  'GR-VRSEC-SAMPLE',
  'Write a function `isPalindrome(s)` that returns true if the string is a palindrome ignoring case, otherwise false.',
  '',
  '',
  '',
  '',
  'A',
  5,
  'Medium',
  'Algorithms',
  'Coding Round',
  5,
  'String reversal or two-pointer comparison.',
  'coding',
  'def is_palindrome(s: str) -> bool:\n    # Write your logic here\n    pass',
  '[{"input_text": "racecar", "expected_output": "True", "marks": 2, "is_hidden": false}, {"input_text": "LogicWhileLiRE", "expected_output": "False", "marks": 1, "is_hidden": false}, {"input_text": "deified", "expected_output": "True", "marks": 2, "is_hidden": true}]'::jsonb
);
