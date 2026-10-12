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

### 2026-10-12 14:56 | Building | Claude Code in VS Code, Claude Sonnet 5
- Goal: the finder screen (task 5): the loader, search form, grouped results, amount-shorthand parsing, the deferred route-errors.server.ts/ErrorBoundary from task 3, and e2e coverage.
- Prompt (short): "Replace the home page of the template... Amount accepts '250k', '1.2m' and '$250,000'..."; mid-build: "Change of plan, I'm late: don't build compare and don't build the rate-changed flag"; after manual browser testing: "no message when no data is loaded, show 'No program data loaded yet' with a link to /data-health. Add a test."; "the e2e test... contradicted D12... fix to use the full scenario 1... then scenario 3."
- What the AI produced: a plan I approved (money.ts shorthand parsing, parseBorrowerInput, business-types.ts, route-errors.server.ts, the home.tsx loader, 5 components), then the code and tests, then playwright.config.ts and e2e/home.spec.ts (none existed before).
- What I kept: the whole plan and build as written. I verified scenarios S1 and S3 in the browser myself, keyboard-only.
- What I changed or threw away, and why: told the AI mid-build to drop compare and the rate-changed flag (both already [CUT-FIRST]) since I was 40 minutes late; nothing had been built for either, so there was nothing to remove. My own browser check found two problems the AI's own tests missed: the no-data state showed no message at all (fixed, test added), and its first e2e test asserted a Fits heading with tier/years empty, which D12 means can never happen (fixed to enter the full scenario).
- Key decision I made: amount parsing accepts "k"/"m" shorthand by extending `parseDollarsToCents` itself, case-insensitive and combinable with "$"/commas ([D26](DECISIONS.md)).
- Evidence: app/routes/home.tsx, app/components/ (search-form.tsx, result-row.tsx, result-group.tsx, rule-chip.tsx, data-banner.tsx), app/shared/money.ts, app/matching/borrower-input.ts, app/shared/route-errors.server.ts, e2e/home.spec.ts, docs/DECISIONS.md D26, docs/KNOWN_ISSUES.md, docs/SPEC.md §8; transcript: 06-finder-screen.txt (to be exported).

### 2026-10-12 15:21 | Testing | Claude Code in VS Code, Claude Opus 5.5 (review and fixes), then Claude Sonnet 5.5 (e2e and CI)
- Goal: review the finder before the reps use it, fix the worst findings, and add keyboard-only e2e, axe on both pages, and CI.
- Prompt (short): "Look at this with fresh eyes. You are a skeptical staff engineer... only real problems... a table: ID, severity, file:line, problem, why it matters to a rep, fix. Don't change the code."; then "#1: yes... Fix only #1, #2, #4, #5, #6... Put all the other findings in docs/KNOWN_ISSUES.md"; then "Playwright, only chromium... create .github/workflows/ci.yml"; "remove --passWithNoTests... (review #17)".
- What the AI produced: a 17-item review table (it also recomputed S1–S8 from the CSV with its own script before judging the engine); fixes for #1, #2, #4, #5, #6 with 33 new tests; D27 and D28; KNOWN_ISSUES lines; the chromium-only Playwright config, a keyboard-only test, a score-typo test, axe on `/data-health`, `.github/workflows/ci.yml`; the `--passWithNoTests` flags removed.
- What I kept: the review table and all five fixes as proposed; the plan before each build. Typecheck and `npm test` green (347 tests).
- What I changed or threw away, and why: left #3, #7, #8 and #16 for later, and the low findings as one line each in KNOWN_ISSUES, because "I'm out of time. #3 only affects npm start, not the demo, and the current CSV is valid." The AI changed one existing test (Other on an All row) as a result of my #5 decision, not to make it pass. The AI's own first property test for D27 was wrong (it forgot unknown years) and it fixed it before running the suite. TODO(Breno): the e2e results from your own run, and whether the first CI run passed.
- Key decision I made: once credit has failed on the score, an unknown tier is ignored, the same logic as D24 ([D27](DECISIONS.md)); which review findings to defer ([D28](DECISIONS.md)). The AI also pointed out that D27 makes `recommendation_events.credit_tier` need a nullable column in task 6 (KNOWN_ISSUES).
- Evidence: app/matching/match.ts, app/matching/rules.ts, app/components/ (data-banner.tsx, result-row.tsx, rule-chip.tsx, search-form.tsx and their tests), e2e/home.spec.ts, playwright.config.ts, .github/workflows/ci.yml, docs/DECISIONS.md D27–D28, docs/KNOWN_ISSUES.md, docs/SPEC.md §4, §7, §8; transcript: 07-review-and-ci.txt (to be exported).

### 2026-10-12 15:40 | Documentation | Claude Code in VS Code, Claude Sonnet 5
- Goal: write the README for two readers, a reviewer who wants to run it in under 5 minutes and someone who wants my reasons, reading docs/ first.
- Prompt (short): "Write the README... Sections: what it is; how to run it... how to use it on a call, in 5 steps; what is in V1, what I cut and why... Simple words, no hype, no em-dashes." Then: "The README describes things that don't exist. Check every claim against the code, not the spec, and fix: remove the rep code and Recommended steps, remove /insights from V1, describe the e2e tests exactly, scenarios are S1-S9, remove the /insights known-issue line, check what Server-Timing really reports, remove every em-dash, say Playwright starts its own dev server."
- What the AI produced: a full README (what it is, setup, call steps, V1 scope and cuts, an architecture diagram, testing, observability, known issues, a self-assessment placeholder, what's next, the AI-usage line), then a correction pass after reading `e2e/home.spec.ts`, `playwright.config.ts`, `app/routes/home.tsx` and `app/shared/request-context.server.ts` directly instead of trusting the spec.
- What I kept: the overall structure and the corrected version. The first draft had invented a rep-code step and a Recommended button from the spec's design, neither of which is built; I caught it and had it checked against the actual code.
- What I changed or threw away, and why: had it drop the rep-code and Recommended steps (not built yet), move `/insights` into the cut list (also not built), fix the e2e description to the real 5 tests instead of an imagined "refresh" test, fix the scenario range to S1-S9, and narrow the Server-Timing claim to what `home.tsx` actually sets (`db`, `match`, `total`). I wrote the self-assessment section myself rather than have the AI guess at it, and I'm measuring the 5-minute setup claim myself on a clean clone rather than taking the AI's word for it.
- Key decision I made: none; no new product or design decision this session, only a documentation correction.
- Evidence: README.md; transcript: 08-docs (to be exported).
