import { CREDIT_TIERS, type CreditTier } from "~/programs/program";
import { parseDollarsToCents, parseWholeNumber, type Cents } from "~/shared/money";

/**
 * What the rep knows about the borrower. null = not given.
 */
export type BorrowerInput = {
  amountCents: Cents; // required for results (D12)
  businessType: string; // a type from the live list, or "Other" (D5)
  creditTier: CreditTier | null;
  yearsInBusiness: number | null; // whole years (D2)
  creditScore: number | null; // null = not typed: the score rule is not run (D1)
};

export type BorrowerRawInput = {
  amount: string;
  type: string;
  tier: string;
  years: string;
  score: string;
};

export type BorrowerFieldErrors = Partial<Record<keyof BorrowerRawInput, string>>;

export type ParsedBorrowerInput =
  | { ok: true; value: BorrowerInput }
  | { ok: false; fieldErrors: BorrowerFieldErrors };

// Wide sanity limits for typos (D20): input checks only, not eligibility rules.
const AMOUNT_MIN_CENTS = 1_00;
const AMOUNT_MAX_CENTS = 50_000_000_00;
const YEARS_MIN = 0;
const YEARS_MAX = 99;
const SCORE_MIN = 300;
const SCORE_MAX = 850;

/**
 * Pure: turns the 5 raw search-param strings the rep typed into a
 * BorrowerInput, or a fieldError per bad field (FR-2: a single bad field
 * blocks every result, so every field is checked and reported, not just the
 * first). `businessTypes` is the live list (D5): "Other" is always allowed
 * in addition to it. The caller is expected to have already confirmed
 * `amount` and `type` are non-empty (D12's "need_input" vs "invalid" split
 * happens before this function runs, not inside it).
 */
export function parseBorrowerInput(
  raw: BorrowerRawInput,
  businessTypes: readonly string[],
): ParsedBorrowerInput {
  const fieldErrors: BorrowerFieldErrors = {};

  const amount = parseDollarsToCents(raw.amount);
  let amountCents: Cents | null = null;
  if (!amount.ok) {
    fieldErrors.amount = "Enter a dollar amount, like 250000 or 250k";
  } else if (amount.value < AMOUNT_MIN_CENTS || amount.value > AMOUNT_MAX_CENTS) {
    fieldErrors.amount = "Enter an amount between $1 and $50,000,000";
  } else {
    amountCents = amount.value;
  }

  const businessType = raw.type;
  if (businessType !== "Other" && !businessTypes.includes(businessType)) {
    fieldErrors.type = "Pick a business type from the list";
  }

  let creditTier: CreditTier | null = null;
  if (raw.tier !== "") {
    if (!(CREDIT_TIERS as readonly string[]).includes(raw.tier)) {
      fieldErrors.tier = "Pick Fair, Good or Excellent";
    } else {
      creditTier = raw.tier as CreditTier;
    }
  }

  let yearsInBusiness: number | null = null;
  if (raw.years !== "") {
    const years = parseWholeNumber(raw.years);
    if (!years.ok || years.value < YEARS_MIN || years.value > YEARS_MAX) {
      fieldErrors.years = "Enter a whole number of years, 0 to 99";
    } else {
      yearsInBusiness = years.value;
    }
  }

  let creditScore: number | null = null;
  if (raw.score !== "") {
    const score = parseWholeNumber(raw.score);
    if (!score.ok || score.value < SCORE_MIN || score.value > SCORE_MAX) {
      fieldErrors.score = "Enter a whole number, 300 to 850";
    } else {
      creditScore = score.value;
    }
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return {
    ok: true,
    value: { amountCents: amountCents!, businessType, creditTier, yearsInBusiness, creditScore },
  };
}
