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
