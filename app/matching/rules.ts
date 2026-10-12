import type { BorrowerInput } from "~/matching/borrower-input";
import { STALE_AFTER_DAYS, TIER_RANK } from "~/matching/rules-version";
import type { CreditTier, Program } from "~/programs/program";
import { daysBetween, type IsoDate } from "~/shared/date";
import { formatCents, type Cents } from "~/shared/money";

// One function per rule in docs/SPEC.md section 4. Pure: the same borrower and
// program always give the same result. Only CSV columns are used.

export type RuleName = "amount" | "industry" | "years" | "tier" | "score";

export type RuleResult =
  | { rule: RuleName; outcome: "pass" }
  | { rule: RuleName; outcome: "unknown" }
  | { rule: "amount"; outcome: "fail"; direction: "over" | "under"; gapCents: Cents; limitCents: Cents }
  | { rule: "industry"; outcome: "fail"; required: string }
  | { rule: "years"; outcome: "fail"; needed: number; has: number }
  | { rule: "tier"; outcome: "fail"; needed: CreditTier; has: CreditTier }
  | { rule: "score"; outcome: "fail"; needed: number; has: number };

/** The same result in plain words for the screen: what the program asks, what the borrower has. */
export type RuleCheck = {
  rule: RuleName;
  outcome: RuleResult["outcome"];
  requirement: string; // "Min 2 yrs in business"
  borrower: string; // "Borrower: 1 yr"
};

type Checked = { result: RuleResult; check: RuleCheck };

function checked(result: RuleResult, requirement: string, borrower: string): Checked {
  return {
    result,
    check: { rule: result.rule, outcome: result.outcome, requirement, borrower: `Borrower: ${borrower}` },
  };
}

const NOT_GIVEN = "not given";
const yearsText = (years: number) => `${years} ${years === 1 ? "yr" : "yrs"}`;

function amountRule(input: BorrowerInput, p: Program): Checked {
  const amount = input.amountCents;
  const requirement = `Loan ${formatCents(p.minLoanCents)} to ${formatCents(p.maxLoanCents)}`;
  const borrower = formatCents(amount);
  if (amount < p.minLoanCents) {
    return checked(
      {
        rule: "amount",
        outcome: "fail",
        direction: "under",
        gapCents: p.minLoanCents - amount,
        limitCents: p.minLoanCents,
      },
      requirement,
      borrower,
    );
  }
  if (amount > p.maxLoanCents) {
    return checked(
      {
        rule: "amount",
        outcome: "fail",
        direction: "over",
        gapCents: amount - p.maxLoanCents,
        limitCents: p.maxLoanCents,
      },
      requirement,
      borrower,
    );
  }
  return checked({ rule: "amount", outcome: "pass" }, requirement, borrower);
}

function industryRule(input: BorrowerInput, p: Program): Checked {
  const eligible = p.eligibleBusinessType;
  const forAll = eligible === "All";
  const requirement = forAll ? "Any business type" : `Only for ${eligible}`;
  const borrower = input.businessType;
  // "Other" passes only programs for All (D5), even if a row were named "Other".
  const passes = forAll || (input.businessType !== "Other" && eligible === input.businessType);
  return checked(
    passes
      ? { rule: "industry", outcome: "pass" }
      : { rule: "industry", outcome: "fail", required: eligible },
    requirement,
    borrower,
  );
}

function yearsRule(input: BorrowerInput, p: Program): Checked {
  const min = p.minYearsInBusiness;
  const years = input.yearsInBusiness;
  const requirement = min === 0 ? "No minimum time in business" : `Min ${yearsText(min)} in business`;
  const borrower = years === null ? NOT_GIVEN : yearsText(years);
  // No minimum: nothing is asked, so a missing answer can't change the result (D24).
  if (min === 0) return checked({ rule: "years", outcome: "pass" }, requirement, borrower);
  if (years === null) return checked({ rule: "years", outcome: "unknown" }, requirement, borrower);
  if (years >= min) return checked({ rule: "years", outcome: "pass" }, requirement, borrower);
  return checked({ rule: "years", outcome: "fail", needed: min, has: years }, requirement, borrower);
}

function tierRule(input: BorrowerInput, p: Program): Checked {
  const needed = p.creditTierRequired;
  const has = input.creditTier;
  const requirement = needed === "Excellent" ? "Excellent credit" : `${needed} credit or better`;
  const borrower = has === null ? NOT_GIVEN : has;
  if (has === null) return checked({ rule: "tier", outcome: "unknown" }, requirement, borrower);
  if (TIER_RANK[has] >= TIER_RANK[needed]) {
    return checked({ rule: "tier", outcome: "pass" }, requirement, borrower);
  }
  return checked({ rule: "tier", outcome: "fail", needed, has }, requirement, borrower);
}

/** Only called when a score was typed (D1). */
function scoreRule(score: number, p: Program): Checked {
  const requirement = `Min ${p.minCreditScore} score`;
  const borrower = String(score);
  if (score >= p.minCreditScore) return checked({ rule: "score", outcome: "pass" }, requirement, borrower);
  return checked(
    { rule: "score", outcome: "fail", needed: p.minCreditScore, has: score },
    requirement,
    borrower,
  );
}

/** Every rule that runs for this borrower. The score rule runs only when a score was typed. */
export function checkRules(
  input: BorrowerInput,
  program: Program,
): { rules: RuleResult[]; checks: RuleCheck[] } {
  const all = [
    amountRule(input, program),
    industryRule(input, program),
    yearsRule(input, program),
    tierRule(input, program),
  ];
  if (input.creditScore !== null) all.push(scoreRule(input.creditScore, program));
  return { rules: all.map((c) => c.result), checks: all.map((c) => c.check) };
}

/** More than STALE_AFTER_DAYS before today. Exactly 31 days is not stale (D8). */
export function isStale(lastUpdated: IsoDate, today: IsoDate): boolean {
  return daysBetween(lastUpdated, today) > STALE_AFTER_DAYS;
}
