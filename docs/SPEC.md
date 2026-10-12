# Program Finder: V1 spec

Contracts for V1. Business rules come from `data/programs.csv`, [UNDERSTANDING.md](UNDERSTANDING.md) and [DECISIONS.md](DECISIONS.md) (D1–D20). `RULES_VERSION = 1`. Any rule change bumps it and updates this spec, the tests and DECISIONS.md together.

## 1. Scope

| # | Ask (from the team) | Value on a call | Effort | Release |
|---|---|---|---|---|
| 1 | Filter by borrower criteria | The core: the answer while the borrower waits | L (engine, import, screen) | **V1** |
| 3 | Rate and term details | What the rep says next: "from 5.5%, up to 20 years" | S (columns on each row) | **V1** |
| 4 | Eligibility at a glance | Why it fits, the one thing in the way, what the lender will check | S (comes from the engine) | **V1** |
| 6 | Flag when lender rates are updated | Stops an old rate being read as current | S: "rates as of" + stale warning (D8) + /data-health. XS: "rate changed" badge (D19) | **V1** stale warning. Rate-changed badge is **[CUT-FIRST]**: with one CSV there is nothing to compare (D19) |
| 7 | Managers: which programs reps recommend most | Coaching, partner talks. Not used on the call | M: rep code, Recommend button, /insights | **V1** |
| 2 | Side-by-side comparison | Answers "which one is better?" | S: aligned rows give most of it for free. M: a pick-and-compare view | **V1** aligned rows. Pick-and-compare is a late task, **[CUT-FIRST]** (D9) |
| 5 | Save or share with the borrower | Follow-up after the call | L: borrower-facing page, disclaimers, a public link | **V2** (D9) |

**Not in V1:** share (5), undo for a recommendation (D16), uploading a CSV in the browser (D17), login (D15), filtering on debt ratio, collateral or special requirements (D6), revenue (no column uses it).

## 2. Requirements

### Functional (each one is testable)

| ID | Requirement |
|---|---|
| FR-1 | No results until the loan amount and business type are filled. Until then the results area says "Enter the loan amount and business type to see programs." (D12) |
| FR-2 | Inputs are checked against wide typo limits (D20). Amount: whole dollars, $1 to $50,000,000 (`$`, commas and spaces are allowed). Years: a whole number, 0 to 99. Score: a whole number, 300 to 850, optional. Business type: one of the live list or "Other". Tier: Excellent, Good, Fair or empty. An invalid field shows its error next to the field, and **no results** are shown (never results for an older input). |
| FR-3 | Each program is checked against every rule in section 4 and gets pass, fail or unknown per rule. |
| FR-4 | Each program lands in exactly one group: **Fits**, **Close**, **Ask first**, **Doesn't fit** (D10, section 4). |
| FR-5 | A Close row names its one problem (amount, years or credit) and the gap, e.g. "$10,000 over this lender's max ($250,000)". When credit fails on both tier and score, both are named: "Needs Good credit or better and 680+ score (borrower: 650)". |
| FR-6 | An Ask first row names the empty fields it needs, e.g. "Ask: credit tier". |
| FR-7 | Inside every group, rows are ordered by lowest starting rate, then fastest turnaround, then lender name, then program type (D7). Comparison is by code point, not locale. |
| FR-8 | Every row shows, in the same columns in every group: lender and program type, rate range, max term, days to a decision, collateral, and what it needs (amount range, tier, min score as "needs 680+", min years). Under it: "Lender will check: …" (debt ratio, special requirements; D6) and "Rates as of <date>". SBA guarantee goes in a Details disclosure. |
| FR-9 | A row whose `last_updated` is more than 31 days before today shows a visible warning: "Rates may be out of date (as of Jan 16, 2026)". Exactly 31 days is not stale. (D8) |
| FR-10 **[CUT-FIRST]** | Compared with the previous accepted import, a row shows "Rate changed: was 11.0%–13.6%" when its rate min or max differs, and "New program" when its key wasn't there. No badges on the first import ever. (D19) |
| FR-11 | Results update about 250 ms after the last change. Inputs live in the URL, so refresh restores the same search. Older results stay on screen while new ones load, and a newer search always wins over a slower older one. (D11) |
| FR-12 | When no import has been accepted yet, the screen says "No program data loaded yet" and shows no groups. It never says "nothing fits". |
| FR-13 | Import (CLI, D17): a valid file becomes the live data. Any invalid row rejects the whole file. Every issue is saved with its row number, column and message, and the previous live data stays live (D18). Importing the file that is already live does nothing and says so. |
| FR-14 | `/data-health` shows the live import (date, rows, file hash), the last 10 imports with status, every issue of the latest import, and how many live rows are stale. With FR-10 [CUT-FIRST]: also what changed in the live import (new programs, rate changes, programs removed). |
| FR-15 | A rep picks their rep code once at `/rep`. It's kept in a signed cookie, and the header shows "Rep R03 · change". (D15) |
| FR-16 | Fits and Close rows have a "Recommended" button (D16). The server re-checks that the program is still Fits or Close for those inputs against the live data, then saves one event. The same idempotency key never counts twice. Without a rep code, the button is a link to `/rep`. |
| FR-17 | `/insights` shows recommendation counts per program (total, as Fits, as Close) and per rep code for the last 7 days, 30 days or all time. The default is 30, and the window is in the URL. |
| FR-18 **[CUT-FIRST]** | Up to 3 Fits/Close rows can be ticked "Compare". `?compare=` holds their keys, and a panel above the results shows them as columns with the same fields as FR-8. |
| FR-19 | Any unexpected error shows a plain message and the request id, never a stack trace. |

### Non-functional

| ID | Requirement | Number | How we know |
|---|---|---|---|
| NFR-1 | **Latency budget, main screen** | `/` loader p95 **≤ 100 ms** server time (db ≤ 40 ms, match ≤ 5 ms). Keystroke to updated results p95 **≤ 500 ms** on localhost (including the 250 ms debounce). Warm first page load ≤ 1 s. | `Server-Timing: db, match, total` on every response. Playwright measures keystroke to results. |
| NFR-2 | Match engine speed | 1,000 programs ≤ 5 ms per search | Unit benchmark (the assertion is a 50 ms ceiling, so the test doesn't flake) |
| NFR-3 | Other pages | `/data-health`, `/insights` loader ≤ 300 ms at 10,000 events | Server-Timing |
| NFR-4 | Determinism | Same inputs + same import id + same today give the same groups in the same order | fast-check property |
| NFR-5 | Money and rates | Integer cents (`bigint` in Postgres), integer basis points, months as integers. No floats anywhere in rules or storage | Types + Zod + DB column types |
| NFR-6 | Privacy | No borrower names or contact fields exist. Rep codes only, no names. The score value is never stored or logged (only `score_given`). Logs use structured fields | Code review + a test that the event row has no score column |
| NFR-7 | Accessibility | axe: 0 serious or critical on `/`, `/rep`, `/data-health`, `/insights`. The main path works keyboard-only. Every field has a visible label | Playwright + axe |
| NFR-8 | Setup | Clone to running in ≤ 5 min with README steps (brief) | Manual check from a clean clone |
| NFR-9 | Import | 1,000 rows ≤ 2 s, one transaction | Integration test |
| NFR-10 | Screen | Built for a desktop at 1280 px or wider. At 1024 px the result tables scroll inside their own box, and the page never scrolls sideways | Manual |

## 3. Domain model

Pure TypeScript in `app/matching/` and `app/programs/`. Types are inferred from Zod schemas where data crosses a boundary.

```ts
// app/shared/money.ts
type Cents = number;          // integer, Number.isSafeInteger
type BasisPoints = number;    // integer: 11.4% -> 1140, ratio 0.5 -> 5000
type IsoDate = string;        // "2026-01-16", from M/D/YYYY in the CSV

dollarsTextToCents("$250,000"): Cents | null   // whole dollars only
percentTextToBp("13.6"): BasisPoints | null     // ≤ 2 decimals, string math, no floats
ratioTextToBp("0.45"): BasisPoints | null       // ≤ 4 decimals
formatCents(25_000_000) -> "$250,000"; formatBp(1140) -> "11.4%"

// app/programs/program.ts
type CreditTier = "Fair" | "Good" | "Excellent";            // rank 1 < 2 < 3 (D1)
type Collateral = "Yes" | "No" | "Varies";
type ProgramKey = string;                                   // `${lender_name}|${program_type}` (D19)
type RateChange =                                           // [CUT-FIRST] with FR-10; without it the field doesn't exist
  | { kind: "first_import" }
  | { kind: "unchanged" }
  | { kind: "new" }
  | { kind: "rate_changed"; prevRateMinBp: BasisPoints; prevRateMaxBp: BasisPoints };

type Program = {
  id: number; importId: number; rowNumber: number; key: ProgramKey;
  lenderName: string; programType: string;
  minLoanCents: Cents; maxLoanCents: Cents;
  minCreditScore: number; creditTierRequired: CreditTier;
  minYearsInBusiness: number;                               // whole years (D2)
  rateMinBp: BasisPoints; rateMaxBp: BasisPoints;
  maxTermMonths: number;
  sbaGuaranteeBp: BasisPoints;
  eligibleBusinessType: string;                             // "All" or one industry
  requiresCollateral: Collateral;
  maxDebtRatioBp: BasisPoints | null;                       // 9 rows blank
  turnaroundDays: number;
  specialRequirements: string | null;
  lastUpdated: IsoDate;
  rateChange: RateChange;                                   // [CUT-FIRST]
};

// app/matching/borrower-input.ts  (Zod schema on URL search params -> this)
type BorrowerInput = {
  amountCents: Cents;                // required for results (D12)
  businessType: string;              // live list or "Other" (D5)
  creditTier: CreditTier | null;     // null = unknown
  yearsInBusiness: number | null;    // null = unknown
  creditScore: number | null;        // null = not typed: score rule not run (D1)
};

// app/matching/match.ts
type RuleName = "amount" | "industry" | "years" | "tier" | "score";
type RuleResult =
  | { rule: RuleName; outcome: "pass" }
  | { rule: RuleName; outcome: "unknown" }
  | { rule: "amount"; outcome: "fail"; direction: "over" | "under"; gapCents: Cents; limitCents: Cents }
  | { rule: "industry"; outcome: "fail"; required: string }
  | { rule: "years"; outcome: "fail"; needed: number; has: number }
  | { rule: "tier"; outcome: "fail"; needed: CreditTier; has: CreditTier }
  | { rule: "score"; outcome: "fail"; needed: number; has: number };

type Status = "fits" | "close" | "ask_first" | "no_fit";
type Problem = "amount" | "years" | "credit";              // tier and score fails count as one "credit" problem (D4, D13)
type Evaluation = {
  program: Program; status: Status; rules: RuleResult[]; stale: boolean;
  closeProblem: Problem | null;                             // set only when status is "close"
};
type MatchResult = {
  rulesVersion: number; importId: number;
  fits: Evaluation[]; close: Evaluation[]; askFirst: Evaluation[]; noFit: Evaluation[];
};

matchPrograms(input: BorrowerInput, programs: Program[], today: IsoDate): MatchResult  // pure
```

Constants in `app/matching/rules-version.ts`: `RULES_VERSION = 1`, `STALE_AFTER_DAYS = 31`, `TIER_RANK`.

## 4. Business rules

| Rule | Column(s) | Pass | Fail | Unknown | Can be Close? | Rep sees |
|---|---|---|---|---|---|---|
| Amount | `min_loan_amount`, `max_loan_amount` | min ≤ amount ≤ max, both ends inclusive (D3) | amount < min or > max | never (required, D12) | yes (D4) | "$10,000 over this lender's max ($250,000)" / "$5,000 under the min ($10,000)" |
| Business type | `eligible_business_types` | value is `All`, or equals the type. "Other" passes only `All` (D5) | anything else | never (required) | **never** (D4) | Doesn't fit: "Only for Manufacturing". On an `All` row when the type is Other: "Lender confirms the business type" |
| Years | `min_years_in_business` | years ≥ min (whole years, D2) | years < min | field empty | yes | "Needs 2+ years in business (borrower: 1)" |
| Credit tier | `credit_tier_required` | rank(input) ≥ rank(required), Excellent 3 > Good 2 > Fair 1 (D1) | rank lower | field empty | yes, as part of credit (D13) | "Needs Good credit or better" |
| Credit score | `min_credit_score` | only run when a score is typed: score ≥ min (D1) | score < min | not run when empty (it is not unknown, D1) | yes, as part of credit: tier and score together are one problem (D13) | Always on the row: "needs 680+". On fail: "Needs 680+ score (borrower: 650)" |
| Stale (display) | `last_updated` | today − last_updated ≤ 31 days | > 31 days → warning (D8) | — | — | "Rates may be out of date (as of Jan 16, 2026)" |
| Rate change (display) **[CUT-FIRST]** | `interest_rate_min/_max` vs previous accepted import | — | — | — | — | "Rate changed: was 11.0%–13.6%" / "New program" (D19) |
| Lender will check (display) | `max_existing_debt_ratio`, `special_requirements`, `requires_collateral` | never filter (D6) | — | — | — | "Lender will check: debt ratio up to 50% · No recent bankruptcies (7 years)". Collateral has its own column |

**Status** (first match wins):

| Status | Condition |
|---|---|
| Doesn't fit | industry fails |
| Fits | every rule that runs passes, none unknown |
| Ask first | no rule fails, at least one is unknown |
| Close | exactly one problem among amount, years and credit, and none is unknown. Credit = tier and/or score failing (D4, D12, D13) |
| Doesn't fit | everything else (2+ problems, or a problem plus an unknown) |

A typed score can still move a row from Close to Doesn't fit when the row already misses on amount or years. That's two problems, and the row shows both reasons (D13 follow-up).

Screen order: Fits, Close, Ask first, then Doesn't fit, collapsed with its count (a native `<details>`; each row says why). Each group uses the D7 order (FR-7).

## 5. Data model (Postgres 16)

`db/migrations/0001_init.sql`. Every statement is `IF NOT EXISTS`, so running it twice is safe. A `schema_migrations(filename text primary key, applied_at timestamptz)` table records what ran. The four history tables are append-only: app code never runs UPDATE or DELETE on them.

```sql
create table if not exists data_imports (
  id               bigint generated always as identity primary key,
  idempotency_key  text not null unique,            -- sha256(file) || ':' || previous live import id (or 'none')
  source_name      text not null,                   -- file name only, no path
  file_sha256      text not null,
  status           text not null check (status in ('accepted','rejected')),
  row_count        int  not null check (row_count >= 0),
  issue_count      int  not null check (issue_count >= 0),
  rules_version    int  not null,
  created_at       timestamptz not null default now()
);
-- Live data = the accepted import with the highest id.

create table if not exists programs (
  id                      bigint generated always as identity primary key,
  import_id               bigint not null references data_imports(id),
  row_number              int  not null,              -- CSV line, header = 1
  program_key             text not null,              -- lender_name|program_type
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

-- [CUT-FIRST] FR-10, its own migration (0002_rate_change.sql) only if built:
-- alter table programs add column if not exists rate_change text not null default 'first_import'
--   check (rate_change in ('first_import','unchanged','new','rate_changed'));
-- alter table programs add column if not exists prev_rate_min_bp int;
-- alter table programs add column if not exists prev_rate_max_bp int;
create index if not exists programs_import_idx on programs (import_id);

create table if not exists data_issues (
  id           bigint generated always as identity primary key,
  import_id    bigint not null references data_imports(id),
  row_number   int,                                   -- null = whole-file issue (missing column, empty file)
  column_name  text,
  value        text,                                  -- first 200 chars
  code         text not null,                         -- missing_value | not_a_number | not_whole_number | negative | too_many_decimals | min_over_max | unknown_tier | unknown_collateral | bad_date | duplicate_program | missing_column | empty_file | out_of_range | malformed_csv   -- the last two added in D23
  message      text not null
);
create index if not exists data_issues_import_idx on data_issues (import_id);

create table if not exists reps (
  id          bigint generated always as identity primary key,
  code        text not null unique check (code ~ '^[A-Z][0-9]{2}$'),   -- R01..R08, M01, M02; no names (D15)
  role        text not null check (role in ('rep','manager')),
  created_at  timestamptz not null default now()
);

create table if not exists recommendation_events (
  id               bigint generated always as identity primary key,
  idempotency_key  uuid not null unique,              -- made in the browser once per (search, program)
  rep_id           bigint not null references reps(id),
  program_id       bigint not null references programs(id),   -- the live version when clicked
  program_key      text not null,
  import_id        bigint not null references data_imports(id),
  status           text not null check (status in ('fits','close')),
  close_rule       text check (close_rule in ('amount','years','credit')),
  amount_cents     bigint not null check (amount_cents > 0),
  business_type    text not null,
  credit_tier      text not null check (credit_tier in ('Fair','Good','Excellent')),
  years_in_business int not null check (years_in_business >= 0),
  score_given      boolean not null,                  -- never the score itself (NFR-6)
  rules_version    int not null,
  created_at       timestamptz not null default now(),
  check ((status = 'close') = (close_rule is not null))
);
create index if not exists rec_events_created_idx on recommendation_events (created_at);
```

Writes:
- **Import:** one transaction under `pg_advisory_xact_lock`. If the file's hash equals the live import's, it's a no-op ("already live"). Otherwise insert `data_imports` `ON CONFLICT (idempotency_key) DO NOTHING`; if nothing was inserted, it's a no-op (a retry of a rejected file). Then insert either every `programs` row (accepted) or every `data_issues` row (rejected). The key alone can't catch "already live": it names the live import, which the file's own import was saved before.
- **Recommend:** a single insert `ON CONFLICT (idempotency_key) DO NOTHING`.
- **Reps:** R01–R08 and M01–M02 are inserted by `0001_init.sql` with `INSERT … ON CONFLICT (code) DO NOTHING` (D21). There's no add-reps script.

## 6. Routes and endpoints

`app/routes.ts`: `index("routes/home.tsx")`, `route("rep", …)`, `route("recommend", …)`, `route("data-health", …)`, `route("insights", …)`.

| Path | Export | Inputs (Zod) | Output | Errors |
|---|---|---|---|---|
| `/` | `loader` | search params `amount`, `type`, `tier`, `years`, `score`, `compare` [CUT-FIRST] | `{ state: "need_input" \| "invalid" \| "no_data" \| "results", values, fieldErrors, businessTypes: string[], result?: MatchResult (with display strings), liveImport?: {id, createdAt}, rep?: {code}, compare?: Evaluation[] }` | invalid fields → `state: "invalid"` + `fieldErrors`, status 200 (it's a form) |
| `/rep` | `loader` | `returnTo` (a relative path that starts with `/`, otherwise `/`) | `{ codes: {code, role}[], current: string \| null }` | — |
| `/rep` | `action` | form `code`, `returnTo` | `redirect(returnTo)` + `Set-Cookie: rep` | unknown code → 400 `{ fieldErrors }` |
| `/recommend` | `action` only (resource route) | form `programKey`, `idempotencyKey` (uuid), `amount`, `type`, `tier`, `years`, `score`; rep from the cookie | `{ ok: true, eventId, duplicate: boolean }` | no rep → 401 `{ error: "Pick your rep code first" }`. Program no longer Fits/Close against live data → 409 `{ error: "This program no longer fits. Results refreshed." }`. Bad form → 400 |
| `/data-health` | `loader` | none | `{ live?: ImportSummary, history: ImportSummary[] (last 10), latestIssues: DataIssue[], staleCount, liveRowCount, changes?: { new, rateChanged, removed } }` (`changes` only with FR-10 [CUT-FIRST]) | — |
| `/insights` | `loader` | `days` = `7 \| 30 \| all` (anything else → 30) | `{ days, byProgram: {programKey, lenderName, programType, total, asFits, asClose}[], byRep: {code, total}[] }`, ordered by count desc, then key asc | — |

Every route:
- **Root `middleware`** creates the request id and a pino child logger, puts both in a typed context, sets `X-Request-Id`, and writes `Server-Timing` on the way out (the loaders add `db` and `match` durations to the context).
- `ErrorBoundary` shows "Something went wrong. Reference: <request id>". Loaders and actions use one helper, `app/shared/route-errors.server.ts`, which logs an unexpected error with the request id and throws `data({ requestId }, { status: 500 })`.

Logged (structured, no PII): `import.accepted|rejected|noop` (import id, rows, issues), `recommendation.saved|duplicate|stale` (event id, program key, status, rep code), errors. Searches are not logged.

React Router v8 APIs used (one line each, as CLAUDE.md asks):
- **`middleware` + `createContext`**: code that wraps every request. It runs before the loaders and after the response, and passes typed values (request id, logger, timings) to them. One place for the request id and Server-Timing instead of repeating it in every loader.
- **`useSubmit(form, { replace: true })`**: submits the GET form from code after the 250 ms debounce. `replace` stops Back from stepping through every keystroke. React Router cancels the older in-flight request, so a slow old search can't overwrite a new one (FR-11).
- **`useNavigation()`**: tells the screen a new search is loading, so it can show a quiet "Updating…" while keeping the old results (no spinner).
- **`useFetcher()`**: posts the Recommend form without navigating away, so the rep stays on the results, and it gives per-row pending and result state.
- **`createCookie`**: a signed cookie for the rep code (secret from the env module).
- **`data(value, { status })`**: returns or throws a status code with data, for 400, 401, 409 and 500.

## 7. Test plan

Unit tests are pure, run with Vitest, and need no database. Integration tests run against the real test database (`TEST_DATABASE_URL`). Playwright covers the main path only. Scenarios use the real CSV with `today = 2026-10-12` and no score unless stated. The counts come from a reference check against `data/programs.csv`.

| Req | Tests (named after the rule) | Level |
|---|---|---|
| FR-1 | "no results until amount and business type are given"; "tier and years may be empty" | unit (input schema) |
| FR-2 | "$250,000, 250,000 and 250000 are the same amount"; "250000.50 is rejected: whole dollars only"; "$1 and $50,000,000 are accepted"; "$0 and $50,000,001 are rejected"; "0 and 99 years are accepted"; "100 years and 0.5 years are rejected"; "scores 300 and 850 are accepted"; "scores 299 and 851 are rejected"; "a 6800 score typo shows an error and no results, never Fits"; "an empty score means no score"; "an invalid field gives no results" | unit + loader |
| FR-3 | Amount: "exactly the min is accepted", "exactly the max is accepted", "$1 under the min fails", "$1 over the max fails". Industry: "All accepts any type", "Other passes only All rows", "a listed industry fails other industries". Years: "exactly the min passes", "one under fails", "empty is unknown". Tier: "Excellent passes Good and Fair rows", "Fair fails a Good row", "empty is unknown". Score: "not typed: the rule is not run", "exactly the min passes", "one under fails" | unit |
| FR-4 | "an industry fail is never Close"; "one problem plus one unknown is Doesn't fit"; "tier and score both failing is one credit problem: Close (D13)"; "a score fail plus an amount fail is two problems: Doesn't fit (D13 follow-up)". Property (fast-check): "when credit is a row's only problem, typing any score keeps it Close". Scenario counts (Fits / Close / Ask first / Doesn't fit): **S1** Construction $250k Good 3y → 27/0/0/22. **S2** Healthcare $150k Good 2y → 17/5/0/27. **S3** Restaurant $260k Fair 2y → 1/16/0/32. **S4** Retail $50k Good 0y → 0/12/0/37. **S5** Healthcare $300k Fair 2y → 0/16/0/33. **S6** S2 without tier → 0/0/17/32. **S7** S2 + score 650 → 6/11/0/32 (S2's 5 Close rows also fail the score: two problems). **S8** Healthcare $150k Fair 2y + score 650 → 1/16/0/32, the same as with no score | unit (fixture: `__fixtures__/programs.csv` = copy of the data) |
| FR-5 | "S3: First National Bank CA is Close, $10,000 over its $250,000 max"; "S4: Liberty SBA Express is Close on years only"; "S8: a row failing on tier and score names both" | unit |
| FR-6 | "S6: every Ask first row asks for credit tier" | unit |
| FR-7 | "S1 starts with Midwest Business Finance 504 at 5.5%"; "equal rates are ordered by turnaround, then lender, then program"; property: "the same input always gives the same order" (fast-check, shuffled program arrays) | unit + property |
| FR-8 | "a row shows needs 680+ when no score is typed"; "lender will check lists debt ratio and special requirements when present"; "a blank debt ratio is not shown as 0%" | component via loader data (unit) |
| FR-9 | "31 days old is not stale"; "32 days old is stale"; "every row is stale on 2026-10-12" | unit |
| FR-10 [CUT-FIRST] | "first import has no badges"; "a changed rate min is flagged with the old range"; "a new key is flagged New"; "a removed program is listed on /data-health" | unit (diff) + integration |
| FR-11 | "refresh keeps the search"; "typing updates results without a page load" | Playwright |
| FR-12 | "with no accepted import the screen says no data, not nothing fits" | integration (loader) |
| FR-13 | "the sample CSV is accepted with 49 programs"; "one bad row rejects the file and keeps the previous data live"; "each issue has the row number and column"; "importing the live file again does nothing"; "a duplicate lender + program is rejected"; row parser cases for every issue code | unit (parser) + integration |
| FR-14 | "data-health shows the latest rejected import's issues" | integration |
| FR-15 | "an unknown rep code is refused"; "returnTo must be a relative path" | integration |
| FR-16 | "the same idempotency key saves one event"; "a program that no longer fits is refused with 409"; "no rep code is refused with 401"; "the event has no score column" | integration |
| FR-17 | "counts per program for the last 7 days ignore older events"; "ties are ordered by program key" | integration |
| FR-18 [CUT-FIRST] | "more than 3 compare keys keeps the first 3"; "unknown keys are ignored" | unit |
| FR-19 | "an error shows the request id and no stack" | integration (loader) |
| NFR-1, 2, 4, 7 | Server-Timing present on `/`; benchmark of 1,000 programs; determinism property; axe on 4 pages; keyboard-only main path | unit + Playwright |
| Main path (e2e) | Pick rep code → type S3 → see 1 Fits and First National Bank in Close → press Recommended → see it on /insights. Role and label selectors, no fixed waits | Playwright |

## 8. Build order

Each task ends with typecheck and tests green, and is reviewed before the next. Tasks 1–7 are the V1 core, ~140 min. The two [CUT-FIRST] tasks come last and are dropped from the bottom up: the rate-changed flag first (with one CSV the rep never sees it, D19), then pick-and-compare. All in, ~175 min.

**Status (2026-10-12):** task 3 is partly done (the scaffold: Postgres, env, migration + rep seed, migrate script, middleware, `/healthz`, test setup). Pushed back to the finder step (task 5): `route-errors.server.ts`, the ErrorBoundary with the request id, and the FR-19 test. Task 4 (CSV import) is done, with `/data-health` (import summary, rejected imports, issues) built early from task 7; its stale-row count waits for `STALE_AFTER_DAYS` in task 2. Task 1 is partly done (`shared/money.ts`, `shared/date.ts`, `programs/program.ts`; the borrower input schema and the D20 limits are not). Tasks 2, 5, 6, 8, 9 not started.

| # | Task | Min | Done when |
|---|---|---|---|
| 1 | **Money, inputs, program schema** (types and tests first): `shared/money.ts`, `matching/borrower-input.ts` (with the D20 limits), `programs/program.ts`, Vitest config, `npm test` | 20 | FR-1, FR-2 unit tests and money parsing tests pass |
| 2 | **Match engine** (tests first): `matching/rules.ts`, `match.ts` (credit = tier + score as one problem), `rules-version.ts`, CSV fixture, S1–S8, edges, fast-check properties, benchmark | 20 | FR-3–FR-7, FR-9, NFR-2, NFR-4 green |
| 3 | **Database and request plumbing**: `docker-compose.yml` (Postgres 16, port 5433), `0001_init.sql` (schema + rep codes), `scripts/migrate.ts`, `env.server.ts`, `db.server.ts`, `logger.server.ts`, root middleware (request id, Server-Timing), `/healthz`, `route-errors.server.ts`, root ErrorBoundary. **Scaffold done except `route-errors.server.ts`, the ErrorBoundary changes and the FR-19 test** | 20 | migrations run twice cleanly; FR-19 test |
| 4 | **CSV import**: `programs/parse-programs-csv.ts` (pure, rows → programs or issues), `import.server.ts`, `scripts/import-programs.ts`, `npm run db:import` | 20 | FR-13 green; the sample CSV imports 49 rows |
| 5 | **Finder screen**: `routes/home.tsx` loader, `programs.server.ts` (live programs), `components/search-form.tsx` (live, debounced), `result-group.tsx`, `result-row.tsx` (aligned table columns, stale warning, lender will check) | 20 | FR-1–FR-9, FR-11, FR-12 visible in the browser with S1–S5 |
| 6 | **Recommendations (ask 7)**: `reps.server.ts`, `/rep`, rep cookie, `/recommend` action, Recommended button via fetcher, `/insights` | 20 | FR-15–FR-17 integration tests green |
| 7 | **Data health + e2e**: `/data-health` (imports, issues, stale count), Playwright main path, axe on 4 pages, README setup steps | 20 | FR-14, NFR-7 green; the README works from a clean clone |
| 8 | **[CUT-FIRST] Pick and compare**: compare checkboxes, `?compare=`, `components/compare-panel.tsx` | 20 | FR-18 green |
| 9 | **[CUT-FIRST] Rate-changed flag** (dropped first): `0002_rate_change.sql`, `programs/program-changes.ts` (pure diff against the previous accepted import), the badge on the row, "What changed" on `/data-health` | 15 | FR-10 green with a second test CSV |

If time is still short with both cut, drop in this order: the per-rep table on `/insights`, then the keystroke-latency measurement in Playwright (keep Server-Timing). Each cut gets one line in `docs/KNOWN_ISSUES.md`.

Planned known issues (go in `docs/KNOWN_ISSUES.md` when built): the rate-changed flag, if cut (the date and the 31-day warning still show). No login, so anyone can pick any rep code or open `/insights`. No undo for a recommendation. Stale dates use the server's local date. Turnaround days are shown as in the CSV (calendar or business days isn't stated).

Planned scripts (each goes in CLAUDE.md when added): `npm run db:import -- <file>`. Already added: `npm run db:up`, `db:migrate [-- <url>]`, `setup`, `db:reset`, `test` (unit + integration), `test:unit`, `test:integration`, `test:e2e`.
