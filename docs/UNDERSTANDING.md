# Understanding the problem

Notes from reading the team's context and `data/programs.csv`, before any spec or code. Row references are CSV line numbers (the header is line 1). Anything marked **(verify)** comes from general SBA knowledge, not from our files, and is not a rule.

## The problem, from the rep's side

A small-business owner is on the phone asking "what can I get?". Today the rep pieces the answer together from PDFs, a wiki and a rate spreadsheet while the borrower waits. That's slow, mistakes slip in, and new reps need weeks to learn which lender does what. Deals are lost in that delay.

On a call the rep usually knows four things: the loan amount, the type of business, years in business, and a rough credit tier (excellent, good, fair). Sometimes they know revenue. They need the matching programs on screen in seconds, with enough detail (rate, term, what the lender will ask for) to keep the conversation moving.

**Users:** eight sales reps (daily, live on calls, not technical, no training) and two sales managers (also want to see which programs reps recommend most). Borrowers never use the tool. The data covers 49 programs from 15 lenders. The full partner network is about 25–30 programs, so the tool must not assume the list is complete.

## The columns

Money in whole dollars → stored as integer cents. Percentages → integer basis points.

| Column | Meaning | Unit | Use |
|---|---|---|---|
| lender_name | Partner lender (a company, not PII) | text, 15 values | Display |
| program_type | 504 Loan, 7(a) Small Loan, 7(a) Standard, Community Advantage, SBA Express | category | Display (maybe a filter) |
| min_loan_amount / max_loan_amount | Allowed loan amount range | dollars | **Rule** |
| min_credit_score | Lowest credit score the lender takes | score points, 600–700 | **Rule only if the rep has a score** (D1) |
| credit_tier_required | Lowest tier: only Fair or Good appear, never Excellent | category | **Rule** |
| min_years_in_business | Minimum time operating | whole years, 1–3 | **Rule** |
| interest_rate_min / _max | Rate range the borrower might get. Fixed or variable isn't stated **(verify)** | % per year, 1 decimal | Display |
| max_term_months | Longest repayment term | months, 84–300 | Display |
| sba_guarantee_pct | Share of the loan the SBA guarantees to the *lender* | %, 40/50/75/85 | Display in details only; it doesn't change what the borrower gets |
| eligible_business_types | One industry, or All. 7 values | category | **Rule** |
| requires_collateral | Yes / No / Varies | category | Display |
| max_existing_debt_ratio | Highest existing-debt ratio allowed. The ratio isn't defined (debt to income? to revenue?) **(verify)**. 9 rows blank | ratio, 0.40–0.55 | Display as "lender will check" (D6) |
| turnaround_days | Typical time to a decision. Calendar or business days isn't stated | days, 5–82 | Display |
| special_requirements | Free-text conditions, 11 distinct values, 15 rows blank | text | Display as "lender will check" (D6) |
| last_updated | When this row's terms were last confirmed | M/D/YYYY | Display as "rates as of" and the stale warning (D8) |

No column holds revenue, loan purpose or owner details. Data quirks we treat as correct but should know about: a 640 score is "Fair" on line 35 and "Good" on line 8; "must be in business at least 6 months" (6 rows) is always weaker than the same row's minimum of 1+ years; "requires business plan for startups" sits on programs that need 1–2 years; four 7(a) Standard rows show 85% guarantee where SBA rules give 75% above $150k **(verify)**.

## What users will expect without saying it

- **Unknown revenue doesn't block them.** No column uses revenue, so it can't change results. We don't ask for it as a required field, and we don't pretend we checked it.
- **Unknown is never "yes".** If the rep doesn't know the credit tier or years, a program that needs them is "possible, needs X", never a match.
- **No matches is an answer, not a blank screen.** Say plainly that nothing fits and why, then show the closest options.
- **Near misses are where deals are saved.** "$10,000 over this lender's max" or "qualifies at 1 year" gives the rep something to say. Each near miss names the one thing in the way, in plain words.
- **Every match says why.** The rep repeats it to the borrower, so it has to be true and short.
- **Same input, same list, same order.** A rep who re-runs a search mid-call must not see the list reshuffle.
- **Rates are ranges, not quotes.** The screen must not read like a promise, and it shows how old the rates are.
- **Speed with the keyboard.** Results update as they type, no page reloads, works without a mouse.

## Open questions (all decided, see docs/DECISIONS.md)

1. **Credit: tier or score?** Match on tier (Excellent > Good > Fair). If the rep types a score, also check min_credit_score. Every card shows "needs 680+" so the rep knows what to ask. (D1)
2. **Time in business.** Whole years, in a field labelled "Full years in business" with the hint "under 1 year = 0". (D2)
3. **Amount limits.** Inclusive at both ends: $250,000 fits a $250,000 max. (D3)
4. **Near miss.** A program that fails exactly one rule (amount, years or credit tier), at any distance. Industry mismatches are never near misses. (D4)
5. **Business type outside the 6 listed.** An "Other" choice that matches only "All" programs, with a note that the lender confirms eligibility. SBA bars some industries entirely **(verify)**; we don't encode that. (D5)
6. **Debt ratio, collateral, special requirements.** Shown on each match as "lender will check"; never used to filter in v1. (D6)
7. **Order of matches.** Lowest starting rate, then fastest turnaround, then lender name and program. (D7)
8. **Stale data.** Each match shows "rates as of <date>" and a visible warning when the row is more than 31 days old. Today that is every row. (D8)

## Borrower scenarios (test cases)

Expected results use the decisions above (tier only, no score entered).

1. **Many matches.** Construction, $250,000, Good, 3 years. **27 matches.** Six sit exactly at their $250,000 max (lines 2, 24, 35, 40, 44, 48) and two exactly at their $250,000 min (lines 13, 20), so this also covers both inclusive edges. Lowest starting rate is Midwest Business Finance 504 at 5.5% (line 22). Checks: ordering, a long list that's still easy to read, and that "real estate purchase only" (line 40) shows as a condition.
2. **Unknown revenue.** Healthcare, $150,000, Good, 2 years, revenue unknown. **17 matches, the same with or without revenue.** 8 of them need a 680+ score (lines 3, 22, 27, 32, 34, 39, 40, 46), so the "needs 680+" note matters here. Near misses: lines 30, 37, 42 need 3 years; lines 20, 50 start at $250,000.
3. **A little over a limit.** Restaurant/Food Service, $260,000, Fair, 2 years. **1 match:** Coastal Capital Community Advantage (line 18). **Near misses:** First National Bank (line 2) and Evergreen Business Capital (line 29) Community Advantage, each $10,000 over a $250,000 max. At $250,000 they would match.
4. **A very new business.** Retail, $50,000, Good, open 8 months, so entered as 0 full years. **0 matches;** every program needs at least 1 year. Six programs fail only on time and open up at 1 year: lines 2, 10, 23, 40, 43, 48. Expected: a clear "nothing yet" and "these open up at 1 year", not an empty screen.
5. **An excluded industry.** Healthcare, $300,000, Fair, 2 years. **0 matches.** Three Community Advantage programs fit on everything except industry: line 14 (Manufacturing), 18 (Restaurant/Food Service), 45 (Construction). They must not show up as near misses. The one real near miss is First National Bank (line 2, All industries), $50,000 over its max.
