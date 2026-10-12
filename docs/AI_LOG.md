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
