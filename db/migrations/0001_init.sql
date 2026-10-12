-- 0001: schema from docs/SPEC.md section 5, plus the rep codes (D15, D21).
-- Safe to run twice. Never edit this file after it has run; add a new migration.

create table if not exists schema_migrations (
  filename    text primary key,
  applied_at  timestamptz not null default now()
);

create table if not exists data_imports (
  id               bigint generated always as identity primary key,
  idempotency_key  text not null unique,
  source_name      text not null,
  file_sha256      text not null,
  status           text not null check (status in ('accepted','rejected')),
  row_count        int  not null check (row_count >= 0),
  issue_count      int  not null check (issue_count >= 0),
  rules_version    int  not null,
  created_at       timestamptz not null default now()
);

create table if not exists programs (
  id                      bigint generated always as identity primary key,
  import_id               bigint not null references data_imports(id),
  row_number              int  not null,
  program_key             text not null,
  lender_name             text not null,
  program_type            text not null,
  min_loan_cents          bigint not null check (min_loan_cents > 0),
  max_loan_cents          bigint not null check (max_loan_cents >= min_loan_cents),
  min_credit_score        int  not null check (min_credit_score > 0),
  credit_tier_required    text not null check (credit_tier_required in ('Fair','Good','Excellent')),
  min_years_in_business   int  not null check (min_years_in_business >= 0),
  rate_min_bp             int  not null check (rate_min_bp >= 0),
  rate_max_bp             int  not null check (rate_max_bp >= rate_min_bp),
  max_term_months         int  not null check (max_term_months > 0),
  sba_guarantee_bp        int  not null check (sba_guarantee_bp between 0 and 10000),
  eligible_business_type  text not null,
  requires_collateral     text not null check (requires_collateral in ('Yes','No','Varies')),
  max_debt_ratio_bp       int  check (max_debt_ratio_bp >= 0),
  turnaround_days         int  not null check (turnaround_days >= 0),
  special_requirements    text,
  last_updated            date not null,
  unique (import_id, program_key)
);
create index if not exists programs_import_idx on programs (import_id);

create table if not exists data_issues (
  id           bigint generated always as identity primary key,
  import_id    bigint not null references data_imports(id),
  row_number   int,
  column_name  text,
  value        text,
  code         text not null,
  message      text not null
);
create index if not exists data_issues_import_idx on data_issues (import_id);

create table if not exists reps (
  id          bigint generated always as identity primary key,
  code        text not null unique check (code ~ '^[A-Z][0-9]{2}$'),
  role        text not null check (role in ('rep','manager')),
  created_at  timestamptz not null default now()
);

insert into reps (code, role) values
  ('R01', 'rep'), ('R02', 'rep'), ('R03', 'rep'), ('R04', 'rep'),
  ('R05', 'rep'), ('R06', 'rep'), ('R07', 'rep'), ('R08', 'rep'),
  ('M01', 'manager'), ('M02', 'manager')
on conflict (code) do nothing;

create table if not exists recommendation_events (
  id                 bigint generated always as identity primary key,
  idempotency_key    uuid not null unique,
  rep_id             bigint not null references reps(id),
  program_id         bigint not null references programs(id),
  program_key        text not null,
  import_id          bigint not null references data_imports(id),
  status             text not null check (status in ('fits','close')),
  close_rule         text check (close_rule in ('amount','years','credit')),
  amount_cents       bigint not null check (amount_cents > 0),
  business_type      text not null,
  credit_tier        text not null check (credit_tier in ('Fair','Good','Excellent')),
  years_in_business  int not null check (years_in_business >= 0),
  score_given        boolean not null,
  rules_version      int not null,
  created_at         timestamptz not null default now(),
  check ((status = 'close') = (close_rule is not null))
);
create index if not exists rec_events_created_idx on recommendation_events (created_at);
