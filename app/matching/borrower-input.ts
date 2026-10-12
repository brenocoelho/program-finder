import type { Cents } from "~/shared/money";
import type { CreditTier } from "~/programs/program";

/**
 * What the rep knows about the borrower. null = not given.
 * (The Zod schema that turns search params into this, with the D20 limits,
 * is task 1 and is not written yet.)
 */
export type BorrowerInput = {
  amountCents: Cents; // required for results (D12)
  businessType: string; // a type from the live list, or "Other" (D5)
  creditTier: CreditTier | null;
  yearsInBusiness: number | null; // whole years (D2)
  creditScore: number | null; // null = not typed: the score rule is not run (D1)
};
