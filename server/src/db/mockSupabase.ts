import { v4 as uuidv4 } from 'uuid';

if (process.env.NODE_ENV === 'production') {
  throw new Error('FATAL: mockSupabase and pre-seeded demo accounts must never be loaded in production mode.');
}

export interface MockTableData {
  staff: any[];
  students: any[];
  exams: any[];
  participants: any[];
  exam_sessions: any[];
  session_answers: any[];
  questions: any[];
  violations: any[];
  suspicious_activity: any[];
  results: any[];
  deliverable_failures: any[];
  audit_log: any[];
  [key: string]: any[];
}

export const DEMO_EXAM_ID = 'e1000000-0000-0000-0000-000000000001';
export const DEMO_EXAM_2_ID = 'e2000000-0000-0000-0000-000000000002';

// In-memory store
const store: MockTableData = {
  staff: [
    {
      id: 'st000000-0000-0000-0000-000000000001',
      name: 'LogicWhileLiRE Super Admin',
      email: 'admin@logicwhilelire.com',
      password_hash: '$2b$12$kP1ZkxGsbQgL.PSNBA/ts.vFh6WhJ57LGOrf4biA7vQT7K0qiJTL.',
      role: 'super_admin',
      created_by: null,
      failed_attempts: 0,
      locked_until: null,
      reset_token_hash: null,
      reset_token_expires: null,
      is_active: true,
      created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
    },
    {
      id: 'st000000-0000-0000-0000-000000000000',
      name: 'LogicWhileLiRE Super Admin (Legacy)',
      email: 'admin@LOGICWHILELIRE.com',
      password_hash: '$2b$12$kP1ZkxGsbQgL.PSNBA/ts.vFh6WhJ57LGOrf4biA7vQT7K0qiJTL.',
      role: 'super_admin',
      created_by: null,
      failed_attempts: 0,
      locked_until: null,
      reset_token_hash: null,
      reset_token_expires: null,
      is_active: true,
      created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
    },
    {
      id: 'st000000-0000-0000-0000-000000000002',
      name: 'Dr. Suresh Kumar (Faculty)',
      email: 'suresh@logicwhilelire.com',
      password_hash: '$2b$12$kP1ZkxGsbQgL.PSNBA/ts.vFh6WhJ57LGOrf4biA7vQT7K0qiJTL.',
      role: 'faculty',
      created_by: 'st000000-0000-0000-0000-000000000001',
      failed_attempts: 0,
      locked_until: null,
      reset_token_hash: null,
      reset_token_expires: null,
      is_active: true,
      created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
    },
    {
      id: 'st000000-0000-0000-0000-000000000022',
      name: 'Dr. Suresh Kumar (Faculty - Legacy)',
      email: 'suresh@LOGICWHILELIRE.com',
      password_hash: '$2b$12$kP1ZkxGsbQgL.PSNBA/ts.vFh6WhJ57LGOrf4biA7vQT7K0qiJTL.',
      role: 'faculty',
      created_by: 'st000000-0000-0000-0000-000000000001',
      failed_attempts: 0,
      locked_until: null,
      reset_token_hash: null,
      reset_token_expires: null,
      is_active: true,
      created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
    },
    {
      id: 'st000000-0000-0000-0000-000000000003',
      name: 'Prof. Priya Sharma (Faculty)',
      email: 'priya@logicwhilelire.com',
      password_hash: '$2b$12$kP1ZkxGsbQgL.PSNBA/ts.vFh6WhJ57LGOrf4biA7vQT7K0qiJTL.',
      role: 'faculty',
      created_by: 'st000000-0000-0000-0000-000000000001',
      failed_attempts: 0,
      locked_until: null,
      reset_token_hash: null,
      reset_token_expires: null,
      is_active: true,
      created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    },
    {
      id: 'st000000-0000-0000-0000-000000000033',
      name: 'Prof. Priya Sharma (Faculty - Legacy)',
      email: 'priya@LOGICWHILELIRE.com',
      password_hash: '$2b$12$kP1ZkxGsbQgL.PSNBA/ts.vFh6WhJ57LGOrf4biA7vQT7K0qiJTL.',
      role: 'faculty',
      created_by: 'st000000-0000-0000-0000-000000000001',
      failed_attempts: 0,
      locked_until: null,
      reset_token_hash: null,
      reset_token_expires: null,
      is_active: true,
      created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    },
  ],
  students: [
    {
      id: 's1000000-0000-0000-0000-000000000001',
      first_name: 'Aarav',
      last_name: 'Sharma',
      name: 'Aarav Sharma',
      email: 'aarav.sharma@example.com',
      college_id: 'COL-UNIV-042',
      college_name: 'University College of Eng.',
      year_of_passing: 2028,
      roll_number: 'HT2026001',
      hall_ticket: 'HT2026001',
      branch_code: 'CSM',
      section: 'B',
      contact_number: '9876543210',
      mobile: '+91 98765 43210',
      password_hash: '$2b$12$kP1ZkxGsbQgL.PSNBA/ts.vFh6WhJ57LGOrf4biA7vQT7K0qiJTL.',
      failed_attempts: 0,
      locked_until: null,
      reset_token_hash: null,
      reset_token_expires: null,
      is_active: true,
      created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 30).toISOString(),
    },
    {
      id: 's2000000-0000-0000-0000-000000000002',
      first_name: 'Neha',
      last_name: 'Patel',
      name: 'Neha Patel',
      email: 'neha.patel@example.com',
      college_id: 'COL-TECH-108',
      college_name: 'Tech Campus North',
      year_of_passing: 2028,
      roll_number: 'HT2026002',
      hall_ticket: 'HT2026002',
      branch_code: 'CSE',
      section: 'A',
      contact_number: '9876543211',
      mobile: '+91 98765 43211',
      password_hash: '$2b$12$kP1ZkxGsbQgL.PSNBA/ts.vFh6WhJ57LGOrf4biA7vQT7K0qiJTL.',
      failed_attempts: 0,
      locked_until: null,
      reset_token_hash: null,
      reset_token_expires: null,
      is_active: true,
      created_at: new Date(Date.now() - 86400000 * 20).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 20).toISOString(),
    },
  ],
  exams: [
    {
      id: DEMO_EXAM_ID,
      title: 'LogicWhileLiRE — Full-Stack & System Design Assessment 2026',
      duration_minutes: 30,
      start_time: new Date(Date.now() - 3600000).toISOString(),
      end_time: new Date(Date.now() + 86400000 * 7).toISOString(),
      admin_email: 'admin@logicwhilelire.com',
      created_by_staff_id: 'st000000-0000-0000-0000-000000000002',
      staff_id: 'st000000-0000-0000-0000-000000000002',
      is_leaderboard_public: true,
      is_active: true,
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: DEMO_EXAM_2_ID,
      title: 'Computer Science Core & Data Structures Sprint',
      duration_minutes: 45,
      start_time: new Date(Date.now() - 86400000).toISOString(),
      end_time: new Date(Date.now() + 86400000 * 14).toISOString(),
      admin_email: 'admin@logicwhilelire.com',
      created_by_staff_id: 'st000000-0000-0000-0000-000000000003',
      staff_id: 'st000000-0000-0000-0000-000000000003',
      is_leaderboard_public: true,
      is_active: true,
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
  ],
  participants: [
    {
      id: 'p1000000-0000-0000-0000-000000000001',
      exam_id: DEMO_EXAM_ID,
      name: 'Aarav Sharma',
      hall_ticket: 'HT2026001',
      mobile: '+91 98765 43210',
      email: 'aarav.sharma@example.com',
      enrolled_at: new Date(Date.now() - 7200000).toISOString(),
      otp_hash: null,
      otp_verified: true,
    },
    {
      id: 'p2000000-0000-0000-0000-000000000002',
      exam_id: DEMO_EXAM_ID,
      name: 'Neha Patel',
      hall_ticket: 'HT2026002',
      mobile: '+91 98765 43211',
      email: 'neha.patel@example.com',
      enrolled_at: new Date(Date.now() - 6500000).toISOString(),
      otp_hash: null,
      otp_verified: true,
    },
    {
      id: 'p3000000-0000-0000-0000-000000000003',
      exam_id: DEMO_EXAM_ID,
      name: 'Rohan Varma',
      hall_ticket: 'HT2026003',
      mobile: '+91 98765 43212',
      email: 'rohan.varma@example.com',
      enrolled_at: new Date(Date.now() - 5000000).toISOString(),
      otp_hash: null,
      otp_verified: true,
    },
  ],
  exam_sessions: [
    {
      id: 's1000000-0000-0000-0000-000000000001',
      participant_id: 'p1000000-0000-0000-0000-000000000001',
      token_hash: 'mock_token_hash_1',
      browser_fingerprint: 'fp_demo_aarav_001',
      status: 'submitted',
      started_at: new Date(Date.now() - 5400000).toISOString(),
      end_time: new Date(Date.now() - 3600000).toISOString(),
      completed_at: new Date(Date.now() - 3900000).toISOString(),
      time_remaining_seconds: 0,
      total_violations: 0,
      created_at: new Date(Date.now() - 5400000).toISOString(),
    },
    {
      id: 's2000000-0000-0000-0000-000000000002',
      participant_id: 'p2000000-0000-0000-0000-000000000002',
      token_hash: 'mock_token_hash_2',
      browser_fingerprint: 'fp_demo_neha_002',
      status: 'submitted',
      started_at: new Date(Date.now() - 4800000).toISOString(),
      end_time: new Date(Date.now() - 3000000).toISOString(),
      completed_at: new Date(Date.now() - 3300000).toISOString(),
      time_remaining_seconds: 0,
      total_violations: 0,
      created_at: new Date(Date.now() - 4800000).toISOString(),
    },
    {
      id: 's3000000-0000-0000-0000-000000000003',
      participant_id: 'p3000000-0000-0000-0000-000000000003',
      token_hash: 'mock_token_hash_3',
      browser_fingerprint: 'fp_demo_rohan_003',
      status: 'submitted',
      started_at: new Date(Date.now() - 3600000).toISOString(),
      end_time: new Date(Date.now() - 1800000).toISOString(),
      completed_at: new Date(Date.now() - 2200000).toISOString(),
      time_remaining_seconds: 0,
      total_violations: 1,
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
  ],
  session_answers: [],
  questions: [
    {
      id: 'q1000000-0000-0000-0000-000000000001',
      exam_id: DEMO_EXAM_ID,
      question_text: 'What is the primary function of the Memory Management Unit (MMU) in modern operating systems?',
      option_a: 'Execute floating point arithmetic operations',
      option_b: 'Translate virtual memory addresses into physical RAM addresses',
      option_c: 'Directly manage disk partition sector allocations',
      option_d: 'Cache L1 instructions for multithreaded CPU cores',
      correct_option: 'b',
      marks: 1,
      penalty: 0.25,
      set_number: 1,
      question_set: 'A',
      topic: 'Computer Architecture',
      created_at: new Date().toISOString(),
    },
    {
      id: 'q2000000-0000-0000-0000-000000000002',
      exam_id: DEMO_EXAM_ID,
      question_text: 'Which data structure strictly follows the Last-In-First-Out (LIFO) operational principle?',
      option_a: 'Circular Queue',
      option_b: 'Stack',
      option_c: 'Binary Search Tree',
      option_d: 'Singly Linked List',
      correct_option: 'b',
      marks: 1,
      penalty: 0.25,
      set_number: 1,
      question_set: 'A',
      topic: 'Data Structures',
      created_at: new Date().toISOString(),
    },
    {
      id: 'q3000000-0000-0000-0000-000000000003',
      exam_id: DEMO_EXAM_ID,
      question_text: 'What is the worst-case time complexity of searching an element in a self-balancing Binary Search Tree (AVL / Red-Black Tree)?',
      option_a: 'O(1)',
      option_b: 'O(n)',
      option_c: 'O(log n)',
      option_d: 'O(n log n)',
      correct_option: 'c',
      marks: 1,
      penalty: 0.25,
      set_number: 1,
      question_set: 'A',
      topic: 'Algorithms',
      created_at: new Date().toISOString(),
    },
    {
      id: 'q4000000-0000-0000-0000-000000000004',
      exam_id: DEMO_EXAM_ID,
      question_text: 'Which SQL statement removes a table structure, schema, and all data permanently from a relational database?',
      option_a: 'DELETE TABLE',
      option_b: 'DROP TABLE',
      option_c: 'TRUNCATE TABLE',
      option_d: 'CLEAR TABLE',
      correct_option: 'b',
      marks: 1,
      penalty: 0.25,
      set_number: 1,
      question_set: 'A',
      topic: 'Database Systems',
      created_at: new Date().toISOString(),
    },
    {
      id: 'q5000000-0000-0000-0000-000000000005',
      exam_id: DEMO_EXAM_ID,
      question_text: 'In asymmetric public-key cryptography, which key must the sender use to encrypt a secret message destined for the recipient?',
      option_a: "Sender's private key",
      option_b: "Sender's public key",
      option_c: "Recipient's public key",
      option_d: "Recipient's private key",
      correct_option: 'c',
      marks: 1,
      penalty: 0.25,
      set_number: 1,
      question_set: 'A',
      topic: 'Cybersecurity',
      created_at: new Date().toISOString(),
    },
    {
      id: 'q6000000-0000-0000-0000-000000000006',
      exam_id: DEMO_EXAM_ID,
      question_text: 'In JavaScript / TypeScript, what is the evaluated result of `typeof NaN`?',
      option_a: "'undefined'",
      option_b: "'number'",
      option_c: "'object'",
      option_d: "'NaN'",
      correct_option: 'b',
      marks: 1,
      penalty: 0.25,
      set_number: 1,
      question_set: 'A',
      topic: 'JavaScript Core',
      created_at: new Date().toISOString(),
    },
    {
      id: 'q7000000-0000-0000-0000-000000000007',
      exam_id: DEMO_EXAM_ID,
      question_text: 'Which standard HTTP status code signifies that authentication is required and has failed or has not yet been provided?',
      option_a: '400 Bad Request',
      option_b: '401 Unauthorized',
      option_c: '403 Forbidden',
      option_d: '404 Not Found',
      correct_option: 'b',
      marks: 1,
      penalty: 0.25,
      set_number: 1,
      question_set: 'A',
      topic: 'Web Architecture',
      created_at: new Date().toISOString(),
    },
    {
      id: 'q8000000-0000-0000-0000-000000000008',
      exam_id: DEMO_EXAM_ID,
      question_text: 'Which React hook is designed for synchronizing external systems, managing event listeners, or executing data fetching after rendering?',
      option_a: 'useMemo',
      option_b: 'useState',
      option_c: 'useEffect',
      option_d: 'useCallback',
      correct_option: 'c',
      marks: 1,
      penalty: 0.25,
      set_number: 1,
      question_set: 'A',
      topic: 'React & Frontend',
      created_at: new Date().toISOString(),
    },
  ],
  violations: [
    {
      id: 'v1000000-0000-0000-0000-000000000001',
      session_id: 's3000000-0000-0000-0000-000000000003',
      violation_type: 'tab_switch',
      notes: 'Participant switched window focus for 3.2 seconds',
      created_at: new Date(Date.now() - 2500000).toISOString(),
    },
  ],
  suspicious_activity: [],
  results: [
    {
      id: 'r1000000-0000-0000-0000-000000000001',
      participant_id: 'p1000000-0000-0000-0000-000000000001',
      total_score: 8,
      max_score: 8,
      normalized_score: 100,
      correct_count: 8,
      wrong_count: 0,
      time_taken_seconds: 420,
      graded_at: new Date(Date.now() - 3900000).toISOString(),
    },
    {
      id: 'r2000000-0000-0000-0000-000000000002',
      participant_id: 'p2000000-0000-0000-0000-000000000002',
      total_score: 7,
      max_score: 8,
      normalized_score: 87.5,
      correct_count: 7,
      wrong_count: 1,
      time_taken_seconds: 510,
      graded_at: new Date(Date.now() - 3300000).toISOString(),
    },
    {
      id: 'r3000000-0000-0000-0000-000000000003',
      participant_id: 'p3000000-0000-0000-0000-000000000003',
      total_score: 5.75,
      max_score: 8,
      normalized_score: 71.875,
      correct_count: 6,
      wrong_count: 1,
      time_taken_seconds: 640,
      graded_at: new Date(Date.now() - 2200000).toISOString(),
    },
  ],
  deliverable_failures: [],
  audit_log: [],
  colleges: [
    {
      id: 1,
      college_name: 'Velagapudi Ramakrishna Siddhartha Engineering College (VRSEC)',
      college_code: 'VRSEC',
      city: 'Vijayawada',
      state: 'Andhra Pradesh',
      contact_email: 'tpo@vrsec.ac.in',
      contact_phone: '+91 866 258 2333',
      is_active: true,
      created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
    },
    {
      id: 2,
      college_name: 'Koneru Lakshmaiah Education Foundation (KL University)',
      college_code: 'KLU',
      city: 'Vaddeswaram',
      state: 'Andhra Pradesh',
      contact_email: 'placements@kluniversity.in',
      contact_phone: '+91 863 239 9999',
      is_active: true,
      created_at: new Date(Date.now() - 86400000 * 25).toISOString(),
    },
    {
      id: 3,
      college_name: "Vignan's Foundation for Science, Technology and Research",
      college_code: 'VIGNAN',
      city: 'Vadlamudi, Guntur',
      state: 'Andhra Pradesh',
      contact_email: 'tpo@vignan.ac.in',
      contact_phone: '+91 863 234 4700',
      is_active: true,
      created_at: new Date(Date.now() - 86400000 * 20).toISOString(),
    },
    {
      id: 4,
      college_name: 'R.V.R. & J.C. College of Engineering',
      college_code: 'RVRJC',
      city: 'Chowdavaram, Guntur',
      state: 'Andhra Pradesh',
      contact_email: 'placements@rvrjcce.ac.in',
      contact_phone: '+91 863 228 8201',
      is_active: true,
      created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
    },
    {
      id: 5,
      college_name: 'Gayatri Vidya Parishad College of Engineering (Autonomous)',
      college_code: 'GVPCE',
      city: 'Madhurawada, Visakhapatnam',
      state: 'Andhra Pradesh',
      contact_email: 'tpo@gvpce.ac.in',
      contact_phone: '+91 891 273 9507',
      is_active: true,
      created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    },
  ],
  exam_codes: [
    {
      id: 1,
      exam_code: 'LW-VRSEC-2026',
      college_id: 1,
      exam_name: 'VRSEC CRT Comprehensive Assessment 2026 - All Sets & Sectors',
      subject: 'Aptitude, Core CS, DSA & Coding Logic',
      total_questions: 15,
      duration_minutes: 45,
      start_time: new Date(Date.now() - 86400000).toISOString(),
      end_time: new Date(Date.now() + 86400000 * 60).toISOString(),
      is_active: true,
      created_by_staff_id: 'st000000-0000-0000-0000-000000000001',
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
    {
      id: 99,
      exam_code: 'CS2026',
      college_id: 1,
      exam_name: 'LogicWhileLiRE 4.0 - Computer Science & Coding Qualifier 2026',
      subject: 'Aptitude, Core CS, DSA & Python/JS Coding',
      total_questions: 15,
      duration_minutes: 45,
      start_time: new Date(Date.now() - 86400000).toISOString(),
      end_time: new Date(Date.now() + 86400000 * 60).toISOString(),
      is_active: true,
      created_by_staff_id: 'st000000-0000-0000-0000-000000000001',
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
    {
      id: 100,
      exam_code: 'DEMO100',
      college_id: 1,
      exam_name: 'LogicWhileLiRE 4.0 - Instant Interactive Demonstration',
      subject: 'General Aptitude & Rapid Logic',
      total_questions: 15,
      duration_minutes: 30,
      start_time: new Date(Date.now() - 86400000).toISOString(),
      end_time: new Date(Date.now() + 86400000 * 60).toISOString(),
      is_active: true,
      created_by_staff_id: 'st000000-0000-0000-0000-000000000001',
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
    {
      id: 2,
      exam_code: 'LW-APCRT-2026',
      college_id: 1,
      exam_name: 'AP State Autonomous CRT Master Sprint 2026',
      subject: 'CRT Aptitude, Reasoning & Technical MCQs',
      total_questions: 15,
      duration_minutes: 40,
      start_time: new Date(Date.now() - 86400000).toISOString(),
      end_time: new Date(Date.now() + 86400000 * 60).toISOString(),
      is_active: true,
      created_by_staff_id: 'st000000-0000-0000-0000-000000000001',
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    {
      id: 3,
      exam_code: 'LW-KLU-2026',
      college_id: 2,
      exam_name: 'KL University Special Technical Placement Qualifier',
      subject: 'Algorithms & Full Stack Engineering',
      total_questions: 12,
      duration_minutes: 30,
      start_time: new Date(Date.now() - 86400000).toISOString(),
      end_time: new Date(Date.now() + 86400000 * 60).toISOString(),
      is_active: true,
      created_by_staff_id: 'st000000-0000-0000-0000-000000000001',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
  ],
  questions_ec: [
    // Sector 1: Quantitative Aptitude (Set A)
    {
      id: 'qec-01',
      exam_code: 'LW-VRSEC-2026',
      question: 'A train 180 meters long is running at a speed of 54 km/hr. How much time will it take to pass an electric pole on the railway track?',
      option_a: '10 seconds',
      option_b: '12 seconds',
      option_c: '15 seconds',
      option_d: '18 seconds',
      correct_answer: 'b',
      marks: 1,
      difficulty: 'Easy',
      topic: 'Quantitative Aptitude (Speed & Distance)',
      display_order: 1,
    },
    {
      id: 'qec-02',
      exam_code: 'LW-VRSEC-2026',
      question: 'If A can finish a work in 12 days and B can do the same work in 18 days, in how many days can they complete the work working together?',
      option_a: '6.4 days',
      option_b: '7.2 days',
      option_c: '8.0 days',
      option_d: '7.5 days',
      correct_answer: 'b',
      marks: 1,
      difficulty: 'Medium',
      topic: 'Quantitative Aptitude (Time & Work)',
      display_order: 2,
    },
    {
      id: 'qec-03',
      exam_code: 'LW-VRSEC-2026',
      question: 'In how many different ways can the letters of the word "LOGIC" be arranged such that all vowels always come together?',
      option_a: '24',
      option_b: '48',
      option_c: '120',
      option_d: '72',
      correct_answer: 'b',
      marks: 1,
      difficulty: 'Medium',
      topic: 'Quantitative Aptitude (Permutations)',
      display_order: 3,
    },
    // Sector 2: Logical Reasoning (Set B)
    {
      id: 'qec-04',
      exam_code: 'LW-VRSEC-2026',
      question: 'Statements: All algorithms are programs. Some programs are scripts. Conclusions: I. Some algorithms are scripts. II. No script is an algorithm.',
      option_a: 'Only conclusion I follows',
      option_b: 'Only conclusion II follows',
      option_c: 'Either conclusion I or II follows',
      option_d: 'Neither conclusion I nor II follows',
      correct_answer: 'c',
      marks: 1,
      difficulty: 'Medium',
      topic: 'Logical Reasoning (Syllogisms)',
      display_order: 4,
    },
    {
      id: 'qec-05',
      exam_code: 'LW-VRSEC-2026',
      question: 'Pointing to a photograph of a boy, Suresh said, "He is the son of the only son of my mother." How is Suresh related to that boy?',
      option_a: 'Brother',
      option_b: 'Uncle',
      option_c: 'Father',
      option_d: 'Grandfather',
      correct_answer: 'c',
      marks: 1,
      difficulty: 'Easy',
      topic: 'Logical Reasoning (Blood Relations)',
      display_order: 5,
    },
    // Sector 3: Core Computer Science (Set C)
    {
      id: 'qec-06',
      exam_code: 'LW-VRSEC-2026',
      question: 'What is the primary function of the Memory Management Unit (MMU) in modern operating systems?',
      option_a: 'Execute floating point arithmetic operations',
      option_b: 'Translate virtual memory addresses into physical RAM addresses',
      option_c: 'Directly manage disk partition sector allocations',
      option_d: 'Cache L1 instructions for multithreaded CPU cores',
      correct_answer: 'b',
      marks: 1,
      difficulty: 'Medium',
      topic: 'Operating Systems (Memory Management)',
      display_order: 6,
    },
    {
      id: 'qec-07',
      exam_code: 'LW-VRSEC-2026',
      question: 'Which of the following conditions is NOT one of Coffman\'s four necessary conditions for a deadlock in an OS?',
      option_a: 'Mutual Exclusion',
      option_b: 'Hold and Wait',
      option_c: 'Preemption Allowed',
      option_d: 'Circular Wait',
      correct_answer: 'c',
      marks: 1,
      difficulty: 'Hard',
      topic: 'Operating Systems (Deadlocks)',
      display_order: 7,
    },
    {
      id: 'qec-08',
      exam_code: 'LW-VRSEC-2026',
      question: 'Which normal form eliminates partial functional dependencies on a candidate key in relational databases?',
      option_a: 'First Normal Form (1NF)',
      option_b: 'Second Normal Form (2NF)',
      option_c: 'Third Normal Form (3NF)',
      option_d: 'Boyce-Codd Normal Form (BCNF)',
      correct_answer: 'b',
      marks: 1,
      difficulty: 'Medium',
      topic: 'Database Systems (Normalization)',
      display_order: 8,
    },
    // Sector 4: Data Structures & Algorithms (Set D)
    {
      id: 'qec-09',
      exam_code: 'LW-VRSEC-2026',
      question: 'What is the worst-case time complexity of searching for a node in an unbalanced Binary Search Tree (BST)?',
      option_a: 'O(1)',
      option_b: 'O(log n)',
      option_c: 'O(n)',
      option_d: 'O(n log n)',
      correct_answer: 'c',
      marks: 1,
      difficulty: 'Medium',
      topic: 'Data Structures (Trees)',
      display_order: 9,
    },
    {
      id: 'qec-10',
      exam_code: 'LW-VRSEC-2026',
      question: 'Which data structure is fundamentally utilized in Depth-First Search (DFS) graph traversal?',
      option_a: 'Queue (FIFO)',
      option_b: 'Stack (LIFO)',
      option_c: 'Min-Heap',
      option_d: 'Circular Buffer',
      correct_answer: 'b',
      marks: 1,
      difficulty: 'Easy',
      topic: 'Algorithms (Graph Traversal)',
      display_order: 10,
    },
    {
      id: 'qec-11',
      exam_code: 'LW-VRSEC-2026',
      question: 'Which sorting algorithm has a guaranteed worst-case time complexity of O(n log n) and does not rely on random pivots?',
      option_a: 'QuickSort',
      option_b: 'BubbleSort',
      option_c: 'MergeSort',
      option_d: 'InsertionSort',
      correct_answer: 'c',
      marks: 1,
      difficulty: 'Medium',
      topic: 'Algorithms (Sorting & Complexity)',
      display_order: 11,
    },
    // Sector 5: Full-Stack & System Design (Set E)
    {
      id: 'qec-12',
      exam_code: 'LW-VRSEC-2026',
      question: 'In JavaScript / Node.js, where do microtasks (such as Promise.then callbacks) execute relative to macrotasks (such as setTimeout)?',
      option_a: 'After all pending macrotasks finish in the next tick',
      option_b: 'Immediately after the current synchronous script and before the next macrotask',
      option_c: 'In parallel on a separate background worker thread',
      option_d: 'Only when the call stack has been empty for at least 100ms',
      correct_answer: 'b',
      marks: 1,
      difficulty: 'Hard',
      topic: 'JavaScript (Event Loop)',
      display_order: 12,
    },
    {
      id: 'qec-13',
      exam_code: 'LW-VRSEC-2026',
      question: 'Which React hook memoizes an expensive calculation between re-renders and recalculates only when dependencies change?',
      option_a: 'useCallback',
      option_b: 'useMemo',
      option_c: 'useRef',
      option_d: 'useEffect',
      correct_answer: 'b',
      marks: 1,
      difficulty: 'Easy',
      topic: 'React (Performance & Hooks)',
      display_order: 13,
    },
    {
      id: 'qec-14',
      exam_code: 'LW-VRSEC-2026',
      question: 'Which HTTP status code is most appropriate when a requested resource requires authentication that has failed or is missing?',
      option_a: '400 Bad Request',
      option_b: '401 Unauthorized',
      option_c: '403 Forbidden',
      option_d: '422 Unprocessable Entity',
      correct_answer: 'b',
      marks: 1,
      difficulty: 'Easy',
      topic: 'Web Architecture (HTTP Standards)',
      display_order: 14,
    },
    {
      id: 'qec-15',
      exam_code: 'LW-VRSEC-2026',
      question: 'In distributed systems and microservices, what does the "C" in the CAP theorem strictly stand for?',
      option_a: 'Concurrency',
      option_b: 'Consistency',
      option_c: 'Coherence',
      option_d: 'Channel',
      correct_answer: 'b',
      marks: 1,
      difficulty: 'Medium',
      topic: 'System Design (CAP Theorem)',
      display_order: 15,
    },
    // Also seed for LW-APCRT-2026
    {
      id: 'qec-ap-01',
      exam_code: 'LW-APCRT-2026',
      question: 'What is the sum of all interior angles of a regular hexagon?',
      option_a: '540°',
      option_b: '720°',
      option_c: '900°',
      option_d: '1080°',
      correct_answer: 'b',
      marks: 1,
      difficulty: 'Easy',
      topic: 'Quantitative Aptitude (Geometry)',
      display_order: 1,
    },
    {
      id: 'qec-ap-02',
      exam_code: 'LW-APCRT-2026',
      question: 'What is the evaluated output of typeof typeof 42 in JavaScript?',
      option_a: "'number'",
      option_b: "'string'",
      option_c: "'undefined'",
      option_d: "'object'",
      correct_answer: 'b',
      marks: 1,
      difficulty: 'Medium',
      topic: 'Programming Logic (JavaScript)',
      display_order: 2,
    },
    {
      id: 'qec-ap-03',
      exam_code: 'LW-APCRT-2026',
      question: 'Which protocol operates at the Transport Layer of the OSI model to provide reliable, ordered stream delivery?',
      option_a: 'UDP',
      option_b: 'IP',
      option_c: 'TCP',
      option_d: 'ICMP',
      correct_answer: 'c',
      marks: 1,
      difficulty: 'Easy',
      topic: 'Computer Networks (OSI Model)',
      display_order: 3,
    },
  ],
  exam_code_attempts: [
    {
      id: 'eca-001',
      exam_code: 'LW-VRSEC-2026',
      hall_ticket_no: '22VR1A0501',
      student_name: 'Aarav Sharma',
      score: 15,
      max_score: 15,
      percentage: 100,
      time_taken_seconds: 780,
      violation_count: 0,
      status: 'completed',
      submitted_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    },
    {
      id: 'eca-002',
      exam_code: 'LW-VRSEC-2026',
      hall_ticket_no: '22VR1A0502',
      student_name: 'Neha Patel',
      score: 14,
      max_score: 15,
      percentage: 93.3,
      time_taken_seconds: 910,
      violation_count: 0,
      status: 'completed',
      submitted_at: new Date(Date.now() - 3600000 * 1.5).toISOString(),
      created_at: new Date(Date.now() - 3600000 * 2.5).toISOString(),
    },
    {
      id: 'eca-003',
      exam_code: 'LW-VRSEC-2026',
      hall_ticket_no: '22VR1A0503',
      student_name: 'Rohan Varma',
      score: 13,
      max_score: 15,
      percentage: 86.7,
      time_taken_seconds: 1040,
      violation_count: 1,
      status: 'completed',
      submitted_at: new Date(Date.now() - 3600000 * 1).toISOString(),
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: 'eca-004',
      exam_code: 'LW-VRSEC-2026',
      hall_ticket_no: '22VR1A0504',
      student_name: 'K. Sneha Reddy',
      score: 12,
      max_score: 15,
      percentage: 80.0,
      time_taken_seconds: 1120,
      violation_count: 0,
      status: 'completed',
      submitted_at: new Date(Date.now() - 1800000).toISOString(),
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'eca-005',
      exam_code: 'LW-VRSEC-2026',
      hall_ticket_no: '22VR1A0505',
      student_name: 'V. Sai Teja',
      score: 11,
      max_score: 15,
      percentage: 73.3,
      time_taken_seconds: 1250,
      violation_count: 0,
      status: 'completed',
      submitted_at: new Date(Date.now() - 900000).toISOString(),
      created_at: new Date(Date.now() - 2400000).toISOString(),
    },
  ],
};

// Seed DEMO123 into exam_codes
const demoCodes = ['DEMO123', 'DEMO100', 'CS2026'];
if (!store.exam_codes.find(e => e.exam_code === 'DEMO123')) {
  store.exam_codes.push({
    id: 123,
    exam_code: 'DEMO123',
    code: 'DEMO123',
    college_id: 1,
    exam_name: 'LogicWhileLiRE 4.0 - National Engineering Qualifier',
    subject: 'Aptitude, Core CS, DSA & Live Coding Sandbox',
    total_questions: 15,
    duration_minutes: 60,
    start_time: new Date(Date.now() - 86400000).toISOString(),
    end_time: new Date(Date.now() + 86400000 * 60).toISOString(),
    is_active: true,
    created_by_staff_id: 'st000000-0000-0000-0000-000000000001',
    created_at: new Date().toISOString(),
  });
}

// Ensure both code and exam_code exist on all items
store.exam_codes.forEach(ec => {
  if (!ec.code) ec.code = ec.exam_code;
  if (!ec.exam_code) ec.exam_code = ec.code;
});

// Seed questions for CS2026, DEMO100, and DEMO123
demoCodes.forEach(code => {
  store.questions_ec.filter(q => q.exam_code === 'LW-VRSEC-2026').forEach(q => {
    if (!store.questions_ec.find(existing => existing.exam_code === code && existing.id.endsWith(q.id))) {
      store.questions_ec.push({
        ...q,
        id: `${code.toLowerCase()}-${q.id}`,
        exam_code: code,
      });
    }
  });

  // Add coding challenge questions with runnable test cases
  const codingQuestions = [
    {
      id: `${code.toLowerCase()}-code-01`,
      exam_code: code,
      question: `⚡ CODING CHALLENGE: Two Sum\n\nGiven an integer N, followed by N space-separated integers on the second line, and a target integer T on the third line, determine if any two distinct integers sum up to T.\n\nPrint "True" if such a pair exists, otherwise print "False".`,
      question_text: `⚡ CODING CHALLENGE: Two Sum\n\nGiven an integer N, followed by N space-separated integers on the second line, and a target integer T on the third line, determine if any two distinct integers sum up to T.\n\nPrint "True" if such a pair exists, otherwise print "False".`,
      option_a: '', option_b: '', option_c: '', option_d: '',
      correct_answer: 'True',
      marks: 10,
      difficulty: 'Medium',
      topic: 'Algorithms (Hash Table / Two Pointers)',
      question_type: 'code',
      display_order: 14,
      test_cases: [
        { id: 'tc-1', input_text: "5\n2 7 11 15 20\n9", expected_output: "True", marks: 3, is_hidden: false },
        { id: 'tc-2', input_text: "4\n1 2 3 9\n8", expected_output: "False", marks: 3, is_hidden: false },
        { id: 'tc-3', input_text: "6\n-3 4 3 90 2 1\n0", expected_output: "True", marks: 4, is_hidden: true },
      ],
    },
    {
      id: `${code.toLowerCase()}-code-02`,
      exam_code: code,
      question: `⚡ CODING CHALLENGE: Palindrome String\n\nRead a single string from standard input and print "True" if the string is a palindrome (reads the same backwards and forwards, case-sensitive), or "False" otherwise.`,
      question_text: `⚡ CODING CHALLENGE: Palindrome String\n\nRead a single string from standard input and print "True" if the string is a palindrome (reads the same backwards and forwards, case-sensitive), or "False" otherwise.`,
      option_a: '', option_b: '', option_c: '', option_d: '',
      correct_answer: 'True',
      marks: 10,
      difficulty: 'Easy',
      topic: 'Algorithms (Strings)',
      question_type: 'code',
      display_order: 15,
      test_cases: [
        { id: 'tc-p1', input_text: "racecar", expected_output: "True", marks: 3, is_hidden: false },
        { id: 'tc-p2', input_text: "logicwhilelire", expected_output: "False", marks: 3, is_hidden: false },
        { id: 'tc-p3', input_text: "deified", expected_output: "True", marks: 4, is_hidden: true },
      ],
    },
  ];

  codingQuestions.forEach(cq => {
    if (!store.questions_ec.find(existing => existing.id === cq.id)) {
      store.questions_ec.push(cq);
    }
  });
});

class MockQueryBuilder {
  private tableName: string;
  private filters: Array<(row: any) => boolean> = [];
  private orderConfig: Array<{ field: string; ascending: boolean }> = [];
  private limitCount?: number;
  private rangeConfig?: { from: number; to: number };
  private singleMode: 'single' | 'maybeSingle' | null = null;
  private selectFields?: string;
  private action: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private payload: any = null;
  private upsertOptions?: any;

  constructor(tableName: string) {
    this.tableName = tableName;
    if (!store[tableName]) {
      store[tableName] = [];
    }
  }

  select(fields: string = '*', _options?: { count?: string }): this {
    if (this.action !== 'insert' && this.action !== 'update' && this.action !== 'upsert') {
      this.action = 'select';
    }
    this.selectFields = fields;
    return this;
  }

  insert(data: any): this {
    this.action = 'insert';
    this.payload = data;
    return this;
  }

  update(data: any): this {
    this.action = 'update';
    this.payload = data;
    return this;
  }

  upsert(data: any, options?: any): this {
    this.action = 'upsert';
    this.payload = data;
    this.upsertOptions = options;
    return this;
  }

  delete(): this {
    this.action = 'delete';
    return this;
  }

  eq(field: string, value: any): this {
    this.filters.push((row) => {
      // Support nested field like 'participant.exam_id'
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        if (parent === 'participant') {
          const participant = store.participants.find((p) => p.id === row.participant_id);
          return participant ? participant[child] === value : false;
        }
      }
      return row[field] === value || String(row[field]) === String(value);
    });
    return this;
  }

  neq(field: string, value: any): this {
    this.filters.push((row) => row[field] !== value);
    return this;
  }

  gt(field: string, value: any): this {
    this.filters.push((row) => new Date(row[field]) > new Date(value));
    return this;
  }

  gte(field: string, value: any): this {
    this.filters.push((row) => new Date(row[field]) >= new Date(value));
    return this;
  }

  lt(field: string, value: any): this {
    this.filters.push((row) => new Date(row[field]) < new Date(value));
    return this;
  }

  lte(field: string, value: any): this {
    this.filters.push((row) => new Date(row[field]) <= new Date(value));
    return this;
  }

  in(field: string, values: any[]): this {
    const set = new Set(values);
    this.filters.push((row) => set.has(row[field]));
    return this;
  }

  is(field: string, value: any): this {
    this.filters.push((row) => row[field] === value);
    return this;
  }

  or(clause: string): this {
    const parts = clause.split(',');
    this.filters.push((row) => {
      return parts.some((part) => {
        const [col, op, val] = part.split('.');
        if (op === 'eq') return row[col] === val;
        if (op === 'neq') return row[col] !== val;
        return false;
      });
    });
    return this;
  }

  filter(field: string, operator: string, value: any): this {
    if (operator === 'eq') return this.eq(field, value);
    if (operator === 'neq') return this.neq(field, value);
    if (operator === 'in') return this.in(field, Array.isArray(value) ? value : [value]);
    return this;
  }

  order(field: string, options?: { ascending?: boolean }): this {
    this.orderConfig.push({
      field,
      ascending: options?.ascending !== false,
    });
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  range(from: number, to: number): this {
    this.rangeConfig = { from, to };
    return this;
  }

  single(): this {
    this.singleMode = 'single';
    return this;
  }

  maybeSingle(): this {
    this.singleMode = 'maybeSingle';
    return this;
  }

  csv(): Promise<{ data: string; error: null }> {
    return this.execute().then(({ data }) => {
      const rows = Array.isArray(data) ? data : [data];
      if (rows.length === 0) return { data: '', error: null };
      const headers = Object.keys(rows[0]);
      const csv = [
        headers.join(','),
        ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(',')),
      ].join('\n');
      return { data: csv, error: null };
    });
  }

  private resolveJoins(row: any): any {
    const clone = { ...row };

    // Normalize question format if from questions table
    if (this.tableName === 'questions') {
      if (!clone.question && clone.question_text) clone.question = clone.question_text;
      if (!clone.question_text && clone.question) clone.question_text = clone.question;
      if (!clone.options) {
        clone.options = {
          a: clone.option_a || 'Option A',
          b: clone.option_b || 'Option B',
          c: clone.option_c || 'Option C',
          d: clone.option_d || 'Option D',
        };
      }
      if (!clone.option_a && clone.options) {
        clone.option_a = clone.options.a;
        clone.option_b = clone.options.b;
        clone.option_c = clone.options.c;
        clone.option_d = clone.options.d;
      }
    }

    // Attach participant if row has participant_id
    if (clone.participant_id) {
      const p = store.participants.find((item) => item.id === clone.participant_id);
      if (p) clone.participant = { ...p };
    }
    // Attach college if row has college_id
    if (clone.college_id && store.colleges) {
      const c = store.colleges.find((item) => item.id === clone.college_id || String(item.id) === String(clone.college_id));
      if (c) clone.college = { ...c };
    }
    // Attach session if row has session_id
    if (clone.session_id) {
      const s = store.exam_sessions.find((item) => item.id === clone.session_id);
      if (s) {
        const sClone = { ...s };
        if (sClone.participant_id) {
          sClone.participant = store.participants.find((p) => p.id === sClone.participant_id);
        }
        clone.session = sClone;
      }
    }
    return clone;
  }

  private execute(): Promise<{ data: any; error: any; count?: number }> {
    const table = store[this.tableName];

    if (this.action === 'insert') {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload];
      const inserted: any[] = [];
      for (const item of items) {
        const record = {
          id: item.id || uuidv4(),
          created_at: new Date().toISOString(),
          ...item,
        };
        table.push(record);
        inserted.push(this.resolveJoins(record));
      }
      const res = (this.singleMode === 'single' || !Array.isArray(this.payload)) ? inserted[0] : inserted;
      return Promise.resolve({ data: res, error: null });
    }

    if (this.action === 'update') {
      const updated: any[] = [];
      for (let i = 0; i < table.length; i++) {
        if (this.filters.every((f) => f(table[i]))) {
          table[i] = { ...table[i], ...this.payload, updated_at: new Date().toISOString() };
          updated.push(this.resolveJoins(table[i]));
        }
      }
      const res = this.singleMode === 'single' ? updated[0] || null : updated;
      return Promise.resolve({ data: res, error: null });
    }

    if (this.action === 'upsert') {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload];
      const result: any[] = [];
      for (const item of items) {
        let index = -1;
        if (item.id) {
          index = table.findIndex((r) => r.id === item.id);
        } else if (item.participant_id && this.tableName === 'results') {
          index = table.findIndex((r) => r.participant_id === item.participant_id);
        } else if (item.session_id && item.question_id && this.tableName === 'session_answers') {
          index = table.findIndex((r) => r.session_id === item.session_id && r.question_id === item.question_id);
        }

        if (index >= 0) {
          table[index] = { ...table[index], ...item, updated_at: new Date().toISOString() };
          result.push(this.resolveJoins(table[index]));
        } else {
          const newRecord = {
            id: item.id || uuidv4(),
            created_at: new Date().toISOString(),
            ...item,
          };
          table.push(newRecord);
          result.push(this.resolveJoins(newRecord));
        }
      }
      const res = (this.singleMode === 'single' || !Array.isArray(this.payload)) ? result[0] : result;
      return Promise.resolve({ data: res, error: null });
    }

    if (this.action === 'delete') {
      const remaining: any[] = [];
      const deleted: any[] = [];
      for (const row of table) {
        if (this.filters.every((f) => f(row))) {
          deleted.push(row);
        } else {
          remaining.push(row);
        }
      }
      store[this.tableName] = remaining;
      return Promise.resolve({ data: deleted, error: null });
    }

    // Default: 'select'
    let rows = table.filter((row) => this.filters.every((f) => f(row))).map((r) => this.resolveJoins(r));

    // Sort
    if (this.orderConfig.length > 0) {
      rows.sort((a, b) => {
        for (const { field, ascending } of this.orderConfig) {
          const valA = a[field];
          const valB = b[field];
          if (valA === valB) continue;
          if (valA === undefined || valA === null) return 1;
          if (valB === undefined || valB === null) return -1;
          if (valA < valB) return ascending ? -1 : 1;
          if (valA > valB) return ascending ? 1 : -1;
        }
        return 0;
      });
    }

    const totalCount = rows.length;

    // Range / Limit
    if (this.rangeConfig) {
      rows = rows.slice(this.rangeConfig.from, this.rangeConfig.to + 1);
    } else if (this.limitCount !== undefined) {
      rows = rows.slice(0, this.limitCount);
    }

    // Column projection if specific fields were requested (and not a join with sub-selects)
    if (this.selectFields && this.selectFields !== '*' && !this.selectFields.includes('(') && !this.selectFields.includes('count(')) {
      const requestedFields = this.selectFields
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean);

      rows = rows.map((r) => {
        const projected: any = {};
        for (const field of requestedFields) {
          if (field.includes(':')) {
            const [alias, col] = field.split(':').map((s) => s.trim());
            projected[alias] = r[col || alias];
          } else {
            projected[field] = r[field];
          }
        }
        return projected;
      });
    }

    if (this.singleMode === 'single') {
      if (rows.length === 0) {
        return Promise.resolve({ data: null, error: { message: 'Row not found', code: 'PGRST116' } });
      }
      return Promise.resolve({ data: rows[0], error: null });
    }

    if (this.singleMode === 'maybeSingle') {
      return Promise.resolve({ data: rows[0] || null, error: null });
    }

    return Promise.resolve({ data: rows, error: null, count: totalCount });
  }

  // Promise implementation
  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null
  ): Promise<any | TResult> {
    return this.execute().catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<any> {
    return this.execute().finally(onfinally);
  }
}

export const mockSupabase = {
  from(tableName: string) {
    return new MockQueryBuilder(tableName);
  },
  channel(_name: string) {
    return {
      on(_event: string, _filter: any, _callback: Function) {
        return this;
      },
      subscribe() {
        return this;
      },
      send(_payload: any) {
        return Promise.resolve('ok');
      },
      track(_payload: any) {
        return Promise.resolve('ok');
      },
    };
  },
  removeChannel(_channel: any) {},
};
