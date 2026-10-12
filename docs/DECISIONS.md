# Decisions

Product and design calls made during the build, oldest first. Each entry: the question, the options, what I chose and why.

## D1. Credit: tier or score? (2026-10-12)
Rows have a required tier and a minimum score, and the tiers overlap on scores (640 is Fair on line 35, Good on line 8).
Options:
- **Tier, plus score if typed:** match on tier (Excellent > Good > Fair); if the rep types a score, also check min_credit_score; each card shows the minimum score.
- Tier only: show the score on the card, never match on it.
- Score required: the rep must enter a score, or we map tiers to score ranges (a mapping not in our data).
- Tier, with high-score programs moved to a "possible, confirm score" group.

Chosen: tier, plus score if typed.
Why: "Every program has a tier, but on a call the rep often doesn't know the score. When the rep has the score, it should count. 'needs 680+' tells the rep what to ask."

## D2. How is time in business entered? (2026-10-12)
Every minimum in the CSV is whole years (1–3).
Options:
- Years + months: compare total months to min_years × 12.
- Months only.
- **Whole years only.**

Chosen: whole years only. Follow-up: whole years can be rounded up (8 months typed as "1"), which would show programs the borrower can't get yet. Options: keep it plain; **label the field "Full years in business" with the hint "under 1 year = 0"**; switch to years + months. Chosen: the label and hint.
Why: "Borrowers answer 'how many years' in whole years, and the CSV minimum is in whole years too. The hint is so nobody types 0.5."

## D3. Are the loan amount limits inclusive? (2026-10-12)
Options:
- **Inclusive at both ends.**
- Inclusive min, exclusive max.

Chosen: inclusive at both ends.
Why: "If the CSV says max $500,000, a borrower asking exactly $500,000 should match. That is how a rep reads it."

## D4. What counts as a near miss? (2026-10-12)
Options:
- **Fails exactly one rule (amount, years or credit tier), at any distance; industry never counts.**
- The same, but only within a closeness threshold (e.g. 10% on amount).
- Fails exactly one rule, industry included.
- No near misses in v1.

Chosen: one failed rule among amount, years and credit tier, any distance, never industry.
Why: "One rule, any distance, is simple to explain on a call. The rep can lower the amount, the borrower can wait, the credit can get better. Industry never changes, so it is never 'close'."
Update (D13): "credit" means the tier and, when the rep types one, the score, as one rule. A program whose only problem is credit (tier, score, or both) is Close.

## D5. Business types not in the list (2026-10-12)
The CSV has 6 industries plus "All".
Options:
- **An "Other" choice that matches only "All" programs, with a note that the lender confirms eligibility.**
- Only the 6 listed types.
- Free text; anything not one of the 6 matches "All".

Chosen: "Other" matches only "All" programs.
Why: "I don't want to lose a borrower because their type is not in the list. 'All' programs accept any type, and the lender confirms."

## D6. Debt ratio, collateral and special requirements (2026-10-12)
Options:
- **Show them on each match as "lender will check"; never filter on them in v1.**
- Optional filters when the rep knows them (unknown never filters).
- Hide them.

Chosen: show as "lender will check".
Why: "We don't collect these on the call and we can't verify them. If we filter, we hide good options. Showing them tells the rep what the borrower needs to prepare."

## D7. Order of matches (2026-10-12)
Options:
- **Lowest starting rate, then fastest turnaround, then lender name and program.**
- Fastest turnaround first.
- Grouped by program type, rate order inside each group.

Chosen: lowest starting rate, then turnaround, then lender and program name.
Why: "The borrower cares first about cost, then about speed. Lender and program name are only a tie-breaker, so the order is always the same and easy to test."

## D8. When is a row's data stale? (2026-10-12)
Rates change monthly; every row was last updated Jan 1 – Feb 8, 2026.
Options:
- **Show "rates as of <date>" and a visible warning when the row is more than 31 days old.**
- The same, warning after 90 days.
- Show the date only, no warning.

Chosen: first "date only, no warning", then changed to warn after 31 days.
Why: "I changed because of your point. A rep can read an old rate to the borrower as if it is current, and on a call nobody looks at a small date. 31 days is about one rate sheet cycle. Today all rows are old, and the rep should know that."

## D9. What goes in V1? (2026-10-12)
The team asked for 7 things. Build budget is about 150 minutes.
Options (first round):
- Core (filter, rate & term, eligibility at a glance) + rate-update flag + manager insights; compare and share later.
- Core + rate flag + insights + compare, with compare marked [CUT-FIRST].
- Core + rate flag + compare; insights later.
- Core + rate flag only.

First answer: share goes to V2, and asked for a suggestion on the rest. Second round:
- **Aligned rows + compare last:** V1 is core + rate flag + insights, with result rows that keep the same fields in the same columns (most of side-by-side for free); a pick-and-compare view is the last build task, [CUT-FIRST].
- Aligned rows, compare in V2.
- Full compare in V1, insights cut.
- Cards, no compare.

Chosen: aligned rows + compare last. Share is V2.
Why: "The core is what reps use on every call. The rate flag stops them from quoting old rates, and insights is what managers asked for. Aligned rows give most of compare for free, so the full compare view is the first thing I cut if I'm late. Share goes to V2 because anything we send to a borrower needs approved wording, and it happens after the call."

## D10. Status labels (2026-10-12)
Options:
- **Fits / Close / Ask first** (and a collapsed "Doesn't fit" with its count).
- Eligible / Near miss / Unknown.
- Good match / Almost / Missing info.

Chosen: Fits / Close / Ask first.
Why: "Short words a rep can read in one second while talking. 'Ask first' tells the rep what to do next. 'Eligible' sounds like a promise, and only the lender can promise."

## D11. How the rep enters the borrower details (2026-10-12)
In all options the inputs live in the URL and Enter submits.
Options:
- **Live as they type:** results update about 250 ms after the last keystroke; amount as text, business type as a dropdown, tier as 3 radio buttons, years and score as numbers.
- Submit button only.
- Live, with business type and tier as button groups.

Chosen: live as they type.
Why: "The rep is talking with the borrower, so no extra click. The dropdown and radio buttons are fast with the keyboard and avoid typos."

## D12. Empty fields (2026-10-12)
Options:
- **Amount and business type are needed before any results; tier and years can be empty.** A program that passes everything known but needs an empty field is "Ask first"; "Close" needs every field known.
- All four fields required.
- Everything optional.

Chosen: need amount + business type.
Why: "Without amount and business type the list means nothing. Tier and years often come later in the call, so the rep can start without them. Close needs all fields known, so we never say 'close' based on a guess."

## D13. Does a typed credit score count as its own rule? (2026-10-12)
D4 allows one failed rule among amount, years and credit tier for "Close".
Options:
- **Tier and score together are one credit rule:** it fails if the tier is too low, the score is under the minimum, or both.
- Two separate rules: a borrower below both the tier and the score has two fails, so "Doesn't fit".
- A score below the minimum is never "Close".

Chosen: first "two separate rules", then changed to one credit rule.
Why: "Tier and score are both 'credit'. If credit is the only problem, the program is still close, and the rep can still try to save the deal. Typing more information must not hide options from the rep."
Example: Healthcare, $150,000, Fair, 2 years, score 650 gives 1 Fits / 16 Close, the same as with no score (with two separate rules it was 1 Fits / 5 Close).

Follow-up: a typed score can still move a row out of Close when the row already misses on amount or years (Healthcare, $150,000, Good, 2 years: 5 Close rows with no score, none with a 650 score). Options:
- **Accept it: that's two things off, so "Doesn't fit" with both reasons.** Close stays "exactly one thing off".
- A score never removes a row from Close; it adds "also needs 680+".
- A new "Two things off" group under Close.

Chosen: accept it.
Why: _waiting for your reason_

## D14. Folder layout (2026-10-12)
Options:
- Business areas, each with its own ui/ subfolder.
- **Business areas + one app/components/ folder.**
- Each route inside its business area.

Chosen: business areas + app/components/. Details in CLAUDE.md "Where things go".
Why: "Business rules stay together by area, and shared UI pieces are in one place that is easy to find. Simple for a small app."

## D15. Rep identity (2026-10-12)
Options:
- **Pick a rep code once (R01–R08, M01, M02), kept in a signed cookie; no names in the app, no password.**
- Pick your name (names in the DB).
- No rep identity; insights per program only.
- Real login.

Chosen: pick a rep code once.
Why: "Managers need recommendations per rep, but a login is too much for V1. Codes keep names out of the database."

## D16. What counts as a recommendation (2026-10-12)
Options:
- **An explicit "Recommended" button on Fits and Close rows; one click = one event, idempotency key, no undo in V1.**
- The same, plus undo saved as a "withdrawn" event.
- Log every search and the programs shown.

Chosen: explicit button, no undo.
Why: "A click is a real decision by the rep, so the manager numbers mean something. Logging every search is only noise. Undo can come later if reps ask for it."

## D17. How a new CSV gets in (2026-10-12)
Options:
- **A CLI script (`npm run db:import -- <file>`); /data-health is read-only.**
- Upload on /data-health.
- Import at app start when the file changes.

Chosen: CLI script.
Why: "Imports are rare and done by one person, so a script is simple and safe. An upload page needs login and more UI."

## D18. A file with invalid rows (2026-10-12)
Options:
- **Reject the whole file:** save every issue with its row number, record the import as rejected, keep the previous data live.
- Skip bad rows, import the rest.
- Skip bad rows, keep their previous version.

Chosen: reject the whole file.
Why: "A half-imported file can show a wrong rate as if it's current. It's better to keep the old data live and show exactly what is wrong."

## D19. When a row gets the "rates updated" flag (2026-10-12)
A program is identified across imports by lender + program type (unique in all 49 rows; a duplicate rejects the file). The flag compares the live import with the one before it.
Options:
- **Rate range changed:** "Rate changed: was X–Y" when interest_rate_min or _max differs; "New program" when the key is new.
- Any term changed.
- The lender's last_updated date moved.

Chosen: rate range changed.
Why: "The rate is what the rep quotes, so that is the change that matters. A new date alone doesn't mean anything changed."
Later: the flag is [CUT-FIRST] in the build order, because "with only one CSV there is nothing to compare, so the rep never sees it. The 'rates as of' date and the 31-day warning (D8) already cover the 'flag rate updates' ask."

## D20. Input limits for typos (2026-10-12)
Options:
- **Wide sanity limits:** amount $1 to $50,000,000 (10× the largest CSV max), years 0 to 99, score 300 to 850. Input checks only, not eligibility rules.
- Limits from the data.
- Basic checks only: positive whole numbers (years may be 0).

Chosen: first "basic checks only", then changed to the wide limits after the point that a 6800 score typo would pass every score rule.
Why: "A typo must never show 'Fits'. Wide limits catch it and cost almost nothing."

## D21. Where the rep codes are seeded (2026-10-12)
Options:
- Migration 0002_seed_reps.sql (the optional rate-change migration would move to 0003).
- A separate db/seeds/reps.sql with its own runner step.
- **Inside 0001_init.sql** (R01–R08 and M01–M02, `ON CONFLICT DO NOTHING`).

Chosen: inside 0001_init.sql.
Why: "The reps are fixed reference data that the app needs from the first run, so they belong with the schema. One file is simpler, and ON CONFLICT DO NOTHING makes it safe to run again. If the list changes later, it goes in a new migration."

## D22. Which databases `setup` and `db:reset` migrate (2026-10-12)
Options:
- **The dev database `finder` only;** `finder_test` is created empty by the init script.
- Both `finder` and `finder_test`.

Chosen: dev database only.
Update: npm test now runs the integration tests, and their setup migrates finder_test before each run (see the tests change after this decision).
Why: "The test database belongs to the tests. The integration setup migrates finder_test before the tests run, so setup only needs to prepare the database I use in the app. This keeps the two separate, and a test can never depend on the dev data."
