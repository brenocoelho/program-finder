import { describe, expect, it } from "vitest";
import { parseBorrowerInput } from "./borrower-input";

const BUSINESS_TYPES = ["Construction", "Healthcare", "Retail"];

const raw = (overrides: Partial<Record<"amount" | "type" | "tier" | "years" | "score", string>>) => ({
  amount: "250000",
  type: "Retail",
  tier: "",
  years: "",
  score: "",
  ...overrides,
});

describe("amount (D20)", () => {
  it("exactly $1 and exactly $50,000,000 are accepted", () => {
    expect(parseBorrowerInput(raw({ amount: "1" }), BUSINESS_TYPES)).toMatchObject({ ok: true });
    expect(parseBorrowerInput(raw({ amount: "50000000" }), BUSINESS_TYPES)).toMatchObject({ ok: true });
  });

  it("$0 and $50,000,001 are rejected", () => {
    expect(parseBorrowerInput(raw({ amount: "0" }), BUSINESS_TYPES)).toMatchObject({
      ok: false,
      fieldErrors: { amount: expect.any(String) },
    });
    expect(parseBorrowerInput(raw({ amount: "50000001" }), BUSINESS_TYPES)).toMatchObject({
      ok: false,
      fieldErrors: { amount: expect.any(String) },
    });
  });

  it("250000.50 is rejected: whole dollars only", () => {
    expect(parseBorrowerInput(raw({ amount: "250000.50" }), BUSINESS_TYPES)).toMatchObject({
      ok: false,
      fieldErrors: { amount: expect.any(String) },
    });
  });

  it("250k is accepted as $250,000", () => {
    const result = parseBorrowerInput(raw({ amount: "250k" }), BUSINESS_TYPES);
    expect(result).toMatchObject({ ok: true, value: { amountCents: 25_000_000 } });
  });
});

describe("years in business (D2)", () => {
  it("0 and 99 years are accepted", () => {
    expect(parseBorrowerInput(raw({ years: "0" }), BUSINESS_TYPES)).toMatchObject({
      ok: true,
      value: { yearsInBusiness: 0 },
    });
    expect(parseBorrowerInput(raw({ years: "99" }), BUSINESS_TYPES)).toMatchObject({
      ok: true,
      value: { yearsInBusiness: 99 },
    });
  });

  it("100 years and 0.5 years are rejected", () => {
    expect(parseBorrowerInput(raw({ years: "100" }), BUSINESS_TYPES)).toMatchObject({
      ok: false,
      fieldErrors: { years: expect.any(String) },
    });
    expect(parseBorrowerInput(raw({ years: "0.5" }), BUSINESS_TYPES)).toMatchObject({
      ok: false,
      fieldErrors: { years: expect.any(String) },
    });
  });

  it("an empty years field means years is not known", () => {
    expect(parseBorrowerInput(raw({ years: "" }), BUSINESS_TYPES)).toMatchObject({
      ok: true,
      value: { yearsInBusiness: null },
    });
  });
});

describe("credit score (D1, D20)", () => {
  it("scores 300 and 850 are accepted", () => {
    expect(parseBorrowerInput(raw({ score: "300" }), BUSINESS_TYPES)).toMatchObject({
      ok: true,
      value: { creditScore: 300 },
    });
    expect(parseBorrowerInput(raw({ score: "850" }), BUSINESS_TYPES)).toMatchObject({
      ok: true,
      value: { creditScore: 850 },
    });
  });

  it("scores 299 and 851 are rejected", () => {
    expect(parseBorrowerInput(raw({ score: "299" }), BUSINESS_TYPES)).toMatchObject({
      ok: false,
      fieldErrors: { score: expect.any(String) },
    });
    expect(parseBorrowerInput(raw({ score: "851" }), BUSINESS_TYPES)).toMatchObject({
      ok: false,
      fieldErrors: { score: expect.any(String) },
    });
  });

  it("a 6800 score typo is rejected, never passed through as Fits", () => {
    expect(parseBorrowerInput(raw({ score: "6800" }), BUSINESS_TYPES)).toMatchObject({
      ok: false,
      fieldErrors: { score: expect.any(String) },
    });
  });

  it("a score with a letter or symbol typo (64O, 640-) is rejected, never read as no score", () => {
    for (const score of ["64O", "640-", "6e2"]) {
      expect(parseBorrowerInput(raw({ score }), BUSINESS_TYPES)).toMatchObject({
        ok: false,
        fieldErrors: { score: expect.any(String) },
      });
    }
  });

  it("an empty score means no score was typed", () => {
    expect(parseBorrowerInput(raw({ score: "" }), BUSINESS_TYPES)).toMatchObject({
      ok: true,
      value: { creditScore: null },
    });
  });
});

describe("credit tier", () => {
  it("an empty tier is read as unknown, not an error", () => {
    expect(parseBorrowerInput(raw({ tier: "" }), BUSINESS_TYPES)).toMatchObject({
      ok: true,
      value: { creditTier: null },
    });
  });

  it("Fair, Good and Excellent are accepted", () => {
    for (const tier of ["Fair", "Good", "Excellent"]) {
      expect(parseBorrowerInput(raw({ tier }), BUSINESS_TYPES)).toMatchObject({
        ok: true,
        value: { creditTier: tier },
      });
    }
  });

  it("a tier outside the three named values is rejected", () => {
    expect(parseBorrowerInput(raw({ tier: "Great" }), BUSINESS_TYPES)).toMatchObject({
      ok: false,
      fieldErrors: { tier: expect.any(String) },
    });
  });
});

describe("business type (D5)", () => {
  it("a type from the live list is accepted", () => {
    expect(parseBorrowerInput(raw({ type: "Healthcare" }), BUSINESS_TYPES)).toMatchObject({
      ok: true,
      value: { businessType: "Healthcare" },
    });
  });

  it("Other is always valid even though it is never in the live list", () => {
    expect(parseBorrowerInput(raw({ type: "Other" }), BUSINESS_TYPES)).toMatchObject({
      ok: true,
      value: { businessType: "Other" },
    });
  });

  it("a type that is neither in the list nor Other is rejected", () => {
    expect(parseBorrowerInput(raw({ type: "Not A Type" }), BUSINESS_TYPES)).toMatchObject({
      ok: false,
      fieldErrors: { type: expect.any(String) },
    });
  });
});

describe("an invalid field gives no results (FR-2)", () => {
  it("one bad field blocks the whole parse: no BorrowerInput comes back", () => {
    const result = parseBorrowerInput(raw({ score: "6800" }), BUSINESS_TYPES);
    expect(result.ok).toBe(false);
  });

  it("every bad field is reported, not just the first", () => {
    const result = parseBorrowerInput(raw({ years: "100", score: "900" }), BUSINESS_TYPES);
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { years: expect.any(String), score: expect.any(String) },
    });
  });
});
