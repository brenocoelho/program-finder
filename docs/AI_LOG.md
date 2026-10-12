# AI usage log

Started: TBD. Finished: TBD. Total: TBD.
I used Claude Code in VS Code during the timed work (the model is noted in each entry). Before the clock, I used Claude to research the company and SBA lending, get up to speed on React Router v8, and plan my approach and my Claude Code setup.
I reviewed every change before committing, and all the commits are mine.
Raw transcripts: attached to my submission email, one per phase. They include the assessment brief, so I kept them out of the repo.

## Entries (oldest first, added with /ai-log)

### 2026-10-12 12:20 | Understanding | Claude Code in VS Code, Claude Opus 5.5
- Goal: understand the problem and the data before writing a spec or code, and settle the open business rules.
- Prompt (short): "Read docs/private/brief.md and data/programs.csv. Don't write code yet. Write docs/UNDERSTANDING.md…", then "go through the 8 open questions".
- What the AI produced: docs/UNDERSTANDING.md (the rep's problem, a table of every column, unstated user expectations, 8 open questions with defaults, 5 test scenarios from real rows with expected results), "What this is" in CLAUDE.md, then 8 multiple-choice questions and the D1–D8 entries.
- What I kept: the column table, the scenarios, and its recommended answer on 6 of the 8 questions.
- What I changed or threw away, and why: rejected years + months for time in business and kept whole years with a "full years" hint (reason in D2). On stale data I first chose no warning, then switched to warn after 31 days once the AI pointed out that a rep could read an old rate as current (D8). I didn't edit the docs by hand.
- Key decision I made: credit matches on tier, plus the minimum score when the rep has one ([D1](DECISIONS.md)); all 8 are in [docs/DECISIONS.md](DECISIONS.md) D1–D8.
- Evidence: docs/UNDERSTANDING.md, docs/DECISIONS.md, CLAUDE.md; transcript: 01-understand.txt (attached to the email).

### 2026-10-12 13:14 | Scoping and planning | Claude Code in VS Code, Claude Opus 5.5
- Goal: settle what was still open after D1–D8 (V1 scope, labels, input style, folders, and the rest), then write a contract-style spec.
- Prompt (short): "Ask me only what is still open, one by one… After that, write docs/SPEC.md… Build order: tasks of 20 minutes, around 150 minutes in total, mark with [CUT-FIRST]…"
- What the AI produced: 13 multiple-choice questions, one at a time, which became D9–D20 plus a D13 follow-up; docs/SPEC.md (scope, FR/NFR with a latency budget, domain types, rules table, Postgres schema, routes, test plan, build order); "Where things go" in CLAUDE.md. It also checked the scenarios against the CSV and found that three expected results in UNDERSTANDING.md were missing near misses on credit tier.
- What I kept: the spec structure and its recommended answer on most questions (scope after a second round, labels, live input, empty fields, rep codes, the Recommended button, CLI import, rejecting bad files, the rate flag).
- What I changed or threw away, and why: put share in V2 because anything sent to a borrower needs approved wording (D9). Chose one app/components/ folder over ui/ per area (D14). Changed D13 from two separate rules to one credit rule, because typing more information must not hide options. Changed D20 from basic checks to wide limits after the AI showed that a 6800 typo would show "Fits". Marked the rate-changed flag [CUT-FIRST] because with one CSV the rep never sees it (D19). Had the AI fix the scenario counts in UNDERSTANDING.md. The AI got its own D13 example wrong at first and corrected it before editing.
- Key decision I made: tier and score count as one credit rule for "Close" ([D13](DECISIONS.md)); all of them are in [docs/DECISIONS.md](DECISIONS.md) D9–D20.
- Evidence: docs/SPEC.md, docs/DECISIONS.md, docs/UNDERSTANDING.md, CLAUDE.md; transcript:  02-spec.txt (attached to the email).

### 2026-10-12 13:38 | Building | Claude Code in VS Code, Claude Sonnet 5.5
- Goal: scaffold the project (Postgres in Docker, migrations, env module, request id and logging middleware, /healthz) with no feature code.
- Prompt (short): "Scaffold of the project. Read docs/SPEC.md and put the files in the folders CLAUDE.md says… When I approve: build it, run npm run setup and typecheck, and fix what breaks. Don't start the dev server."
- What the AI produced: a plan I approved, then docker-compose.yml, the env/db/logger modules, root middleware (request id, Server-Timing), /healthz, 0001_init.sql with the rep seed, a migrate script, npm scripts, and a Vitest config. It checked setup, a second migrate run and the built /healthz (up and down) before reporting.
- What I kept: the file layout, the migration runner, the middleware and /healthz, bigint-as-number for cents (max is $50M), and no migration checksum (one line in docs/KNOWN_ISSUES.md).
- What I changed or threw away, and why: `npm test` skipped the integration tests, so it now runs unit and integration projects against finder_test, with the test database migrated first. The dev server crashed on the pino-pretty transport; the AI had only checked the production build, so I had it use plain JSON logs everywhere and remove pino-pretty. The ErrorBoundary with the request id moved to the finder step.
- Key decision I made: rep codes are seeded inside 0001_init.sql ([D21](DECISIONS.md)), and setup migrates only the dev database ([D22](DECISIONS.md)).
- Evidence: docker-compose.yml, db/migrations/0001_init.sql, scripts/migrate.ts, app/shared/, app/routes/healthz.ts, vitest.config.ts; transcript:  03-scaffold.txt (attached to the email).

### 2026-10-12 13:55 | Building | Claude Code in VS Code, Claude Sonnet 5.5
- Goal: the catalog import (task 4): CSV to programs or issues, one transaction, a bad file rejected as a whole, `npm run db:import`, and a `/data-health` page.
- Prompt (short): "Now the catalog import. Read the types, the rules and the schema in the spec. First the tests… Run them and confirm they fail. Then write the code until they pass…"
- What the AI produced: tests first (money, dates, row parser with 5 real rows and a broken fixture, integration), then `app/programs/` (row schema, parser, import, live catalog, data health), `shared/money.ts` and `shared/date.ts`, the import script, `/data-health`, and D23. It stopped once to ask how to treat range limits.
- What I kept: schema limits only plus an `out_of_range` code ([D23](DECISIONS.md)); the parser, import and page as written. The AI's same-file-twice test caught a bug in the spec: the idempotency key created a second import. The fix is a same-hash-as-live check, and SPEC section 5 was updated.
- What I changed or threw away, and why: TODO(Breno). The notes say a score range was added to the import and the import chained into `db:reset` for the demo. At the time of this entry neither is in the working tree (the score has only the schema limit, and `db:reset` still only migrates), and D23 chose schema limits only.
- Key decision I made: range limits are the schema's, plus `out_of_range` ([D23](DECISIONS.md), reason still to be written).
- Evidence: app/programs/, app/shared/money.ts, app/shared/date.ts, scripts/import-programs.ts, app/routes/data-health.tsx, docs/DECISIONS.md D23; transcript: 04-catalog.txt (to be exported).

### 2026-10-12 14:11 | Testing and Building | Claude Code in VS Code, Claude Sonnet 5.5
- Goal: the match engine (task 2): tests first from the rules table, then the engine until they pass.
- Prompt (short): "Write only the tests first… Show me the tests and the scenario table, and stop." Then, after my answers: "Now write the engine until every test passes. Each check needs a text that is easy to read in the UI."
- What the AI produced: `match.test.ts` (rule edges, statuses, lender-checks-later, stale, ranking, fast-check properties) and `match-scenarios.test.ts` (S1–S8 against `data/programs.csv`), with expected lists from a separate reference script, not the engine. It stopped with two questions. After my answers it wrote `rules.ts`, `match.ts`, `rules-version.ts` constants, `formatCents`, `daysBetween`, D24 and D25, and the SPEC edits. typecheck and `npm test` green (269 tests).
- What I kept: the tests and the engine as written. I checked all 8 scenario counts against the CSV with another script before any engine code, and all matched. Scenarios read `data/programs.csv` directly so a catalog change fails them on purpose.
- What I changed or threw away, and why: the `importId` test was removed on my decision to drop it from `MatchResult` (D25). Nothing else was discarded. The AI wrote "Borrower: 1 yr", not the "1.5 yrs" of my example, because D2 makes years whole; TODO(Breno): confirm that is what you want. The NFR-2 benchmark was left out on purpose (KNOWN_ISSUES).
- Key decision I made: a program with no minimum passes the years rule even when years are empty ([D24](DECISIONS.md)); the engine knows nothing about imports ([D25](DECISIONS.md)). The reasons for the D13 follow-up and D23 were also written down this session.
- Evidence: app/matching/ (rules.ts, match.ts, match.test.ts, match-scenarios.test.ts), docs/DECISIONS.md D24–D25, docs/SPEC.md §3, §4, §7, §8; transcript: 05-match-engine.txt (to be exported).
