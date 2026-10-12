import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import type { BorrowerInput } from "~/matching/borrower-input";
import { matchPrograms, type Evaluation } from "~/matching/match";
import { parseProgramsCsv } from "~/programs/parse-programs-csv";
import type { CreditTier, Program } from "~/programs/program";

// The scenarios from docs/UNDERSTANDING.md (S1-S5) and docs/SPEC.md section 7
// (S6-S8) against the real catalog, data/programs.csv, with today = 2026-10-12.
// Each row is a CSV line number (header = line 1), so every row can be checked
// by hand against the file. Within a group, rows are in the expected order:
// starting rate, then days to a decision (the comment on each row shows both).
//
// The expected lists were computed by a separate reference script that applies
// the rules table in the spec to the CSV. They are not the engine's output.

const TODAY = "2026-10-12";
const usd = (dollars: number) => dollars * 100;

type Scenario = {
  name: string;
  input: BorrowerInput;
  fits: number[];
  close: [line: number, problem: "amount" | "years" | "credit"][];
  askFirst: number[];
  noFitCount: number;
};

const SCENARIOS: Scenario[] = [
  {
    name: "S1 many matches: Construction, $250,000, Good, 3 years",
    input: { amountCents: usd(250_000), businessType: "Construction", creditTier: "Good", yearsInBusiness: 3, creditScore: null },
    fits: [
      22, // Midwest Business Finance · 504 Loan · 5.5% · 82 days
      27, // Evergreen Business Capital · 504 Loan · 5.9% · 58 days
      13, // Summit Lending Group · 504 Loan · 6.0% · 61 days
      20, // Coastal Capital · 504 Loan · 6.4% · 68 days
      42, // Gateway Commercial Finance · 504 Loan · 6.5% · 48 days
      34, // Keystone Community Bank · 7(a) Standard · 8.6% · 48 days
      25, // Pinnacle Funding Corp · 7(a) Standard · 9.2% · 50 days
      44, // Sterling Business Lending · 7(a) Small Loan · 9.4% · 23 days
      48, // Frontier Capital Group · 7(a) Small Loan · 9.5% · 21 days
      21, // Midwest Business Finance · SBA Express · 9.6% · 14 days
      40, // Gateway Commercial Finance · 7(a) Small Loan · 9.6% · 25 days
      30, // Evergreen Business Capital · 7(a) Standard · 9.6% · 39 days
      28, // Evergreen Business Capital · 7(a) Small Loan · 9.9% · 15 days
      35, // Keystone Community Bank · Community Advantage · 10.0% · 23 days
      37, // BlueRidge Lending Partners · 7(a) Standard · 10.0% · 55 days
      11, // Heritage Credit Union · SBA Express · 10.3% · 10 days
      17, // Coastal Capital · 7(a) Standard · 10.3% · 53 days
      26, // Pinnacle Funding Corp · 7(a) Small Loan · 10.5% · 26 days
      24, // Liberty SBA Lending · 7(a) Small Loan · 10.7% · 24 days
      2, // First National Bank · Community Advantage · 11.0% · 23 days
      8, // Pacific Commerce Bank · 7(a) Small Loan · 11.1% · 19 days
      3, // First National Bank · SBA Express · 11.4% · 13 days
      23, // Liberty SBA Lending · SBA Express · 11.5% · 10 days
      45, // Sterling Business Lending · Community Advantage · 11.5% · 43 days
      38, // BlueRidge Lending Partners · SBA Express · 11.7% · 5 days
      41, // Gateway Commercial Finance · SBA Express · 11.7% · 10 days
      43, // Sterling Business Lending · SBA Express · 12.1% · 12 days
    ],
    close: [],
    askFirst: [],
    noFitCount: 22,
  },
  {
    name: "S2 unknown revenue: Healthcare, $150,000, Good, 2 years",
    input: { amountCents: usd(150_000), businessType: "Healthcare", creditTier: "Good", yearsInBusiness: 2, creditScore: null },
    fits: [
      22, // Midwest Business Finance · 504 Loan · 5.5% · 82 days
      27, // Evergreen Business Capital · 504 Loan · 5.9% · 58 days
      39, // Gateway Commercial Finance · 7(a) Standard · 8.5% · 57 days
      34, // Keystone Community Bank · 7(a) Standard · 8.6% · 48 days
      44, // Sterling Business Lending · 7(a) Small Loan · 9.4% · 23 days
      48, // Frontier Capital Group · 7(a) Small Loan · 9.5% · 21 days
      40, // Gateway Commercial Finance · 7(a) Small Loan · 9.6% · 25 days
      46, // Sterling Business Lending · 7(a) Standard · 10.1% · 57 days
      32, // Atlas Financial Services · SBA Express · 10.2% · 7 days
      11, // Heritage Credit Union · SBA Express · 10.3% · 10 days
      17, // Coastal Capital · 7(a) Standard · 10.3% · 53 days
      2, // First National Bank · Community Advantage · 11.0% · 23 days
      3, // First National Bank · SBA Express · 11.4% · 13 days
      23, // Liberty SBA Lending · SBA Express · 11.5% · 10 days
      38, // BlueRidge Lending Partners · SBA Express · 11.7% · 5 days
      41, // Gateway Commercial Finance · SBA Express · 11.7% · 10 days
      43, // Sterling Business Lending · SBA Express · 12.1% · 12 days
    ],
    close: [
      [50, "amount"], // Frontier Capital Group · 504 Loan · 6.0% · 49 days
      [20, "amount"], // Coastal Capital · 504 Loan · 6.4% · 68 days
      [42, "years"], // Gateway Commercial Finance · 504 Loan · 6.5% · 48 days
      [30, "years"], // Evergreen Business Capital · 7(a) Standard · 9.6% · 39 days
      [37, "years"], // BlueRidge Lending Partners · 7(a) Standard · 10.0% · 55 days
    ],
    askFirst: [],
    noFitCount: 27,
  },
  {
    name: "S3 a little over a limit: Restaurant/Food Service, $260,000, Fair, 2 years",
    input: { amountCents: usd(260_000), businessType: "Restaurant/Food Service", creditTier: "Fair", yearsInBusiness: 2, creditScore: null },
    fits: [
      18, // Coastal Capital · Community Advantage · 12.4% · 45 days
    ],
    close: [
      [22, "credit"], // Midwest Business Finance · 504 Loan · 5.5% · 82 days
      [27, "credit"], // Evergreen Business Capital · 504 Loan · 5.9% · 58 days
      [20, "credit"], // Coastal Capital · 504 Loan · 6.4% · 68 days
      [34, "credit"], // Keystone Community Bank · 7(a) Standard · 8.6% · 48 days
      [16, "credit"], // Summit Lending Group · 7(a) Standard · 9.8% · 46 days
      [49, "credit"], // Frontier Capital Group · SBA Express · 10.1% · 14 days
      [11, "credit"], // Heritage Credit Union · SBA Express · 10.3% · 10 days
      [17, "credit"], // Coastal Capital · 7(a) Standard · 10.3% · 53 days
      [33, "credit"], // Keystone Community Bank · 7(a) Small Loan · 10.9% · 17 days
      [2, "amount"], // First National Bank · Community Advantage · 11.0% · 23 days
      [3, "credit"], // First National Bank · SBA Express · 11.4% · 13 days
      [23, "credit"], // Liberty SBA Lending · SBA Express · 11.5% · 10 days
      [38, "credit"], // BlueRidge Lending Partners · SBA Express · 11.7% · 5 days
      [41, "credit"], // Gateway Commercial Finance · SBA Express · 11.7% · 10 days
      [43, "credit"], // Sterling Business Lending · SBA Express · 12.1% · 12 days
      [29, "amount"], // Evergreen Business Capital · Community Advantage · 12.3% · 41 days
    ],
    askFirst: [],
    noFitCount: 32,
  },
  {
    name: "S4 a very new business: Retail, $50,000, Good, 0 years",
    input: { amountCents: usd(50_000), businessType: "Retail", creditTier: "Good", yearsInBusiness: 0, creditScore: null },
    fits: [],
    close: [
      [10, "years"], // Heritage Credit Union · 7(a) Small Loan · 9.2% · 19 days
      [44, "years"], // Sterling Business Lending · 7(a) Small Loan · 9.4% · 23 days
      [48, "years"], // Frontier Capital Group · 7(a) Small Loan · 9.5% · 21 days
      [40, "years"], // Gateway Commercial Finance · 7(a) Small Loan · 9.6% · 25 days
      [11, "years"], // Heritage Credit Union · SBA Express · 10.3% · 10 days
      [17, "years"], // Coastal Capital · 7(a) Standard · 10.3% · 53 days
      [2, "years"], // First National Bank · Community Advantage · 11.0% · 23 days
      [3, "years"], // First National Bank · SBA Express · 11.4% · 13 days
      [23, "years"], // Liberty SBA Lending · SBA Express · 11.5% · 10 days
      [38, "years"], // BlueRidge Lending Partners · SBA Express · 11.7% · 5 days
      [41, "years"], // Gateway Commercial Finance · SBA Express · 11.7% · 10 days
      [43, "years"], // Sterling Business Lending · SBA Express · 12.1% · 12 days
    ],
    askFirst: [],
    noFitCount: 37,
  },
  {
    name: "S5 an excluded industry: Healthcare, $300,000, Fair, 2 years",
    input: { amountCents: usd(300_000), businessType: "Healthcare", creditTier: "Fair", yearsInBusiness: 2, creditScore: null },
    fits: [],
    close: [
      [22, "credit"], // Midwest Business Finance · 504 Loan · 5.5% · 82 days
      [27, "credit"], // Evergreen Business Capital · 504 Loan · 5.9% · 58 days
      [50, "credit"], // Frontier Capital Group · 504 Loan · 6.0% · 49 days
      [20, "credit"], // Coastal Capital · 504 Loan · 6.4% · 68 days
      [39, "credit"], // Gateway Commercial Finance · 7(a) Standard · 8.5% · 57 days
      [34, "credit"], // Keystone Community Bank · 7(a) Standard · 8.6% · 48 days
      [46, "credit"], // Sterling Business Lending · 7(a) Standard · 10.1% · 57 days
      [32, "credit"], // Atlas Financial Services · SBA Express · 10.2% · 7 days
      [11, "credit"], // Heritage Credit Union · SBA Express · 10.3% · 10 days
      [17, "credit"], // Coastal Capital · 7(a) Standard · 10.3% · 53 days
      [2, "amount"], // First National Bank · Community Advantage · 11.0% · 23 days
      [3, "credit"], // First National Bank · SBA Express · 11.4% · 13 days
      [23, "credit"], // Liberty SBA Lending · SBA Express · 11.5% · 10 days
      [38, "credit"], // BlueRidge Lending Partners · SBA Express · 11.7% · 5 days
      [41, "credit"], // Gateway Commercial Finance · SBA Express · 11.7% · 10 days
      [43, "credit"], // Sterling Business Lending · SBA Express · 12.1% · 12 days
    ],
    askFirst: [],
    noFitCount: 33,
  },
  {
    name: "S6 S2 without a tier: Healthcare, $150,000, no tier, 2 years",
    input: { amountCents: usd(150_000), businessType: "Healthcare", creditTier: null, yearsInBusiness: 2, creditScore: null },
    fits: [],
    close: [],
    askFirst: [
      22, // Midwest Business Finance · 504 Loan · 5.5% · 82 days
      27, // Evergreen Business Capital · 504 Loan · 5.9% · 58 days
      39, // Gateway Commercial Finance · 7(a) Standard · 8.5% · 57 days
      34, // Keystone Community Bank · 7(a) Standard · 8.6% · 48 days
      44, // Sterling Business Lending · 7(a) Small Loan · 9.4% · 23 days
      48, // Frontier Capital Group · 7(a) Small Loan · 9.5% · 21 days
      40, // Gateway Commercial Finance · 7(a) Small Loan · 9.6% · 25 days
      46, // Sterling Business Lending · 7(a) Standard · 10.1% · 57 days
      32, // Atlas Financial Services · SBA Express · 10.2% · 7 days
      11, // Heritage Credit Union · SBA Express · 10.3% · 10 days
      17, // Coastal Capital · 7(a) Standard · 10.3% · 53 days
      2, // First National Bank · Community Advantage · 11.0% · 23 days
      3, // First National Bank · SBA Express · 11.4% · 13 days
      23, // Liberty SBA Lending · SBA Express · 11.5% · 10 days
      38, // BlueRidge Lending Partners · SBA Express · 11.7% · 5 days
      41, // Gateway Commercial Finance · SBA Express · 11.7% · 10 days
      43, // Sterling Business Lending · SBA Express · 12.1% · 12 days
    ],
    noFitCount: 32,
  },
  {
    name: "S7 S2 plus a 650 score: Healthcare, $150,000, Good, 2 years, score 650",
    input: { amountCents: usd(150_000), businessType: "Healthcare", creditTier: "Good", yearsInBusiness: 2, creditScore: 650 },
    fits: [
      11, // Heritage Credit Union · SBA Express · 10.3% · 10 days
      2, // First National Bank · Community Advantage · 11.0% · 23 days
      23, // Liberty SBA Lending · SBA Express · 11.5% · 10 days
      38, // BlueRidge Lending Partners · SBA Express · 11.7% · 5 days
      41, // Gateway Commercial Finance · SBA Express · 11.7% · 10 days
      43, // Sterling Business Lending · SBA Express · 12.1% · 12 days
    ],
    close: [
      [22, "credit"], // Midwest Business Finance · 504 Loan · 5.5% · 82 days
      [27, "credit"], // Evergreen Business Capital · 504 Loan · 5.9% · 58 days
      [39, "credit"], // Gateway Commercial Finance · 7(a) Standard · 8.5% · 57 days
      [34, "credit"], // Keystone Community Bank · 7(a) Standard · 8.6% · 48 days
      [44, "credit"], // Sterling Business Lending · 7(a) Small Loan · 9.4% · 23 days
      [48, "credit"], // Frontier Capital Group · 7(a) Small Loan · 9.5% · 21 days
      [40, "credit"], // Gateway Commercial Finance · 7(a) Small Loan · 9.6% · 25 days
      [46, "credit"], // Sterling Business Lending · 7(a) Standard · 10.1% · 57 days
      [32, "credit"], // Atlas Financial Services · SBA Express · 10.2% · 7 days
      [17, "credit"], // Coastal Capital · 7(a) Standard · 10.3% · 53 days
      [3, "credit"], // First National Bank · SBA Express · 11.4% · 13 days
    ],
    askFirst: [],
    noFitCount: 32,
  },
  {
    name: "S8 Healthcare, $150,000, Fair, 2 years, score 650",
    input: { amountCents: usd(150_000), businessType: "Healthcare", creditTier: "Fair", yearsInBusiness: 2, creditScore: 650 },
    fits: [
      2, // First National Bank · Community Advantage · 11.0% · 23 days
    ],
    close: [
      [22, "credit"], // Midwest Business Finance · 504 Loan · 5.5% · 82 days
      [27, "credit"], // Evergreen Business Capital · 504 Loan · 5.9% · 58 days
      [39, "credit"], // Gateway Commercial Finance · 7(a) Standard · 8.5% · 57 days
      [34, "credit"], // Keystone Community Bank · 7(a) Standard · 8.6% · 48 days
      [44, "credit"], // Sterling Business Lending · 7(a) Small Loan · 9.4% · 23 days
      [48, "credit"], // Frontier Capital Group · 7(a) Small Loan · 9.5% · 21 days
      [40, "credit"], // Gateway Commercial Finance · 7(a) Small Loan · 9.6% · 25 days
      [46, "credit"], // Sterling Business Lending · 7(a) Standard · 10.1% · 57 days
      [32, "credit"], // Atlas Financial Services · SBA Express · 10.2% · 7 days
      [11, "credit"], // Heritage Credit Union · SBA Express · 10.3% · 10 days
      [17, "credit"], // Coastal Capital · 7(a) Standard · 10.3% · 53 days
      [3, "credit"], // First National Bank · SBA Express · 11.4% · 13 days
      [23, "credit"], // Liberty SBA Lending · SBA Express · 11.5% · 10 days
      [38, "credit"], // BlueRidge Lending Partners · SBA Express · 11.7% · 5 days
      [41, "credit"], // Gateway Commercial Finance · SBA Express · 11.7% · 10 days
      [43, "credit"], // Sterling Business Lending · SBA Express · 12.1% · 12 days
    ],
    askFirst: [],
    noFitCount: 32,
  },
];

let catalog: Program[];
let byLine: Map<number, Program>;

beforeAll(() => {
  const parsed = parseProgramsCsv(readFileSync(new URL("../../data/programs.csv", import.meta.url)));
  if (!parsed.ok) throw new Error("data/programs.csv should be a valid file");
  catalog = parsed.programs.map((p) => ({ ...p, id: p.rowNumber, importId: 1 }));
  byLine = new Map(catalog.map((p) => [p.rowNumber, p]));
});

const lines = (list: Evaluation[]) => list.map((e) => e.program.rowNumber);

describe("the catalog the scenarios run on", () => {
  it("is the 49 programs of the sample file", () => {
    expect(catalog).toHaveLength(49);
    expect(catalog[0].rowNumber).toBe(2);
    expect(catalog[48].rowNumber).toBe(50);
  });
});

describe.each(SCENARIOS)("$name", (s) => {
  it("Fits, in order", () => {
    expect(lines(matchPrograms(s.input, catalog, TODAY).fits)).toEqual(s.fits);
  });

  it("Close, in order, each with its one problem", () => {
    const r = matchPrograms(s.input, catalog, TODAY);
    expect(r.close.map((e) => [e.program.rowNumber, e.closeProblem])).toEqual(s.close);
  });

  it("Ask first, in order", () => {
    expect(lines(matchPrograms(s.input, catalog, TODAY).askFirst)).toEqual(s.askFirst);
  });

  it("Doesn't fit holds every other program", () => {
    const r = matchPrograms(s.input, catalog, TODAY);
    expect(r.noFit).toHaveLength(s.noFitCount);
    const placed = [...r.fits, ...r.close, ...r.askFirst, ...r.noFit];
    expect(lines(placed).sort((a, b) => a - b)).toEqual(catalog.map((p) => p.rowNumber));
  });
});

describe("what each scenario was written to check", () => {
  const run = (s: Scenario) => matchPrograms(s.input, catalog, TODAY);
  const scenario = (prefix: string) => {
    const found = SCENARIOS.find((s) => s.name.startsWith(prefix + " "));
    if (!found) throw new Error(`no scenario ${prefix}`);
    return found;
  };

  it("S1: programs sitting exactly at $250,000 (max on 2, 24, 35, 40, 44, 48; min on 13, 20) all fit", () => {
    const fits = lines(run(scenario("S1")).fits);
    for (const line of [2, 24, 35, 40, 44, 48, 13, 20]) expect(fits).toContain(line);
    expect(byLine.get(2)?.maxLoanCents).toBe(usd(250_000));
    expect(byLine.get(13)?.minLoanCents).toBe(usd(250_000));
  });

  it("S1: the list starts with Midwest Business Finance 504 Loan at 5.5%", () => {
    const first = run(scenario("S1")).fits[0].program;
    expect([first.lenderName, first.programType, first.rateMinBp]).toEqual([
      "Midwest Business Finance",
      "504 Loan",
      550,
    ]);
  });

  it("S3: First National Bank and Evergreen Community Advantage are Close, $10,000 over their $250,000 max", () => {
    const r = run(scenario("S3"));
    for (const line of [2, 29]) {
      const e = r.close.find((x) => x.program.rowNumber === line);
      expect(e?.closeProblem).toBe("amount");
      expect(e?.rules.find((x) => x.rule === "amount")).toEqual({
        rule: "amount",
        outcome: "fail",
        direction: "over",
        gapCents: usd(10_000),
        limitCents: usd(250_000),
      });
    }
  });

  it("S3: the 14 credit near misses need Good and the borrower has Fair", () => {
    const r = run(scenario("S3"));
    const credit = r.close.filter((e) => e.closeProblem === "credit");
    expect(credit).toHaveLength(14);
    for (const e of credit) {
      expect(e.rules.find((x) => x.rule === "tier")).toEqual({
        rule: "tier",
        outcome: "fail",
        needed: "Good" satisfies CreditTier,
        has: "Fair" satisfies CreditTier,
      });
    }
  });

  it("S4: Liberty SBA Express (line 23) is Close on years only: needs 1, has 0", () => {
    const e = run(scenario("S4")).close.find((x) => x.program.rowNumber === 23);
    expect(e?.program.lenderName).toBe("Liberty SBA Lending");
    expect(e?.closeProblem).toBe("years");
    expect(e?.rules.filter((x) => x.outcome === "fail")).toEqual([
      { rule: "years", outcome: "fail", needed: 1, has: 0 },
    ]);
  });

  it("S5: Community Advantage on lines 14, 18 and 45 fit on everything but industry, and are never near misses", () => {
    const r = run(scenario("S5"));
    for (const line of [14, 18, 45]) {
      const e = r.noFit.find((x) => x.program.rowNumber === line);
      expect(e).toBeDefined();
      expect(e?.rules.find((x) => x.rule === "industry")?.outcome).toBe("fail");
    }
    expect(lines(r.close)).not.toContain(14);
    expect(lines(r.close)).not.toContain(18);
    expect(lines(r.close)).not.toContain(45);
  });

  it("S5: First National Bank (line 2) is Close, $50,000 over its max", () => {
    const e = run(scenario("S5")).close.find((x) => x.program.rowNumber === 2);
    expect(e?.closeProblem).toBe("amount");
    expect(e?.rules.find((x) => x.rule === "amount")).toMatchObject({
      direction: "over",
      gapCents: usd(50_000),
    });
  });

  it("S6: every Ask first row asks for the credit tier and nothing else", () => {
    const r = run(scenario("S6"));
    expect(r.askFirst).toHaveLength(17);
    for (const e of r.askFirst) {
      expect(e.rules.filter((x) => x.outcome === "unknown").map((x) => x.rule)).toEqual(["tier"]);
    }
  });

  it("S7: the 5 near misses of S2 become Doesn't fit once a 650 score is typed", () => {
    const r = run(scenario("S7"));
    for (const line of [20, 30, 37, 42, 50]) {
      expect(lines(r.noFit)).toContain(line);
    }
  });

  it("S8: a row failing on tier and score names both", () => {
    const e = run(scenario("S8")).close.find((x) => x.program.rowNumber === 22);
    expect(e?.program.lenderName).toBe("Midwest Business Finance");
    expect(e?.closeProblem).toBe("credit");
    expect(e?.rules.filter((x) => x.outcome === "fail")).toEqual([
      { rule: "tier", outcome: "fail", needed: "Good", has: "Fair" },
      { rule: "score", outcome: "fail", needed: 680, has: 650 },
    ]);
  });

  it("S8: typing a score does not change the list when credit is the only problem (same as with no score)", () => {
    const withScore = run(scenario("S8"));
    const withoutScore = matchPrograms(
      { ...scenario("S8").input, creditScore: null },
      catalog,
      TODAY,
    );
    expect(lines(withScore.fits)).toEqual(lines(withoutScore.fits));
    expect(lines(withScore.close)).toEqual(lines(withoutScore.close));
  });
});

describe("stale rows on the real catalog", () => {
  it("every row is stale on 2026-10-12", () => {
    const r = matchPrograms(SCENARIOS[0].input, catalog, TODAY);
    const all = [...r.fits, ...r.close, ...r.askFirst, ...r.noFit];
    expect(all).toHaveLength(49);
    expect(all.every((e) => e.stale)).toBe(true);
  });
});
