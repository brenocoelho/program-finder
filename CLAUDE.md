# Program Finder

## What this is
A browser tool for small-business loan sales reps to use while a borrower is on the phone. The rep enters the loan amount, business type, time in business and credit tier, and sees in seconds which partner lender SBA programs fit, why, and which ones are just out of reach.
Users: eight sales reps (not technical, no training manual) and two sales managers. Speed and a correct answer matter more than anything else.

## Your role
I'm the engineer here and you're my assistant. I make the product and design calls. Do the routine work without asking (wiring, boilerplate, the tests I asked for), and stop to help me at the key points:
- a business rule that isn't clear in the source data or the spec
- anything that adds or cuts scope, changes the schema, or adds a dependency
- anything that could show a user a wrong number or a wrong answer
- a failing test where the test itself might be wrong. Never change a test just to make it pass
- the same error twice in a row. Stop and tell me what you think is going on instead of trying random fixes
At those points, and for any product or design decision, ask me as a multiple-choice question: 2 to 4 options, the tradeoff of each, your recommendation first. Then wait. After I answer, add an entry to docs/DECISIONS.md with the question, the options, what I chose and my reason in my words (ask me for the reason if I didn't give one). If you think I'm wrong about something, say so.
When you use a React Router v8 API I might not know, add one line on what it does and why you picked it.

## Rules
- Business rules come only from the source data, the spec and my answers in docs/DECISIONS.md. Don't invent rules or use outside knowledge as if it were a rule. If something looks missing, ask me. Missing or unknown input never counts as success.
- When there's money: integer cents, percentages in integer basis points, never floats.
- No personal data (PII) in the database or the logs.
- Core business logic is pure: no I/O, no framework code, so it's fast and easy to test.
- Never run git add, git commit or git push. I review every change and do all the git work myself. git status, git diff and git log are fine.

## Stack and commands
React Router v8 (framework mode), TypeScript strict, Vite, Tailwind, Zod, postgres.js, Postgres 16 in Docker Compose, Vitest + fast-check, Playwright.
- npm run dev: http://localhost:5173. I run it in my own terminal, don't start another one
- npm run typecheck
When you add a script (tests, database, import), list it here with one line on what it does.
Before using a React Router API, check the react-router skill and the v8 docs it points to in node_modules/react-router/docs. No react-router-dom, no v6-era APIs.

## Where things go
The folder layout is decided during the spec and recorded in docs/DECISIONS.md. Once it's decided, replace this paragraph with the real folders and keep it up to date. Until then, follow the code rules below.

## Code rules
- Organize code by business area, not by technical layer. Route files stay thin: validate input, call the business code, render. No business rules or SQL in routes or components.
- Imports go one way: routes → business code → shared helpers. Business code never imports routes or components.
- Anything that touches the database, env vars or logs ends in .server.ts. React Router keeps those out of the browser bundle and fails the build if browser code imports one. Route files are never .server.
- Each business area owns its SQL. No shared queries file.
- Tests live next to the code: name.test.ts for unit tests, name.integration.test.ts when it needs Postgres. Playwright tests go in e2e/. Fixtures go in a __fixtures__/ folder next to the tests that use them.
- File names are kebab-case, components too (result-card.tsx exports ResultCard).
- Import with the ~/ alias (~/<area>/<file>) instead of long relative paths.

## Validation (Zod)
- Validate with Zod at every boundary: search params and form data in loaders and actions, each row of imported data, env vars. Inside the app, trust the types.
- Infer types from schemas (z.infer) instead of writing them twice. Schemas live in the module that owns the data.
- Invalid input never throws to the user: return a clear error for forms, and a data issue with the row number for imported files.

## Testing
- Vitest for unit and integration tests. Name each test after the business rule it protects, not the function ("an amount exactly at the maximum is accepted").
- Cover the edges for every rule: exactly the min, exactly the max, one cent outside, missing input.
- fast-check for properties that must always hold (for example, the same input always gives the same output in the same order).
- Integration tests run against a real test database. Don't mock Postgres.
- Playwright for the main user path only: role and label selectors, no fixed waits. Run an axe scan on each page; no serious or critical violations.
- A failing test is information. Fix the code, or ask me if the test might be wrong.

## Database
- Plain SQL migrations, numbered, safe to run twice. Never edit a migration that already ran; add a new one.
- Queries only through postgres.js tagged templates, so values are always parameters. Never build SQL from strings.
- Writes that touch more than one table go in one transaction. Any write that can be retried is idempotent (an idempotency key with ON CONFLICT DO NOTHING).

## Logging and errors
- Log with the pino logger from the router context, so every line carries the request id. Structured fields, not sentences.
- Log decisions and failures (an import, a user action that changes data, an error), not every step. Never log personal data.
- Don't swallow errors. Routes have an ErrorBoundary that shows a plain message and the request id.

## UI
- Written for the people who use it (see "What this is"): plain words, no jargon, the most important thing first.
- Screen state that matters (filters, selections) lives in the URL, so refresh and the back button work.
- Don't block the screen while loading: no full-page spinners, keep what's visible until new data arrives. Tailwind only, no component library.
- Accessible by default: native controls, visible labels, a sensible tab order, keyboard-only use works.

## Engineering principles
- Simple and boring first. No abstraction until a second real use needs it, no new dependency without asking me.
- Deterministic: the same inputs and the same data version give the same results in the same order.
- History is append-only. Never update or delete records that explain past results (imports, user actions); add a new version.
- Any change to business rules bumps a rules version constant and updates the spec, the tests and docs/DECISIONS.md in the same change.
- Measure before optimizing. The spec sets a latency budget for the main screen; Server-Timing shows whether we meet it.
- When you cut a corner on purpose, add one line to docs/KNOWN_ISSUES.md saying what and why (create it the first time and list it under Project docs). No silent shortcuts.
- Secrets and config only through one env module, validated with Zod. Nothing secret in the repo.

## How we work
- Types and tests before implementation for business logic and data import.
- One build-order task from the spec at a time. If a change is going to be more than ~50 lines, tell me the plan first.
- Don't say it's done until typecheck and tests are green.
- I review all the code before I commit, so keep changes small and focused. When you finish a task, tell me which files changed and what deserves a careful look: anything risky, surprising, or that you're not sure about.
- Already installed: postgres, zod, csv-parse, pino, pino-pretty, vitest, fast-check, tsx, @playwright/test, @axe-core/playwright.

## Project docs
- data/programs.csv: the source data. Treat it as correct; business rules come from its columns.
- docs/DECISIONS.md: product and design decisions, with my reasons.
- docs/UNDERSTANDING.md: the problem from the rep's side, what each CSV column means and how we use it, open questions, and 5 borrower test scenarios.
- docs/private/: inputs that are never committed. Read them, but never copy them into committed files.
When you create a new project doc (the understanding notes, the spec, known issues), add it to this list with one line on what it's for.
