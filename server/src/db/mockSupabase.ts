import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';

if (process.env.NODE_ENV === 'production') {
  throw new Error('FATAL: mockSupabase and pre-seeded demo accounts must never be loaded in production mode.');
}

export interface MockTableData {
  staff: any[];
  students: any[];
  academic_years: any[];
  cohorts: any[];
  sections: any[];
  batches: any[];
  curriculum: any[];
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
  student_roster: any[];
  mail_logs: any[];
  [key: string]: any[];
}

export const DEMO_EXAM_ID = 'e1000000-0000-0000-0000-000000000001';
export const DEMO_EXAM_2_ID = 'e2000000-0000-0000-0000-000000000002';

export const DEMO_PASSWORD_HASH = '$2b$10$5clufsDpS3i07SC0fOiN0umtVP3XKEjUEb4tDZp4YSokgY3EF1/lq'; // bcrypt hash for 'admin123'

// In-memory store
const store: MockTableData = {
  staff: [
    {
      id: 'e6fa7676-2798-4b3c-b452-37d455bb3585',
      name: 'Super Administrator',
      username: 'admin',
      email: 'admin@logicwhilelire.com',
      phone: '+919999999999',
      password_hash: '$2b$12$Y65kU/s0HBji1KPpvVjjh.fXc1.p4T.B35JH3xj82W7Udi6PDGPeu',
      role: 'super_admin',
      college_id: null,
      failed_attempts: 0,
      locked_until: null,
      reset_token_hash: null,
      reset_token_expires: null,
      totp_secret: null,
      is_2fa_enabled: false,
      totp_enabled: false,
      must_change_password: false,
      is_active: true,
      permissions: ['create_questions', 'upload_excel', 'view_results', 'export_data', 'manage_exams', 'manage_students'],
      created_by: null,
      created_at: new Date().toISOString(),
    },
    {
      id: 'insp-0000-0000-0000-000000000001',
      name: 'Chief Exam Inspector',
      username: 'inspector',
      email: 'inspector@logicwhilelire.com',
      phone: '+919999999998',
      password_hash: bcrypt.hashSync(process.env.INSPECTOR_PASSWORD || 'LiREInspector@2026!', 10),
      role: 'inspector',
      college_id: 1,
      failed_attempts: 0,
      locked_until: null,
      reset_token_hash: null,
      reset_token_expires: null,
      totp_secret: null,
      is_2fa_enabled: false,
      totp_enabled: false,
      must_change_password: false,
      is_active: true,
      permissions: ['start_exam', 'end_exam', 'view_live_telemetry', 'view_dashboard'],
      created_by: null,
      created_at: new Date().toISOString(),
    },
    {
      id: 'fac-0000-0000-0000-000000000001',
      name: 'Faculty Trainer',
      username: 'faculty',
      email: 'faculty@logicwhilelire.com',
      phone: '+919999999997',
      password_hash: bcrypt.hashSync(process.env.FACULTY_PASSWORD || 'faculty123', 10),
      role: 'faculty',
      college_id: 1,
      failed_attempts: 0,
      locked_until: null,
      reset_token_hash: null,
      reset_token_expires: null,
      totp_secret: null,
      is_2fa_enabled: false,
      totp_enabled: false,
      must_change_password: false,
      is_active: true,
      permissions: ['view_results', 'view_dashboard', 'manage_students', 'create_questions'],
      created_by: null,
      created_at: new Date().toISOString(),
    },
  ],
  students: [
    {
      id: 's1000000-0000-0000-0000-000000000001',
      name: 'Aarav Sharma',
      email: 'aarav.sharma@vrsec.edu',
      roll_number: '2201A0509',
      hall_ticket: '2201A0509',
      college_id: 1,
      academic_year_id: 1,
      cohort_id: 'coh-vrsec-2026',
      section_id: 'sec-vrsec-csm-a',
      batch_id: 'batch-vrsec-a1',
      is_active: true,
      is_verified: true,
      must_change_password: false,
      created_at: new Date().toISOString(),
    },
  ],
  academic_years: [
    {
      id: 1,
      college_id: 1,
      year_name: '2025-2026',
      start_date: '2025-06-01',
      end_date: '2026-05-31',
      is_current: true,
      created_at: new Date().toISOString(),
    },
  ],
  cohorts: [
    {
      id: 'coh-vrsec-2026',
      cohort_id: 'coh-vrsec-2026',
      name: 'Class of 2026',
      college_id: 1,
      academic_year_id: 1,
      yop: 2026,
      branch: 'CSE',
      created_at: new Date().toISOString(),
    },
  ],
  sections: [
    {
      id: 'sec-vrsec-csm-a',
      section_id: 'sec-vrsec-csm-a',
      name: 'A',
      cohort_id: 'coh-vrsec-2026',
      college_id: 1,
      created_at: new Date().toISOString(),
    },
  ],
  batches: [
    {
      id: 'batch-vrsec-a1',
      batch_id: 'batch-vrsec-a1',
      name: 'Batch 1',
      section_id: 'sec-vrsec-csm-a',
      college_id: 1,
      created_at: new Date().toISOString(),
    },
  ],
  curriculum: [],
  exams: [
    {
      id: 'e1000000-0000-0000-0000-000000000001',
      title: 'Full Stack Engineering Qualifier 2026',
      exam_code: 'DEMO123',
      college_id: 1,
      created_by_staff_id: 'st000000-0000-0000-0000-000000000002',
      status: 'active',
      duration_minutes: 60,
      created_at: new Date().toISOString(),
    },
  ],
  participants: [
    {
      id: 'p1000000-0000-0000-0000-000000000001',
      exam_id: 'e1000000-0000-0000-0000-000000000001',
      hall_ticket: '2201A0509',
      email: 'aarav.sharma@vrsec.edu',
      student_name: 'Aarav Sharma',
      status: 'completed',
      score: 45,
      college_id: 1,
      created_at: new Date().toISOString(),
    },
  ],
  exam_sessions: [],
  session_answers: [],
  questions: [],
  exam_codes: [
    {
      id: 'ec-0000-0000-0000-000000000001',
      exam_code: 'LW-VRSEC-2026',
      title: 'LogicWhileLiRE Assessment 2026',
      exam_name: 'LogicWhileLiRE Assessment 2026',
      college_id: 1,
      duration_minutes: 60,
      is_active: true,
      max_participants: 500,
      status: 'active',
      created_at: new Date().toISOString(),
    },
  ],
  questions_ec: [
    {
      id: 'qec-1',
      exam_code: 'LW-VRSEC-2026',
      question_text: 'What is the time complexity of searching an element in a balanced binary search tree?',
      option_a: 'O(log n)',
      option_b: 'O(n)',
      option_c: 'O(1)',
      option_d: 'O(n log n)',
      correct_answer: 'A',
      marks: 2,
      difficulty: 'Easy',
      topic: 'DSA',
    },
    {
      id: 'qec-2',
      exam_code: 'LW-VRSEC-2026',
      question_text: 'Which data structure uses LIFO (Last In First Out) ordering?',
      option_a: 'Stack',
      option_b: 'Queue',
      option_c: 'Array',
      option_d: 'Linked List',
      correct_answer: 'A',
      marks: 2,
      difficulty: 'Easy',
      topic: 'DSA',
    },
  ],
  violations: [],
  suspicious_activity: [],
  results: [],
  deliverable_failures: [],
  audit_log: [],
  student_roster: [
    {
      id: 'roster-01',
      college_id: 1,
      roll_number: '2201A0501',
      name: 'Aravind Swamy',
      section: 'A',
      cohort_id: 'coh-vrsec-2026',
      email: 'aravind@campus.edu',
    },
    {
      id: 'roster-02',
      college_id: 1,
      roll_number: '2201A0502',
      name: 'Bhavana Reddy',
      section: 'B',
      cohort_id: 'coh-vrsec-2026',
      email: 'bhavana.lockout@campus.edu',
    },
    {
      id: 'roster-03',
      college_id: 1,
      roll_number: '2201A0503',
      name: 'Charan Sai',
      section: 'A',
      cohort_id: 'coh-vrsec-2026',
      email: 'charan@campus.edu',
    },
    {
      id: 'roster-04',
      college_id: 1,
      roll_number: '2201A0504',
      name: 'Divya Teja',
      section: 'B',
      cohort_id: 'coh-vrsec-2026',
      email: 'divya@campus.edu',
    },
  ],
  colleges: [
    {
      id: 1,
      college_name: 'VR Siddhartha Engineering College',
      code: 'VRSEC',
      college_code: 'VRSEC',
      is_active: true,
      registration_enabled: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 2,
      college_name: 'RVR & JC College of Engineering',
      code: 'RVRJC',
      college_code: 'RVRJC',
      is_active: true,
      registration_enabled: true,
      created_at: new Date().toISOString(),
    },
  ],
  exam_code_attempts: [],
  email_queue: [],
  mail_logs: [],
};

// Aliases matching Postgres compatibility views
(store as any).candidates = store.participants;
(store as any).sessions = store.exam_sessions;
(store as any).audit_logs = store.audit_log;

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

  ilike(field: string, pattern: string): this {
    const clean = pattern.replace(/%/g, "").toLowerCase();
    this.filters.push((row) => String(row[field] || "").toLowerCase().includes(clean));
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
    if (this.tableName === 'pg_tables') {
      const allKnownTables = [
        'academic_years', 'audit_log', 'batches', 'cohorts', 'colleges',
        'deliverable_failures', 'email_queue', 'exam_code_attempts', 'exam_codes',
        'exam_sessions', 'exams', 'leaderboard', 'participants', 'platform_settings',
        'proctor_logs', 'questions', 'questions_ec', 'results', 'sections',
        'session_answers', 'staff', 'student_roster', 'students', 'suspicious_activity',
        'violations'
      ];
      const rows = allKnownTables.map((t) => ({
        schemaname: 'public',
        tablename: t,
        rowsecurity: true,
      }));
      return Promise.resolve({ data: rows, error: null, count: rows.length });
    }

    if (!store[this.tableName]) {
      store[this.tableName] = [];
    }
    const table = store[this.tableName];

    if (this.action === 'insert') {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload];
      const inserted: any[] = [];
      for (const item of items) {
        if (this.tableName === 'students' && item.college_id && (item.roll_number || item.hall_ticket)) {
          const roll = (item.roll_number || item.hall_ticket || '').toUpperCase();
          const exists = table.find(
            (s: any) =>
              String(s.college_id) === String(item.college_id) &&
              (s.roll_number || s.hall_ticket || '').toUpperCase() === roll &&
              s.is_verified !== false
          );
          if (exists) {
            return Promise.resolve({
              data: null,
              error: {
                code: '23505',
                message: 'duplicate key value violates unique constraint "uq_college_roll"',
              },
            });
          }
        }
        const record: any = {
          id: item.id || uuidv4(),
          created_at: new Date().toISOString(),
          ...item,
        };
        if (this.tableName === "audit_log" || this.tableName === "audit_logs") {
          record.user_id = record.user_id || item.admin_id || item.payload?.user_id;
          record.role = record.role || item.role || item.payload?.role;
          record.college_id = record.college_id ?? item.college_id ?? item.payload?.college_id ?? null;
          record.target = record.target || item.payload?.target || (item.target_table ? `${item.target_table}:${item.target_id}` : "system");
          record.ip = record.ip || item.ip_address || item.payload?.ip;
          record.user_agent = record.user_agent || item.payload?.user_agent;
          record.timestamp = record.timestamp || item.payload?.timestamp || record.created_at;
        }
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

      const includesWildcard = requestedFields.includes('*');

      rows = rows.map((r) => {
        const projected: any = includesWildcard ? { ...r } : {};
        for (const field of requestedFields) {
          if (field === '*') continue;
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
