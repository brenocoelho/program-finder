# Known issues

Corners cut on purpose. One line each: what, and why.

- **Migrations have no checksum.** `schema_migrations` stores only the filename and the time, so an edited old migration is not detected by the runner (the spec's schema, kept simple). The rule "never edit a migration that already ran" is by hand and in review.
- **No match-engine benchmark (NFR-2).** Left out of task 2 on purpose: `Server-Timing` (`match`) on `/` shows the real numbers, and the spec's assertion was only a ceiling.
- **No compare view on `/` (FR-18).** `[CUT-FIRST]` per D9: aligned rows already give most of what compare would add, and pick-and-compare needs its own `?compare=` URL state and panel UI. Left for a later task.
- **No "rates updated" flag on rows (FR-10, D19).** `[CUT-FIRST]`: with only one CSV import so far there is nothing to compare against, so the rep would never see it. The "Rates as of" date and the 31-day stale warning (D8) already cover the ask.
