import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResultRow } from "~/components/result-row";
import type { BorrowerInput } from "~/matching/borrower-input";
import { matchPrograms, type Evaluation } from "~/matching/match";
import type { Program } from "~/programs/program";

// What the rep reads on one row, rendered from a real engine result.

const TODAY = "2026-10-12";
const usd = (dollars: number) => dollars * 100;

function program(overrides: Partial<Program> = {}): Program {
  return {
    id: 1,
    importId: 1,
    rowNumber: 2,
    key: "Test Lender|7(a) Standard",
    lenderName: "Test Lender",
    programType: "7(a) Standard",
    minLoanCents: usd(10_000),
    maxLoanCents: usd(250_000),
    minCreditScore: 680,
    creditTierRequired: "Good",
    minYearsInBusiness: 2,
    rateMinBp: 1000,
    rateMaxBp: 1200,
    maxTermMonths: 120,
    sbaGuaranteeBp: 7500,
    eligibleBusinessType: "All",
    requiresCollateral: "No",
    maxDebtRatioBp: 4500,
    turnaroundDays: 20,
    specialRequirements: null,
    lastUpdated: "2026-10-01",
    ...overrides,
  };
}

function input(overrides: Partial<BorrowerInput> = {}): BorrowerInput {
  return {
    amountCents: usd(100_000),
    businessType: "Construction",
    creditTier: "Good",
    yearsInBusiness: 2,
    creditScore: null,
    ...overrides,
  };
}

function evaluate(borrower: BorrowerInput, p: Program): Evaluation {
  const r = matchPrograms(borrower, [p], TODAY);
  return [...r.fits, ...r.close, ...r.askFirst, ...r.noFit][0];
}

/** The row as text, without tags, so assertions read like the screen. */
function rowText(borrower: BorrowerInput, p: Program = program()): string {
  const html = renderToStaticMarkup(createElement(ResultRow, { evaluation: evaluate(borrower, p) }));
  return html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");
}

describe("a Close row names its one problem and the gap (FR-5)", () => {
  it("over the max: the gap and the lender's max", () => {
    expect(rowText(input({ amountCents: usd(260_000) }))).toContain(
      "$10,000 over this lender's max ($250,000)",
    );
  });

  it("under the min: the gap and the lender's min", () => {
    expect(rowText(input({ amountCents: usd(5_000) }))).toContain("$5,000 under the min ($10,000)");
  });

  it("years: what is needed and what the borrower has", () => {
    expect(rowText(input({ yearsInBusiness: 1 }))).toContain("Needs 2+ years in business (borrower: 1)");
  });

  it("tier and score both failing names both (D13)", () => {
    expect(rowText(input({ creditTier: "Fair", creditScore: 650 }))).toContain(
      "Needs Good credit or better and 680+ score (borrower: 650)",
    );
  });

  it("a failed score with no tier is Close on the score (D27)", () => {
    expect(rowText(input({ creditTier: null, creditScore: 650 }))).toContain(
      "Needs 680+ score (borrower: 650)",
    );
  });
});

describe("an Ask first row names the empty fields (FR-6)", () => {
  it("asks for the credit tier and the years", () => {
    expect(rowText(input({ creditTier: null, yearsInBusiness: null }))).toContain(
      "Ask: years in business, credit tier",
    );
  });
});

describe("a Doesn't fit row says why in words, not only in colour", () => {
  it("a business type the program doesn't take is the whole reason", () => {
    const text = rowText(
      input({ businessType: "Retail", amountCents: usd(900_000) }),
      program({ eligibleBusinessType: "Manufacturing" }),
    );
    expect(text).toContain("Doesn't fit: only for Manufacturing");
    expect(text).not.toContain("over this lender's max (");
  });

  it("two problems are both named", () => {
    expect(rowText(input({ amountCents: usd(300_000), yearsInBusiness: 1 }))).toContain(
      "Doesn't fit: $50,000 over this lender's max ($250,000) · Needs 2+ years in business (borrower: 1)",
    );
  });

  it("a problem plus an empty field names the problem and what to ask", () => {
    expect(rowText(input({ amountCents: usd(300_000), yearsInBusiness: null }))).toContain(
      "Doesn't fit: $50,000 over this lender's max ($250,000) · Ask: years in business",
    );
  });

  it("an empty tier next to a failed score is not something to ask (D27)", () => {
    const text = rowText(input({ amountCents: usd(300_000), creditTier: null, creditScore: 650 }));
    expect(text).toContain(
      "Doesn't fit: $50,000 over this lender's max ($250,000) · Needs 680+ score (borrower: 650)",
    );
    expect(text).not.toContain("Ask: credit tier");
  });
});

describe("each rule chip says its outcome in a word", () => {
  it("Meets, Doesn't meet and Ask", () => {
    const text = rowText(input({ amountCents: usd(300_000), creditTier: null }));
    expect(text).toContain("Doesn't meet: Loan $10,000 to $250,000");
    expect(text).toContain("Meets: Any business type");
    expect(text).toContain("Ask: Good credit or better");
  });
});

describe("what every row shows (FR-8)", () => {
  it("needs 680+ even when no score is typed", () => {
    expect(rowText(input({ creditScore: null }))).toContain("needs 680+");
  });

  it("lender will check lists the debt ratio and the special requirements", () => {
    expect(
      rowText(input(), program({ maxDebtRatioBp: 5000, specialRequirements: "No recent bankruptcies (7 years)" })),
    ).toContain("Lender will check: maximum debt ratio 50.00%; No recent bankruptcies (7 years)");
  });

  it("a blank debt ratio is not shown as 0%", () => {
    const text = rowText(input(), program({ maxDebtRatioBp: null, specialRequirements: null }));
    expect(text).not.toContain("debt ratio");
    expect(text).not.toContain("Lender will check");
  });
});

describe("stale rates are flagged next to the rate (FR-9, D8)", () => {
  it("a row 32 days old shows the warning with its date, right after the rate", () => {
    const text = rowText(input(), program({ lastUpdated: "2026-09-10" }));
    expect(text).toMatch(/10\.00%–12\.00% Rates may be out of date \(as of Sep 10, 2026\)/);
  });

  it("a row exactly 31 days old has no warning", () => {
    expect(rowText(input(), program({ lastUpdated: "2026-09-11" }))).not.toContain("out of date");
  });
});
