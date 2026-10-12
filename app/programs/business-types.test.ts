import { describe, expect, it } from "vitest";
import { businessTypesOf } from "./business-types";
import type { Program } from "./program";

function programWith(eligibleBusinessType: string): Program {
  return {
    id: 1,
    importId: 1,
    rowNumber: 1,
    key: "lender|type",
    lenderName: "Lender",
    programType: "Type",
    minLoanCents: 0,
    maxLoanCents: 0,
    minCreditScore: 0,
    creditTierRequired: "Fair",
    minYearsInBusiness: 0,
    rateMinBp: 0,
    rateMaxBp: 0,
    maxTermMonths: 0,
    sbaGuaranteeBp: 0,
    eligibleBusinessType,
    requiresCollateral: "No",
    maxDebtRatioBp: null,
    turnaroundDays: 0,
    specialRequirements: null,
    lastUpdated: "2026-01-01",
  };
}

describe("the live list of business types", () => {
  it("excludes All", () => {
    expect(businessTypesOf([programWith("All"), programWith("Retail")])).toEqual(["Retail"]);
  });

  it("collapses duplicates across programs", () => {
    expect(businessTypesOf([programWith("Retail"), programWith("Retail")])).toEqual(["Retail"]);
  });

  it("is alphabetical", () => {
    expect(businessTypesOf([programWith("Retail"), programWith("Healthcare")])).toEqual([
      "Healthcare",
      "Retail",
    ]);
  });

  it("an empty program list gives an empty list", () => {
    expect(businessTypesOf([])).toEqual([]);
  });
});
