# Program Finder

A tool for small-business loan sales reps to use while a borrower is on the phone. The rep enters the loan amount, business type, time in business and credit tier, and sees in seconds which partner lender SBA programs fit, why, and which ones are just out of reach.

Built for eight sales reps and two sales managers. Speed and a correct answer matter more than anything else.

## How to run it

You need Node 24 and Docker.

```bash
npm install
npm run setup
npm run dev
```

`npm run setup` starts Postgres in Docker (port 5433), runs the migrations, and imports the sample catalog (`data/programs.csv`, 49 programs). `npm run dev` starts the app at http://localhost:5173.

What you should see: a page with a loan amount field, a business type dropdown, a credit tier choice, and a years-in-business field. Type an amount and pick a business type and results appear below, grouped into Fits, Close, Ask first, and a collapsed Doesn't fit.

To check everything is wired up:

```bash
npm run typecheck   # should exit clean
npm test            # unit and integration tests, needs the database from npm run setup
npm run test:e2e    # Playwright, starts its own dev server if one isn't already running
```

`GET /healthz` returns `{ status, db }` if you want to confirm the app can reach the database.

## How to use it on a call

1. Type the loan amount (plain numbers, `$250,000`, or shorthand like `250k` all work) and pick the business type. Results appear as soon as both are filled in.
2. Add the credit tier and years in business as the borrower tells you. Results update as you type, no need to press anything.
3. Read the groups top to bottom: **Fits** first, then **Close**, one thing away, and the row names what and by how much.
4. If a program is **Ask first**, the row tells you exactly what to ask the borrower next, for example "Ask: credit tier". Fill that in and the program moves into Fits, Close or Doesn't fit.
5. **Doesn't fit** is collapsed, with its count, in case you want to check it or explain to the borrower why a program is out.

## What is in V1, what I cut and why

V1 is the core: enter the borrower's details, see which programs fit, why, and the rate and term you'd quote. Alongside it: a stale-data warning so a rep never reads an old rate as current, and a `/data-health` page showing what's currently imported and any import problems.

Three things from the original ask are cut or pushed out, in the order the spec marked them to cut first if time ran short:

- **Recommend and `/insights`.** Not started. I was behind schedule at the last checkpoint and this was next in line to cut. The design is already written in the spec (`docs/SPEC.md`, FR-15 to FR-17): a rep code kept in a cookie, a Recommended button that re-checks the program still fits before saving, and an `/insights` page with counts per program and per rep.
- **Side-by-side compare.** Cut. The result rows already show every program in the same columns in every group, which gives most of what a compare view would add for free. A dedicated pick-and-compare screen (checkboxes, a `?compare=` URL, its own panel) is real UI work I didn't get to.
- **The "rate changed" badge.** Cut. It would compare the current catalog against the previous one and flag a lender that moved its rate. With only one CSV import so far, there is nothing to compare against, so a rep would never see it yet. The "rates as of" date and the 31-day stale warning already cover the underlying ask, don't quote an old rate as current.

All three are explained in more detail in `docs/KNOWN_ISSUES.md` and `docs/SPEC.md`.

## How it works

```
Rep types in the browser
        |
        v
  /  loader  (validates input with Zod)
        |
        v
  live programs from Postgres  --->  matchPrograms() [pure, no I/O]
        |                                   |
        |                                   v
        |                         checks every program against
        |                         every rule, sorts into
        |                         Fits / Close / Ask first / Doesn't fit
        v                                   |
  rendered result rows  <--------------------
```

The match engine (`app/matching/`) is pure TypeScript: no database, no framework code, so it's fast and its rules are easy to test on their own. Everything else, reading the loan amount from the URL, loading the live catalog, rendering the rows, lives around it. The catalog import (`app/programs/`) is the same idea: a CSV row goes through a pure parser before anything touches the database, so a bad row is caught and explained, not silently stored.

## Testing

Automated:

- **Unit tests** (`npm run test:unit`) cover the match engine rule by rule (amount, industry, years, tier, score) and the money and date parsing, including every edge named in the spec: exactly the min, exactly the max, one past each, missing input. They include scenarios S1 to S9 from `docs/UNDERSTANDING.md` and `docs/SPEC.md`, read straight from `data/programs.csv`, so a change to the real catalog fails these tests on purpose. A few are `fast-check` properties: the same input always gives the same programs in the same order, however the list is shuffled going in.
- **Integration tests** (`npm run test:integration`) run against a real Postgres (`finder_test`), not a mock: the CSV import (a bad row rejects the whole file, the previous data stays live), and the loader behaviour around that.
- **End-to-end** (`npm run test:e2e`) drives a real browser with Playwright, five tests in `e2e/home.spec.ts`: typing a full borrower scenario and seeing Fits then, on a second scenario, Close with the right reasons, the same main path done keyboard-only, a score typo showing a field error and no results, and an automated accessibility scan (axe) on `/` and on `/data-health`, each failing on anything serious or critical.

Run everything with `npm test` (needs `npm run db:up` first). `npm run test:e2e` starts its own dev server if one isn't already running, so no setup is needed beyond `npm run setup`.

Manual QA before reps use it, beyond what's automated:

- Walk through scenarios S1 to S9 in `docs/UNDERSTANDING.md` and `docs/SPEC.md` by hand in the browser and compare the counts.
- Try a deliberately wrong input in each field (a letter in the amount, a score of 6800, 200 years) and confirm you get a field error and no results, never a wrong answer.
- Import `data/programs.csv` a second time and confirm it says "already live" and changes nothing.
- Resize the window to 1024px and confirm the result tables scroll inside their own box rather than the whole page scrolling sideways.

Pilot plan: before rolling out to all eight reps, have one or two reps run real or recent calls through the tool side by side with their usual method for a day, and compare what the tool shows against what they'd have found the old way. Watch for: any case where the tool shows "Fits" and the rep or lender would disagree, and any point where the rep hesitates or has to guess what a label means. Fix those before wider rollout.

## Observability

Every response carries an `X-Request-Id` header and a `Server-Timing` header. On the finder route (`/`), it reports `db` (time to load the live catalog), `match` (time spent in the match engine, once there's a borrower input to match) and `total`. `GET /healthz` reports database connectivity for a simple uptime check. The app logs structured events (an import accepted or rejected, an error) with the request id attached, through a single pino logger, never full sentences, never personal data, and never a search a rep typed. Unexpected errors show the rep a plain message with the request id, never a stack trace, and the same id is in the server log so a bug report can be traced straight back to the failing request.

## Known issues

See `docs/KNOWN_ISSUES.md` for the full list with reasons. The ones most worth knowing about before relying on this:

- The credit score typed into the search currently reaches production logs via `npm start`'s request logging (not hit by `npm run dev`, which is what the pilot would use).
- A `last_updated` date in the future would never be flagged stale. A unit mix-up in the source CSV (a rate written as a ratio, or a ratio written as a percent) would import without complaint.

## Self-assessment

*(placeholder, I'll write this myself)*

## What's next and why

In order, if I kept going:

1. **Recommend and `/insights` (task 6).** This is what the sales managers asked for and it's fully speced; it's the highest-value thing left undone.
2. **The deferred review findings** in `docs/KNOWN_ISSUES.md`, particularly the production log leak and the unflagged future date, since both are silent and could let a rep act on bad information.
3. **The rate-changed badge**, once there's a second real CSV import to compare against and it would actually show a rep something.
4. **Pick-and-compare**, if reps ask for it after using the aligned-row view for a while. It might turn out the aligned rows are enough.

## How I used AI

Before the clock, I used Claude to research the company and SBA lending, get up to speed on React Router v8, and plan my approach and my Claude Code setup.

The full log, with every prompt, what I kept, and what I changed and why, is in [`docs/AI_LOG.md`](docs/AI_LOG.md).
