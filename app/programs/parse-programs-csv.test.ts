import { readFileSync } from "node:fs";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseProgramsCsv } from "./parse-programs-csv";
import type { DataIssue } from "./program";

function fixture(name: string): string {
  return readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");
}
const realFile = readFileSync(new URL("../../data/programs.csv", import.meta.url));

const HEADER =
  "lender_name,program_type,min_loan_amount,max_loan_amount,min_credit_score,credit_tier_required,min_years_in_business,interest_rate_min,interest_rate_max,max_term_months,sba_guarantee_pct,eligible_business_types,requires_collateral,max_existing_debt_ratio,turnaround_days,special_requirements,last_updated";
const GOOD_ROW =
  "First National Bank,Community Advantage,10000,250000,620,Fair,1,11,13.6,84,85,All,Varies,0.5,23,No recent bankruptcies (7 years),1/16/2026";

function summarize(issues: DataIssue[]) {
  return issues.map((i) => [i.rowNumber, i.column, i.code]);
}

describe("row normalization: CSV row to program", () => {
  const result = parseProgramsCsv(fixture("real-rows.csv"));

  it("5 real rows become 5 programs and no issues", () => {
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.programs).toHaveLength(5);
    expect(result.rowCount).toBe(5);
  });

  it("money is integer cents, rates and shares are integer basis points", () => {
    if (!result.ok) throw new Error("expected an accepted file");
    expect(result.programs[0]).toEqual({
      rowNumber: 2,
      key: "First National Bank|Community Advantage",
      lenderName: "First National Bank",
      programType: "Community Advantage",
      minLoanCents: 1_000_000,
      maxLoanCents: 25_000_000,
      minCreditScore: 620,
      creditTierRequired: "Fair",
      minYearsInBusiness: 1,
      rateMinBp: 1100,
      rateMaxBp: 1360,
      maxTermMonths: 84,
      sbaGuaranteeBp: 8500,
      eligibleBusinessType: "All",
      requiresCollateral: "Varies",
      maxDebtRatioBp: 5000,
      turnaroundDays: 23,
      specialRequirements: "No recent bankruptcies (7 years)",
      lastUpdated: "2026-01-16",
    });
  });

  it("a $5,000,000 maximum with a 504 program keeps exact cents", () => {
    if (!result.ok) throw new Error("expected an accepted file");
    const p504 = result.programs[1];
    expect(p504.programType).toBe("504 Loan");
    expect(p504.maxLoanCents).toBe(500_000_000);
    expect(p504.rateMaxBp).toBe(770);
    expect(p504.sbaGuaranteeBp).toBe(4000);
    expect(p504.eligibleBusinessType).toBe("Manufacturing");
    expect(p504.requiresCollateral).toBe("Yes");
  });

  it("a blank special requirement is null, not an empty string", () => {
    if (!result.ok) throw new Error("expected an accepted file");
    expect(result.programs[2].specialRequirements).toBeNull();
  });

  it("a blank debt ratio is null, not 0%", () => {
    if (!result.ok) throw new Error("expected an accepted file");
    expect(result.programs[4].maxDebtRatioBp).toBeNull();
  });

  it("each program keeps its CSV line number, header = line 1", () => {
    if (!result.ok) throw new Error("expected an accepted file");
    expect(result.programs.map((p) => p.rowNumber)).toEqual([2, 3, 4, 5, 6]);
  });
});

describe("the real catalog", () => {
  it("the sample CSV is accepted with 49 programs and zero issues", () => {
    const result = parseProgramsCsv(realFile);
    expect(result).toMatchObject({ ok: true, rowCount: 49 });
    if (result.ok) expect(result.programs).toHaveLength(49);
  });

  it("every program in the sample CSV has its own lender + program key", () => {
    const result = parseProgramsCsv(realFile);
    if (!result.ok) throw new Error("expected an accepted file");
    expect(new Set(result.programs.map((p) => p.key)).size).toBe(49);
  });
});

describe("a broken file is rejected as a whole", () => {
  const result = parseProgramsCsv(fixture("broken-programs.csv"));

  it("one bad row rejects the file: no programs come back, even the valid rows", () => {
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("programs");
  });

  it("each issue names the row number, the column and the problem", () => {
    if (result.ok) throw new Error("expected a rejected file");
    expect(summarize(result.issues)).toEqual([
      [3, "min_loan_amount", "not_a_number"],
      [4, "max_loan_amount", "not_whole_number"],
      [5, "min_years_in_business", "negative"],
      [6, "interest_rate_max", "too_many_decimals"],
      [7, "interest_rate_max", "min_over_max"],
      [8, "credit_tier_required", "unknown_tier"],
      [9, "requires_collateral", "unknown_collateral"],
      [10, "last_updated", "bad_date"],
      [11, "lender_name", "missing_value"],
      [12, "sba_guarantee_pct", "out_of_range"],
      [13, null, "duplicate_program"],
      [14, "max_term_months", "out_of_range"],
      [14, "turnaround_days", "not_a_number"],
      [16, null, "malformed_csv"],
    ]);
  });

  it("row numbers are file lines, so a blank line does not shift them", () => {
    if (result.ok) throw new Error("expected a rejected file");
    const short = result.issues.find((i) => i.code === "malformed_csv");
    expect(short?.rowNumber).toBe(16);
  });

  it("a row with two problems reports both", () => {
    if (result.ok) throw new Error("expected a rejected file");
    expect(result.issues.filter((i) => i.rowNumber === 14)).toHaveLength(2);
  });

  it("an issue carries the bad value and a plain message", () => {
    if (result.ok) throw new Error("expected a rejected file");
    const issue = result.issues[0];
    expect(issue.value).toBe("ten thousand");
    expect(issue.message).toBe("Must be a number");
  });

  it("the duplicate points at the earlier row and the later row is the one flagged", () => {
    if (result.ok) throw new Error("expected a rejected file");
    const dup = result.issues.find((i) => i.code === "duplicate_program");
    expect(dup?.rowNumber).toBe(13);
    expect(dup?.message).toMatch(/row 2/);
  });

  it("the row count is the data rows read, not the programs accepted", () => {
    expect(result.rowCount).toBe(14);
  });
});

describe("a bad value", () => {
  function issuesFor(row: string) {
    const result = parseProgramsCsv(`${HEADER}\n${row}\n`);
    if (result.ok) throw new Error("expected a rejected file");
    return summarize(result.issues);
  }

  it("a min loan of 0 is out of range: it can't be a real minimum", () => {
    expect(issuesFor(GOOD_ROW.replace(",10000,", ",0,"))).toEqual([
      [2, "min_loan_amount", "out_of_range"],
    ]);
  });

  it("a max below the min loan is reported on the max column", () => {
    expect(issuesFor(GOOD_ROW.replace(",250000,", ",9999,"))).toEqual([
      [2, "max_loan_amount", "min_over_max"],
    ]);
  });

  it("a max equal to the min loan is accepted", () => {
    const result = parseProgramsCsv(`${HEADER}\n${GOOD_ROW.replace(",250000,", ",10000,")}\n`);
    expect(result.ok).toBe(true);
  });

  it("a rate min equal to the rate max is accepted", () => {
    const result = parseProgramsCsv(`${HEADER}\n${GOOD_ROW.replace(",11,13.6,", ",11,11,")}\n`);
    expect(result.ok).toBe(true);
  });

  it("an SBA guarantee of exactly 100% is accepted and 101% is out of range", () => {
    expect(parseProgramsCsv(`${HEADER}\n${GOOD_ROW.replace(",85,", ",100,")}\n`).ok).toBe(true);
    expect(issuesFor(GOOD_ROW.replace(",85,", ",101,"))).toEqual([
      [2, "sba_guarantee_pct", "out_of_range"],
    ]);
  });

  it("a minimum of 0 years in business is accepted", () => {
    const result = parseProgramsCsv(`${HEADER}\n${GOOD_ROW.replace(",Fair,1,", ",Fair,0,")}\n`);
    expect(result.ok).toBe(true);
  });

  it("the tier Excellent is accepted, and good in lower case is not", () => {
    expect(parseProgramsCsv(`${HEADER}\n${GOOD_ROW.replace("Fair", "Excellent")}\n`).ok).toBe(true);
    expect(issuesFor(GOOD_ROW.replace("Fair", "good"))).toEqual([
      [2, "credit_tier_required", "unknown_tier"],
    ]);
  });

  it("a small debt ratio like 0.005 is accepted and a negative one is not", () => {
    expect(parseProgramsCsv(`${HEADER}\n${GOOD_ROW.replace(",0.5,", ",0.005,")}\n`).ok).toBe(true);
    expect(issuesFor(GOOD_ROW.replace(",0.5,", ",-0.5,"))).toEqual([
      [2, "max_existing_debt_ratio", "negative"],
    ]);
  });

  it("a blank required value is missing, not zero", () => {
    expect(issuesFor(GOOD_ROW.replace(",620,", ",,"))).toEqual([
      [2, "min_credit_score", "missing_value"],
    ]);
  });

  it("a very long bad value is cut to 200 characters in the issue", () => {
    const result = parseProgramsCsv(`${HEADER}\n${GOOD_ROW.replace(",10000,", `,${"x".repeat(500)},`)}\n`);
    if (result.ok) throw new Error("expected a rejected file");
    expect(result.issues[0].value).toHaveLength(200);
  });

  it("spaces around a value are ignored", () => {
    const row = GOOD_ROW.replace("First National Bank,", " First National Bank ,").replace(",10000,", ", 10000 ,");
    const result = parseProgramsCsv(`${HEADER}\n${row}\n`);
    if (!result.ok) throw new Error("expected an accepted file");
    expect(result.programs[0].lenderName).toBe("First National Bank");
    expect(result.programs[0].minLoanCents).toBe(1_000_000);
  });
});

describe("a file that can't be read as a catalog", () => {
  it("a file with no bytes is empty_file with no row number", () => {
    const result = parseProgramsCsv("");
    if (result.ok) throw new Error("expected a rejected file");
    expect(summarize(result.issues)).toEqual([[null, null, "empty_file"]]);
    expect(result.rowCount).toBe(0);
  });

  it("a header with no rows is empty_file: no programs is never a success", () => {
    const result = parseProgramsCsv(`${HEADER}\n`);
    if (result.ok) throw new Error("expected a rejected file");
    expect(summarize(result.issues)).toEqual([[null, null, "empty_file"]]);
  });

  it("each missing column is one issue with no row number", () => {
    const header = HEADER.replace("turnaround_days,", "").replace("max_term_months,", "");
    const result = parseProgramsCsv(`${header}\n${GOOD_ROW}\n`);
    if (result.ok) throw new Error("expected a rejected file");
    expect(summarize(result.issues)).toEqual([
      [null, "max_term_months", "missing_column"],
      [null, "turnaround_days", "missing_column"],
    ]);
  });

  it("an unclosed quote is reported as malformed_csv, not thrown", () => {
    const result = parseProgramsCsv(`${HEADER}\n"First National Bank,Community Advantage,10000\n`);
    if (result.ok) throw new Error("expected a rejected file");
    expect(result.issues.map((i) => i.code)).toEqual(["malformed_csv"]);
  });

  it("bytes that are not UTF-8 are reported as malformed_csv, not read as garbled names", () => {
    const bytes = new Uint8Array([...Buffer.from(`${HEADER}\n`), 0xff, 0xfe, 0x2c]);
    const result = parseProgramsCsv(bytes);
    if (result.ok) throw new Error("expected a rejected file");
    expect(result.issues.map((i) => i.code)).toEqual(["malformed_csv"]);
  });

  it("a byte order mark and Windows line endings are accepted", () => {
    const text = `﻿${HEADER}\r\n${GOOD_ROW}\r\n`;
    expect(parseProgramsCsv(Buffer.from(text, "utf8"))).toMatchObject({ ok: true, rowCount: 1 });
  });

  it("a quoted value with a comma stays one value", () => {
    const row = GOOD_ROW.replace("No recent bankruptcies (7 years)", '"No recent bankruptcies, 7 years"');
    const result = parseProgramsCsv(`${HEADER}\n${row}\n`);
    if (!result.ok) throw new Error("expected an accepted file");
    expect(result.programs[0].specialRequirements).toBe("No recent bankruptcies, 7 years");
  });

  it("a column the app doesn't use is ignored", () => {
    const result = parseProgramsCsv(`${HEADER},notes\n${GOOD_ROW},call back\n`);
    expect(result.ok).toBe(true);
  });

  it("property: any text gives a result and never throws", () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.string().map((s) => `${HEADER}\n${s}`)), (text) => {
        const result = parseProgramsCsv(text);
        if (!result.ok) expect(result.issues.length).toBeGreaterThan(0);
      }),
    );
  });

  it("property: the same file always gives the same result", () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        expect(parseProgramsCsv(`${HEADER}\n${text}`)).toEqual(parseProgramsCsv(`${HEADER}\n${text}`));
      }),
    );
  });
});
