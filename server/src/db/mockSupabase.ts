import { v4 as uuidv4 } from 'uuid';

export interface MockTableData {
  staff: any[];
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

export const DEMO_SUPER_ADMIN_ID = 'st000000-0000-0000-0000-000000000001';
export const DEMO_FACULTY_1_ID = 'st000000-0000-0000-0000-000000000002';
export const DEMO_FACULTY_2_ID = 'st000000-0000-0000-0000-000000000003';

export const DEMO_EXAM_ID = 'e1000000-0000-0000-0000-000000000001';
export const DEMO_EXAM_2_ID = 'e2000000-0000-0000-0000-000000000002';

// In-memory store
const store: MockTableData = {
  staff: [
    {
      id: DEMO_SUPER_ADMIN_ID,
      name: 'LogicWhile Super Admin',
      email: 'admin@logicwhilequiz.com',
      password_hash: '$2b$12$kP1ZkxGsbQgL.PSNBA/ts.vFh6WhJ57LGOrf4biA7vQT7K0qiJTL.',
      role: 'super_admin',
      created_by: null,
      is_active: true,
      created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
    },
    {
      id: DEMO_FACULTY_1_ID,
      name: 'Dr. Suresh Kumar (CRT Pillar)',
      email: 'suresh@logicwhile.com',
      password_hash: '$2b$12$kP1ZkxGsbQgL.PSNBA/ts.vFh6WhJ57LGOrf4biA7vQT7K0qiJTL.',
      role: 'faculty',
      created_by: DEMO_SUPER_ADMIN_ID,
      is_active: true,
      created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    },
    {
      id: DEMO_FACULTY_2_ID,
      name: 'Priya Sharma (Coding Institute)',
      email: 'priya@logicwhile.com',
      password_hash: '$2b$12$kP1ZkxGsbQgL.PSNBA/ts.vFh6WhJ57LGOrf4biA7vQT7K0qiJTL.',
      role: 'faculty',
      created_by: DEMO_SUPER_ADMIN_ID,
      is_active: true,
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
  ],
  exams: [
    {
      id: DEMO_EXAM_ID,
      title: 'LogicWhile — Full-Stack & System Design Assessment 2026',
      duration_minutes: 30,
      start_time: new Date(Date.now() - 3600000).toISOString(),
      end_time: new Date(Date.now() + 86400000 * 7).toISOString(),
      admin_email: 'admin@logicwhilequiz.com',
      is_leaderboard_public: true,
      is_active: true,
      created_by_staff_id: DEMO_FACULTY_1_ID,
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: DEMO_EXAM_2_ID,
      title: 'Computer Science Core & Data Structures Sprint',
      duration_minutes: 45,
      start_time: new Date(Date.now() - 86400000).toISOString(),
      end_time: new Date(Date.now() + 86400000 * 14).toISOString(),
      admin_email: 'admin@logicwhilequiz.com',
      is_leaderboard_public: true,
      is_active: true,
      created_by_staff_id: DEMO_FACULTY_2_ID,
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
};

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
      return row[field] === value;
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

    // Attach staff/creator if row has created_by_staff_id
    if (clone.created_by_staff_id && store.staff) {
      const st = store.staff.find((item) => item.id === clone.created_by_staff_id);
      if (st) {
        clone.staff = { id: st.id, name: st.name, email: st.email, role: st.role };
        clone.creator = { id: st.id, name: st.name, email: st.email, role: st.role };
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
    };
  },
  removeChannel(_channel: any) {},
};
