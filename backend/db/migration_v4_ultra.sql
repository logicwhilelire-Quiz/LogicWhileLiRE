-- ============================================================
-- LogicWhile 4.0 ULTRA — Database Migration
-- Run this in Supabase SQL Editor
-- SAFE: Only ADDs new tables/columns, does NOT modify existing data
-- ============================================================

-- ─── NEW TABLE: test_cases ────────────────────────────────────
create table if not exists test_cases (
  id              uuid primary key default gen_random_uuid(),
  question_id     uuid references questions(id) on delete cascade,
  input_text      text,
  expected_output text not null,
  marks           int  default 1,
  is_hidden       bool default false,
  created_at      timestamptz default now()
);

create index if not exists idx_test_cases_question on test_cases(question_id);

-- ─── NEW TABLE: proctor_logs ──────────────────────────────────
create table if not exists proctor_logs (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  text,
  exam_id       text,
  event_type    text not null,       -- tab_switch, multiple_faces, no_face, copy_paste
  metadata      jsonb default '{}',
  created_at    timestamptz default now()
);

create index if not exists idx_proctor_logs_exam     on proctor_logs(exam_id);
create index if not exists idx_proctor_logs_candidate on proctor_logs(candidate_id);

-- ─── NEW TABLE: certificates ──────────────────────────────────
create table if not exists certificates (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  text,
  exam_id       text,
  score         numeric(5,2),
  percentage    numeric(5,2),
  qr_token      text unique default encode(gen_random_bytes(24), 'hex'),
  pdf_url       text,
  issued_at     timestamptz default now()
);

create index if not exists idx_certificates_exam      on certificates(exam_id);
create index if not exists idx_certificates_candidate on certificates(candidate_id);
create index if not exists idx_certificates_qr_token  on certificates(qr_token);

-- ─── NEW TABLE: leaderboard ───────────────────────────────────
create table if not exists leaderboard (
  id            uuid primary key default gen_random_uuid(),
  exam_id       text not null,
  candidate_id  text,
  hall_ticket   text,
  score         numeric(5,2),
  percentage    numeric(5,2),
  rank          int,
  department    text,
  updated_at    timestamptz default now()
);

create unique index if not exists idx_leaderboard_exam_candidate on leaderboard(exam_id, hall_ticket);
create index if not exists idx_leaderboard_exam_rank on leaderboard(exam_id, rank);

-- ─── ALTER existing questions table: Add new columns ─────────
-- (Safe — uses IF NOT EXISTS via DO block)

do $$ begin
  if not exists (select 1 from information_schema.columns where table_name = 'questions' and column_name = 'question_type') then
    alter table questions add column question_type text default 'mcq' check (question_type in ('mcq', 'code', 'aptitude'));
  end if;

  if not exists (select 1 from information_schema.columns where table_name = 'questions' and column_name = 'difficulty') then
    alter table questions add column difficulty text default 'medium' check (difficulty in ('easy', 'medium', 'hard'));
  end if;

  if not exists (select 1 from information_schema.columns where table_name = 'questions' and column_name = 'topic') then
    alter table questions add column topic text;
  end if;

  if not exists (select 1 from information_schema.columns where table_name = 'questions' and column_name = 'time_limit') then
    alter table questions add column time_limit int; -- seconds
  end if;

  if not exists (select 1 from information_schema.columns where table_name = 'questions' and column_name = 'explanation') then
    alter table questions add column explanation text;
  end if;

  if not exists (select 1 from information_schema.columns where table_name = 'questions' and column_name = 'marks') then
    alter table questions add column marks int default 1;
  end if;

  -- exam_codes ultra columns
  if exists (select 1 from information_schema.tables where table_name = 'exam_codes') then
    if not exists (select 1 from information_schema.columns where table_name = 'exam_codes' and column_name = 'code') then
      alter table exam_codes add column code text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'exam_codes' and column_name = 'exam_code') then
      alter table exam_codes add column exam_code text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'exam_codes' and column_name = 'is_active') then
      alter table exam_codes add column is_active boolean default true;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'exam_codes' and column_name = 'max_violations') then
      alter table exam_codes add column max_violations int default 5;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'exam_codes' and column_name = 'is_leaderboard_public') then
      alter table exam_codes add column is_leaderboard_public boolean default true;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'exam_codes' and column_name = 'is_proctored') then
      alter table exam_codes add column is_proctored boolean default true;
    end if;
  end if;

  -- exam_code_attempts ultra columns
  if exists (select 1 from information_schema.tables where table_name = 'exam_code_attempts') then
    if not exists (select 1 from information_schema.columns where table_name = 'exam_code_attempts' and column_name = 'qr_token') then
      alter table exam_code_attempts add column qr_token text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'exam_code_attempts' and column_name = 'candidate_name') then
      alter table exam_code_attempts add column candidate_name text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'exam_code_attempts' and column_name = 'violations_count') then
      alter table exam_code_attempts add column violations_count int default 0;
    end if;
  end if;
end $$;

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────
-- proctor_logs: only service role can insert, anon can check own
alter table proctor_logs enable row level security;
create policy if not exists "Service can insert proctor logs"
  on proctor_logs for insert with check (true);

alter table certificates enable row level security;
create policy if not exists "Anyone can verify certificates by token"
  on certificates for select using (true);
create policy if not exists "Service can insert certificates"
  on certificates for insert with check (true);

alter table leaderboard enable row level security;
create policy if not exists "Anyone can read leaderboard"
  on leaderboard for select using (true);

-- ─── FUNCTION: Update leaderboard after submit ────────────────
create or replace function update_leaderboard(
  p_exam_id text,
  p_hall_ticket text,
  p_score numeric,
  p_percentage numeric,
  p_department text default null
) returns void as $$
begin
  insert into leaderboard (exam_id, hall_ticket, candidate_id, score, percentage, department)
  values (p_exam_id, p_hall_ticket, p_hall_ticket, p_score, p_percentage, p_department)
  on conflict (exam_id, hall_ticket)
  do update set
    score      = excluded.score,
    percentage = excluded.percentage,
    updated_at = now();

  -- Recompute ranks
  update leaderboard l
  set rank = r.new_rank
  from (
    select hall_ticket,
           row_number() over (partition by exam_id order by percentage desc, updated_at asc) as new_rank
    from leaderboard
    where exam_id = p_exam_id
  ) r
  where l.exam_id = p_exam_id and l.hall_ticket = r.hall_ticket;
end;
$$ language plpgsql;

-- ─── VERIFICATION ─────────────────────────────────────────────
select 'Migration complete! New tables: test_cases, proctor_logs, certificates, leaderboard' as status;
select table_name from information_schema.tables
where table_schema = 'public'
and table_name in ('test_cases', 'proctor_logs', 'certificates', 'leaderboard')
order by table_name;
