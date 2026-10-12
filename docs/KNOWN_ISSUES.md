# Known issues

Corners cut on purpose. One line each: what, and why.

- **Migrations have no checksum.** `schema_migrations` stores only the filename and the time, so an edited old migration is not detected by the runner (the spec's schema, kept simple). The rule "never edit a migration that already ran" is by hand and in review.
- **No match-engine benchmark (NFR-2).** Left out of task 2 on purpose: `Server-Timing` (`match`) on `/` shows the real numbers, and the spec's assertion was only a ceiling.
- **No compare view on `/` (FR-18).** `[CUT-FIRST]` per D9: aligned rows already give most of what compare would add, and pick-and-compare needs its own `?compare=` URL state and panel UI. Left for a later task.
- **No "rates updated" flag on rows (FR-10, D19).** `[CUT-FIRST]`: with only one CSV import so far there is nothing to compare against, so the rep would never see it. The "Rates as of" date and the 31-day stale warning (D8) already cover the ask.
- **The credit score is logged in production (review #3, D28).** `npm start` runs `react-router-serve`, which logs every full URL with `morgan("tiny")`, so `?score=650` reaches stdout (against NFR-6). Not hit by the demo, which runs `npm run dev`. Fix: a small server entry that logs the path only (an infra change to decide on).
- **CSV unit mix-ups import silently (review #7, D28).** A rate written as a fraction ("0.11") imports as 0.11% and sorts first in every group; a debt ratio written as a percent ("45") shows as 4500%. D23 rejects only values the schema can't hold, and the current CSV is valid. Fix: reject rates under 1%, or flag them on `/data-health`.
- **A future `last_updated` is never stale (review #8, D28).** A typo like 1/16/2062 imports, and that row's rate shows as current forever. Fix: reject a `last_updated` after the import date (it "can't be real", in line with D23).
- **Business type is free text (review #16, D28).** "all" or "ALL" imports as its own industry: an All program then matches nobody, and "all" appears in the business type list. Fix: match "All" whatever the case, or warn on import.
- **No message when nothing fits at all (review #10).** If every program is Doesn't fit, the page shows only the collapsed "Doesn't fit (N)". Fix: a line like "Nothing fits these details" with the main reasons.
- **`/data-health` has no stale count (review #11, FR-14).** The finder banner now shows "Rates may be out of date for N of M programs", but `/data-health` doesn't. Fix: add `staleCount` from `freshnessOf`.
- **`/data-health` errors have no request id (review #12, FR-19).** Its loader doesn't use `failRequest`, so a database error shows "An unexpected error occurred." without the reference. Fix: wrap it as `home.tsx` does.
- **"Today" is the UTC date (review #13).** `todayIso()` uses UTC, so in the US evening rows turn stale a few hours early (the safe direction). Fix: pick the team's time zone.
- **Amount shorthand lets cents through (review #14).** "250.0005k" is read as $250,000.50 while "250000.50" is rejected (FR-2: whole dollars); the CSV loan columns use the same parser. Fix: after the shorthand, require whole dollars.
- **Enter does not submit the search form (review #15, D11).** The form has three text fields and no submit button, so the browser never submits it; results still update after 250 ms. Fix: an `onSubmit` that cancels the debounce and submits at once.
- **The D27 "don't ask for the tier" check is repeated in the row component.** `askFields` in `result-row.tsx` leaves out an empty tier next to a failed score, the same condition the engine uses in `statusOf`. Kept there to avoid changing the `RuleResult` shape late; if D27 changes, change both. Fix: have the engine return the fields to ask about.
- **Task 6 will need a schema change for D27.** A Close row can now have no credit tier, but `recommendation_events.credit_tier` is `NOT NULL`, so recommending such a row would fail. Fix: a new migration making the column nullable when task 6 is built.
