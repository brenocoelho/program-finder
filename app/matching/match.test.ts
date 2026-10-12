import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { BorrowerInput } from "~/matching/borrower-input";
import { matchPrograms, type Evaluation, type MatchResult } from "~/matching/match";
import { freshnessOf } from "~/matching/rules";
import { RULES_VERSION } from "~/matching/rules-version";
import type { CreditTier, Program } from "~/programs/program";

// Rules: docs/SPEC.md section 4 and D1-D13. Every program here is built by
// `program()`, which passes every rule for the borrower built by `input()`;
// each test changes only the one field it is about.

const TODAY = "2026-10-12";
const usd = (dollars: number) => dollars * 100; // integer cents

let nextId = 1;
function program(overrides: Partial<Program> = {}): Program {
  const merged: Program = {
    id: nextId++,
    importId: 1,
    rowNumber: 2,
    key: "",
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
  return { ...merged, key: overrides.key ?? `${merged.lenderName}|${merged.programType}` };
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

/** The one evaluation for one program. */
function one(borrower: BorrowerInput, p: Program, today = TODAY): Evaluation {
  const r = matchPrograms(borrower, [p], today);
  const all = [...r.fits, ...r.close, ...r.askFirst, ...r.noFit];
  expect(all).toHaveLength(1);
  return all[0];
}

const ruleOf = (e: Evaluation, name: string) => e.rules.find((r) => r.rule === name);
const unknownRules = (e: Evaluation) =>
  e.rules.filter((r) => r.outcome === "unknown").map((r) => r.rule).sort();
const keys = (list: Evaluation[]) => list.map((e) => e.program.key);

describe("amount: min and max are both inclusive (D3)", () => {
  const p = program({ minLoanCents: usd(10_000), maxLoanCents: usd(250_000) });

  it("an amount exactly at the minimum is accepted", () => {
    const e = one(input({ amountCents: p.minLoanCents }), p);
    expect(ruleOf(e, "amount")).toEqual({ rule: "amount", outcome: "pass" });
  });

  it("an amount exactly at the maximum is accepted", () => {
    const e = one(input({ amountCents: p.maxLoanCents }), p);
    expect(ruleOf(e, "amount")).toEqual({ rule: "amount", outcome: "pass" });
  });

  it("one cent under the minimum fails by one cent", () => {
    const e = one(input({ amountCents: p.minLoanCents - 1 }), p);
    expect(ruleOf(e, "amount")).toEqual({
      rule: "amount",
      outcome: "fail",
      direction: "under",
      gapCents: 1,
      limitCents: p.minLoanCents,
    });
  });

  it("one cent over the maximum fails by one cent", () => {
    const e = one(input({ amountCents: p.maxLoanCents + 1 }), p);
    expect(ruleOf(e, "amount")).toEqual({
      rule: "amount",
      outcome: "fail",
      direction: "over",
      gapCents: 1,
      limitCents: p.maxLoanCents,
    });
  });

  it("a program whose min equals its max accepts exactly that amount and nothing else", () => {
    const fixed = program({ minLoanCents: usd(50_000), maxLoanCents: usd(50_000) });
    expect(one(input({ amountCents: usd(50_000) }), fixed).status).toBe("fits");
    expect(one(input({ amountCents: usd(50_000) - 1 }), fixed).status).toBe("close");
    expect(one(input({ amountCents: usd(50_000) + 1 }), fixed).status).toBe("close");
  });
});

describe("business type: All accepts any type, a listed industry accepts only itself (D5)", () => {
  it("a program for All accepts every business type", () => {
    const p = program({ eligibleBusinessType: "All" });
    for (const businessType of ["Construction", "Healthcare", "Other"]) {
      const e = one(input({ businessType }), p);
      expect(ruleOf(e, "industry")).toEqual({ rule: "industry", outcome: "pass" });
    }
  });

  it("a program for one industry accepts that industry", () => {
    const p = program({ eligibleBusinessType: "Manufacturing" });
    const e = one(input({ businessType: "Manufacturing" }), p);
    expect(ruleOf(e, "industry")).toEqual({ rule: "industry", outcome: "pass" });
  });

  it("a program for one industry fails every other industry and names the one it needs", () => {
    const p = program({ eligibleBusinessType: "Manufacturing" });
    const e = one(input({ businessType: "Retail" }), p);
    expect(ruleOf(e, "industry")).toEqual({
      rule: "industry",
      outcome: "fail",
      required: "Manufacturing",
    });
  });

  it("Other passes only programs for All", () => {
    const forAll = program({ eligibleBusinessType: "All" });
    const forOne = program({ eligibleBusinessType: "Healthcare" });
    expect(one(input({ businessType: "Other" }), forAll).status).toBe("fits");
    expect(one(input({ businessType: "Other" }), forOne).status).toBe("no_fit");
  });
});

describe("years in business: whole years, at least the program's minimum (D2)", () => {
  const p = program({ minYearsInBusiness: 2 });

  it("exactly the minimum years passes", () => {
    const e = one(input({ yearsInBusiness: 2 }), p);
    expect(ruleOf(e, "years")).toEqual({ rule: "years", outcome: "pass" });
  });

  it("one year under the minimum fails and says how many are needed", () => {
    const e = one(input({ yearsInBusiness: 1 }), p);
    expect(ruleOf(e, "years")).toEqual({ rule: "years", outcome: "fail", needed: 2, has: 1 });
  });

  it("zero years fails a program that needs one", () => {
    const e = one(input({ yearsInBusiness: 0 }), program({ minYearsInBusiness: 1 }));
    expect(ruleOf(e, "years")).toEqual({ rule: "years", outcome: "fail", needed: 1, has: 0 });
  });

  it("missing years is unknown, never a pass", () => {
    const e = one(input({ yearsInBusiness: null }), p);
    expect(ruleOf(e, "years")).toEqual({ rule: "years", outcome: "unknown" });
  });
});

describe("credit tier: Excellent > Good > Fair (D1)", () => {
  it.each<[CreditTier, CreditTier]>([
    ["Excellent", "Excellent"],
    ["Excellent", "Good"],
    ["Excellent", "Fair"],
    ["Good", "Good"],
    ["Good", "Fair"],
    ["Fair", "Fair"],
  ])("a %s borrower passes a program that needs %s", (has, needed) => {
    const e = one(input({ creditTier: has }), program({ creditTierRequired: needed }));
    expect(ruleOf(e, "tier")).toEqual({ rule: "tier", outcome: "pass" });
  });

  it.each<[CreditTier, CreditTier]>([
    ["Fair", "Good"],
    ["Fair", "Excellent"],
    ["Good", "Excellent"],
  ])("a %s borrower fails a program that needs %s", (has, needed) => {
    const e = one(input({ creditTier: has }), program({ creditTierRequired: needed }));
    expect(ruleOf(e, "tier")).toEqual({ rule: "tier", outcome: "fail", needed, has });
  });

  it("a missing tier is unknown, never a pass, even for a program that needs only Fair", () => {
    const e = one(input({ creditTier: null }), program({ creditTierRequired: "Fair" }));
    expect(ruleOf(e, "tier")).toEqual({ rule: "tier", outcome: "unknown" });
  });
});

describe("credit score: only checked when the rep types one (D1)", () => {
  const p = program({ minCreditScore: 680 });

  it("with no score typed the score rule is not run: it is not in the rules and is not unknown", () => {
    const e = one(input({ creditScore: null }), p);
    expect(ruleOf(e, "score")).toBeUndefined();
    expect(e.status).toBe("fits");
  });

  it("exactly the minimum score passes", () => {
    const e = one(input({ creditScore: 680 }), p);
    expect(ruleOf(e, "score")).toEqual({ rule: "score", outcome: "pass" });
  });

  it("one point under the minimum score fails and says what is needed", () => {
    const e = one(input({ creditScore: 679 }), p);
    expect(ruleOf(e, "score")).toEqual({ rule: "score", outcome: "fail", needed: 680, has: 679 });
  });

  it("a typed score is checked even when the tier is unknown", () => {
    const e = one(input({ creditScore: 600, creditTier: null }), p);
    expect(ruleOf(e, "score")).toMatchObject({ outcome: "fail" });
  });
});

describe("a program with no requirement on a rule passes that rule", () => {
  // Needs a SPEC line and a DECISIONS entry: see the note with these tests.
  const noMinimum = program({ minYearsInBusiness: 0 });

  it("no minimum years: a borrower with 0 years passes", () => {
    const e = one(input({ yearsInBusiness: 0 }), noMinimum);
    expect(ruleOf(e, "years")).toEqual({ rule: "years", outcome: "pass" });
  });

  it("no minimum years: years not given is a pass, not unknown", () => {
    const e = one(input({ yearsInBusiness: null }), noMinimum);
    expect(ruleOf(e, "years")).toEqual({ rule: "years", outcome: "pass" });
    expect(e.status).toBe("fits");
  });

  it("no industry requirement (All): the business type is never what blocks a program", () => {
    const e = one(input({ businessType: "Other" }), program({ eligibleBusinessType: "All" }));
    expect(ruleOf(e, "industry")).toEqual({ rule: "industry", outcome: "pass" });
  });
});

describe("each check has plain words for the screen", () => {
  const checkOf = (e: Evaluation, name: string) => e.checks.find((c) => c.rule === name);

  it("there is one check per rule, in the same order and with the same outcome", () => {
    const e = one(input({ creditScore: 650, yearsInBusiness: null }), program());
    expect(e.checks.map((c) => [c.rule, c.outcome])).toEqual(
      e.rules.map((r) => [r.rule, r.outcome]),
    );
  });

  it("amount: the program's range and the borrower's amount", () => {
    const e = one(input({ amountCents: usd(300_000) }), program());
    expect(checkOf(e, "amount")).toEqual({
      rule: "amount",
      outcome: "fail",
      requirement: "Loan $10,000 to $250,000",
      borrower: "Borrower: $300,000",
    });
  });

  it("amount: cents are shown when the amount is not whole dollars", () => {
    const e = one(input({ amountCents: usd(250_000) + 1 }), program());
    expect(checkOf(e, "amount")?.borrower).toBe("Borrower: $250,000.01");
  });

  it("industry: a program for one industry says so, and a program for All says any", () => {
    const only = one(input({ businessType: "Retail" }), program({ eligibleBusinessType: "Manufacturing" }));
    expect(checkOf(only, "industry")).toEqual({
      rule: "industry",
      outcome: "fail",
      requirement: "Only for Manufacturing",
      borrower: "Borrower: Retail",
    });
    const all = one(input({ businessType: "Retail" }), program({ eligibleBusinessType: "All" }));
    expect(checkOf(all, "industry")).toEqual({
      rule: "industry",
      outcome: "pass",
      requirement: "Any business type",
      borrower: "Borrower: Retail",
    });
  });

  it("industry: Other on a program for All passes, and says the lender confirms the business type (D5)", () => {
    const e = one(input({ businessType: "Other" }), program({ eligibleBusinessType: "All" }));
    expect(e.status).toBe("fits");
    expect(checkOf(e, "industry")).toEqual({
      rule: "industry",
      outcome: "pass",
      requirement: "Lender confirms the business type",
      borrower: "Borrower: Other",
    });
  });

  it("years: the minimum and the borrower's whole years", () => {
    const e = one(input({ yearsInBusiness: 1 }), program({ minYearsInBusiness: 2 }));
    expect(checkOf(e, "years")).toEqual({
      rule: "years",
      outcome: "fail",
      requirement: "Min 2 yrs in business",
      borrower: "Borrower: 1 yr",
    });
  });

  it("years: singular for 1, plural for 0 and for 2 or more", () => {
    expect(checkOf(one(input({ yearsInBusiness: 1 }), program({ minYearsInBusiness: 1 })), "years")).toMatchObject({
      requirement: "Min 1 yr in business",
      borrower: "Borrower: 1 yr",
    });
    expect(checkOf(one(input({ yearsInBusiness: 0 }), program({ minYearsInBusiness: 1 })), "years")?.borrower).toBe(
      "Borrower: 0 yrs",
    );
    expect(checkOf(one(input({ yearsInBusiness: 5 }), program({ minYearsInBusiness: 2 })), "years")?.borrower).toBe(
      "Borrower: 5 yrs",
    );
  });

  it("years: a missing answer reads 'not given'", () => {
    const e = one(input({ yearsInBusiness: null }), program({ minYearsInBusiness: 2 }));
    expect(checkOf(e, "years")).toEqual({
      rule: "years",
      outcome: "unknown",
      requirement: "Min 2 yrs in business",
      borrower: "Borrower: not given",
    });
  });

  it("years: a program with no minimum says so (D24)", () => {
    const e = one(input({ yearsInBusiness: null }), program({ minYearsInBusiness: 0 }));
    expect(checkOf(e, "years")).toEqual({
      rule: "years",
      outcome: "pass",
      requirement: "No minimum time in business",
      borrower: "Borrower: not given",
    });
  });

  it("tier: the lowest tier the program takes", () => {
    const need = (t: CreditTier) =>
      checkOf(one(input(), program({ creditTierRequired: t })), "tier")?.requirement;
    expect(need("Fair")).toBe("Fair credit or better");
    expect(need("Good")).toBe("Good credit or better");
    expect(need("Excellent")).toBe("Excellent credit");
  });

  it("tier: the borrower's tier, or 'not given'", () => {
    expect(checkOf(one(input({ creditTier: "Fair" }), program()), "tier")?.borrower).toBe("Borrower: Fair");
    expect(checkOf(one(input({ creditTier: null }), program()), "tier")?.borrower).toBe(
      "Borrower: not given",
    );
  });

  it("score: the program's minimum and the typed score", () => {
    const e = one(input({ creditScore: 650 }), program({ minCreditScore: 680 }));
    expect(checkOf(e, "score")).toEqual({
      rule: "score",
      outcome: "fail",
      requirement: "Min 680 score",
      borrower: "Borrower: 650",
    });
  });

  it("score: no check when no score is typed", () => {
    expect(checkOf(one(input({ creditScore: null }), program()), "score")).toBeUndefined();
  });
});

describe("rules reported on each evaluation", () => {
  it("amount, industry, years and tier are always reported, score only when typed", () => {
    const p = program();
    const names = (e: Evaluation) => e.rules.map((r) => r.rule).sort();
    expect(names(one(input({ creditScore: null }), p))).toEqual(["amount", "industry", "tier", "years"]);
    expect(names(one(input({ creditScore: 700 }), p))).toEqual([
      "amount",
      "industry",
      "score",
      "tier",
      "years",
    ]);
  });
});

describe("status: Fits / Close / Ask first / Doesn't fit (D4, D10, D12, D13)", () => {
  // Each case changes the borrower or the program from the all-pass baseline.
  type Case = {
    name: string;
    borrower?: Partial<BorrowerInput>;
    program?: Partial<Program>;
    status: Evaluation["status"];
    closeProblem: Evaluation["closeProblem"];
  };
  const OVER = { amountCents: usd(300_000) }; // program max is $250,000
  const FEWER_YEARS = { yearsInBusiness: 1 }; // program needs 2
  const LOW_TIER = { creditTier: "Fair" as const }; // program needs Good
  const LOW_SCORE = { creditScore: 650 }; // program needs 680
  const WRONG_INDUSTRY = { businessType: "Retail" };
  const ONLY_MANUFACTURING = { eligibleBusinessType: "Manufacturing" };

  const cases: Case[] = [
    { name: "every rule passes", status: "fits", closeProblem: null },
    {
      name: "every rule sits exactly at its limit",
      borrower: {
        amountCents: usd(250_000),
        yearsInBusiness: 2,
        creditTier: "Good",
        creditScore: 680,
      },
      status: "fits",
      closeProblem: null,
    },
    { name: "only the amount fails", borrower: OVER, status: "close", closeProblem: "amount" },
    { name: "only the years fail", borrower: FEWER_YEARS, status: "close", closeProblem: "years" },
    { name: "only the tier fails", borrower: LOW_TIER, status: "close", closeProblem: "credit" },
    {
      name: "only the typed score fails",
      borrower: LOW_SCORE,
      status: "close",
      closeProblem: "credit",
    },
    {
      name: "tier and score both fail: one credit problem (D13)",
      borrower: { ...LOW_TIER, ...LOW_SCORE },
      status: "close",
      closeProblem: "credit",
    },
    {
      name: "amount and years both fail: two problems",
      borrower: { ...OVER, ...FEWER_YEARS },
      status: "no_fit",
      closeProblem: null,
    },
    {
      name: "amount and tier both fail: two problems",
      borrower: { ...OVER, ...LOW_TIER },
      status: "no_fit",
      closeProblem: null,
    },
    {
      name: "years and tier both fail: two problems",
      borrower: { ...FEWER_YEARS, ...LOW_TIER },
      status: "no_fit",
      closeProblem: null,
    },
    {
      name: "amount and score both fail: two problems (D13 follow-up)",
      borrower: { ...OVER, ...LOW_SCORE },
      status: "no_fit",
      closeProblem: null,
    },
    {
      name: "tier is empty and nothing fails",
      borrower: { creditTier: null },
      status: "ask_first",
      closeProblem: null,
    },
    {
      name: "years are empty and nothing fails",
      borrower: { yearsInBusiness: null },
      status: "ask_first",
      closeProblem: null,
    },
    {
      name: "tier and years are both empty and nothing fails",
      borrower: { creditTier: null, yearsInBusiness: null },
      status: "ask_first",
      closeProblem: null,
    },
    {
      name: "one problem plus one unknown (D12)",
      borrower: { ...OVER, creditTier: null },
      status: "no_fit",
      closeProblem: null,
    },
    {
      name: "a typed score fails and the tier is empty: credit is already known to fail, so Close (D27)",
      borrower: { ...LOW_SCORE, creditTier: null },
      status: "close",
      closeProblem: "credit",
    },
    {
      name: "a typed score passes and the tier is empty: the tier is still unknown",
      borrower: { creditScore: 700, creditTier: null },
      status: "ask_first",
      closeProblem: null,
    },
    {
      name: "a typed score fails, the tier is empty and the amount fails: two problems (D27)",
      borrower: { ...LOW_SCORE, ...OVER, creditTier: null },
      status: "no_fit",
      closeProblem: null,
    },
    {
      name: "a typed score fails, the tier and years are empty: the years are still unknown (D27)",
      borrower: { ...LOW_SCORE, creditTier: null, yearsInBusiness: null },
      status: "no_fit",
      closeProblem: null,
    },
    {
      name: "a typed score fails and years are empty",
      borrower: { ...LOW_SCORE, yearsInBusiness: null },
      status: "no_fit",
      closeProblem: null,
    },
    {
      name: "only the industry fails: never Close (D4)",
      borrower: WRONG_INDUSTRY,
      program: ONLY_MANUFACTURING,
      status: "no_fit",
      closeProblem: null,
    },
    {
      name: "the industry fails and an unknown remains",
      borrower: { ...WRONG_INDUSTRY, creditTier: null },
      program: ONLY_MANUFACTURING,
      status: "no_fit",
      closeProblem: null,
    },
    {
      name: "Other against a program for one industry",
      borrower: { businessType: "Other" },
      program: ONLY_MANUFACTURING,
      status: "no_fit",
      closeProblem: null,
    },
  ];

  it.each(cases)("$name -> $status", (c) => {
    const e = one(input(c.borrower), program(c.program));
    expect(e.status).toBe(c.status);
    expect(e.closeProblem).toBe(c.closeProblem);
  });

  it("an Ask first row says which fields it needs (FR-6)", () => {
    expect(unknownRules(one(input({ creditTier: null }), program()))).toEqual(["tier"]);
    expect(unknownRules(one(input({ yearsInBusiness: null }), program()))).toEqual(["years"]);
    expect(
      unknownRules(one(input({ creditTier: null, yearsInBusiness: null }), program())),
    ).toEqual(["tier", "years"]);
  });

  it("each evaluation sits in the group that matches its status", () => {
    const r = matchPrograms(
      input({ yearsInBusiness: 1 }),
      [
        program({ lenderName: "A", minYearsInBusiness: 1 }), // fits
        program({ lenderName: "B", minYearsInBusiness: 2 }), // close
        program({ lenderName: "C", minYearsInBusiness: 1, creditTierRequired: "Excellent" }), // close (credit)
        program({ lenderName: "D", eligibleBusinessType: "Retail" }), // no fit
      ],
      TODAY,
    );
    expect(keys(r.fits)).toEqual(["A|7(a) Standard"]);
    expect(keys(r.close).sort()).toEqual(["B|7(a) Standard", "C|7(a) Standard"]);
    expect(keys(r.noFit)).toEqual(["D|7(a) Standard"]);
    expect(r.askFirst).toEqual([]);
    for (const [group, status] of [
      [r.fits, "fits"],
      [r.close, "close"],
      [r.askFirst, "ask_first"],
      [r.noFit, "no_fit"],
    ] as const) {
      for (const e of group) expect(e.status).toBe(status);
    }
  });
});

describe("near misses have no distance limit (D4)", () => {
  it.each([
    ["$1 over the max", { amountCents: usd(250_000) + usd(1) }, "amount"],
    ["$4,750,000 over the max", { amountCents: usd(5_000_000) }, "amount"],
    ["$9,999 under the min", { amountCents: usd(1) }, "amount"],
    ["1 year short", { yearsInBusiness: 1 }, "years"],
    ["3 years short", { yearsInBusiness: 0 }, "years"],
    ["one tier short", { creditTier: "Fair" }, "credit"],
  ] as const)("%s is still Close", (_label, borrower, problem) => {
    const p = program({ minYearsInBusiness: 3, creditTierRequired: "Good" });
    const base = { yearsInBusiness: 3 };
    const e = one(input({ ...base, ...borrower }), p);
    expect(e.status).toBe("close");
    expect(e.closeProblem).toBe(problem);
  });

  it("a score 380 points under the minimum is still Close", () => {
    const e = one(input({ creditScore: 300 }), program({ minCreditScore: 680 }));
    expect(e.status).toBe("close");
    expect(e.closeProblem).toBe("credit");
  });
});

describe("what the lender checks later never changes the status (D6)", () => {
  const baselines: [string, BorrowerInput, Partial<Program>][] = [
    ["Fits", input(), {}],
    ["Close", input({ amountCents: usd(300_000) }), {}],
    ["Ask first", input({ creditTier: null }), {}],
    ["Doesn't fit", input({ businessType: "Retail" }), { eligibleBusinessType: "Manufacturing" }],
  ];
  const variants: [string, Partial<Program>][] = [
    ["no debt ratio", { maxDebtRatioBp: null }],
    ["debt ratio 0%", { maxDebtRatioBp: 0 }],
    ["debt ratio 100%", { maxDebtRatioBp: 10_000 }],
    ["collateral Yes", { requiresCollateral: "Yes" }],
    ["collateral Varies", { requiresCollateral: "Varies" }],
    ["a special requirement", { specialRequirements: "No recent bankruptcies (7 years)" }],
    ["no SBA guarantee", { sbaGuaranteeBp: 0 }],
    ["a stale row", { lastUpdated: "2020-01-01" }],
  ];

  for (const [label, borrower, base] of baselines) {
    it.each(variants)(`a ${label} row keeps its status with %s`, (_name, change) => {
      const before = one(borrower, program(base));
      const after = one(borrower, program({ ...base, ...change }));
      expect(after.status).toBe(before.status);
      expect(after.closeProblem).toBe(before.closeProblem);
      expect(after.rules).toEqual(before.rules);
    });
  }

  it("the debt ratio, collateral and special requirements are never a rule", () => {
    const e = one(input({ creditScore: 700 }), program());
    for (const r of e.rules) {
      expect(["amount", "industry", "years", "tier", "score"]).toContain(r.rule);
    }
  });

  it("property: any debt ratio, collateral, special requirement or guarantee gives the same status", () => {
    fc.assert(
      fc.property(inputArb, programArb, lenderChecksArb, (borrower, p, other) => {
        const before = one(borrower, p);
        const after = one(borrower, { ...p, ...other });
        expect(after.status).toBe(before.status);
        expect(after.closeProblem).toBe(before.closeProblem);
        expect(after.rules).toEqual(before.rules);
      }),
    );
  });
});

describe("stale rows: more than 31 days old (D8, FR-9)", () => {
  it.each([
    ["the same day", "2026-10-12", "2026-10-12", false],
    ["exactly 31 days old", "2026-10-12", "2026-09-11", false],
    ["32 days old", "2026-10-12", "2026-09-10", true],
    ["31 days across a February", "2026-03-01", "2026-01-29", false],
    ["32 days across a February", "2026-03-01", "2026-01-28", true],
    ["31 days across a leap February", "2028-03-01", "2028-01-30", false],
    ["32 days across a leap February", "2028-03-01", "2028-01-29", true],
    ["31 days across new year", "2027-01-01", "2026-12-01", false],
    ["32 days across new year", "2027-01-01", "2026-11-30", true],
    ["a date after today", "2026-10-12", "2026-10-13", false],
  ])("%s", (_label, today, lastUpdated, stale) => {
    expect(one(input(), program({ lastUpdated }), today).stale).toBe(stale);
  });

  it("a stale row keeps its status: only the warning changes", () => {
    const fresh = one(input(), program({ lastUpdated: "2026-10-12" }));
    const old = one(input(), program({ lastUpdated: "2020-01-01" }));
    expect(old.stale).toBe(true);
    expect(fresh.stale).toBe(false);
    expect(old.status).toBe("fits");
  });
});

describe("how old the live rates are, for the banner (D8)", () => {
  const dated = (lastUpdated: string, lenderName: string) => program({ lastUpdated, lenderName });

  it("gives the oldest and newest rate dates and how many rows are over 31 days old", () => {
    const programs = [
      dated("2026-09-11", "A"), // exactly 31 days: not stale
      dated("2026-01-01", "B"),
      dated("2026-09-10", "C"), // 32 days: stale
      dated("2026-10-12", "D"),
    ];
    expect(freshnessOf(programs, TODAY)).toEqual({
      oldest: "2026-01-01",
      newest: "2026-10-12",
      staleCount: 2,
      total: 4,
    });
  });

  it("an import date of today says nothing about the rates: every row can still be stale", () => {
    expect(freshnessOf([dated("2026-01-16", "A"), dated("2026-02-08", "B")], TODAY)).toMatchObject({
      staleCount: 2,
      total: 2,
    });
  });

  it("an empty catalog has no rate dates", () => {
    expect(freshnessOf([], TODAY)).toBeNull();
  });
});

describe("ranking inside each group: starting rate, turnaround, lender, program (D7, FR-7)", () => {
  function p(lender: string, type: string, rateMinBp: number, turnaroundDays: number) {
    return program({
      lenderName: lender,
      programType: type,
      rateMinBp,
      rateMaxBp: rateMinBp + 200,
      turnaroundDays,
    });
  }
  const order = (programs: Program[], borrower = input()) =>
    keys(matchPrograms(borrower, programs, TODAY).fits);

  it("a lower starting rate comes first", () => {
    expect(order([p("B", "X", 900, 5), p("A", "X", 800, 50)])).toEqual(["A|X", "B|X"]);
  });

  it("rates compare as numbers: 5.5% comes before 10.1%", () => {
    expect(order([p("A", "X", 1010, 5), p("B", "X", 550, 5)])).toEqual(["B|X", "A|X"]);
  });

  it("the starting rate decides, not the top of the range", () => {
    const lowStartHighEnd = program({
      lenderName: "A",
      programType: "X",
      rateMinBp: 900,
      rateMaxBp: 1800,
    });
    const highStartLowEnd = program({
      lenderName: "B",
      programType: "X",
      rateMinBp: 1000,
      rateMaxBp: 1100,
    });
    expect(order([highStartLowEnd, lowStartHighEnd])).toEqual(["A|X", "B|X"]);
  });

  it("equal rates: faster turnaround first", () => {
    expect(order([p("A", "X", 900, 30), p("B", "X", 900, 7)])).toEqual(["B|X", "A|X"]);
  });

  it("turnaround compares as a number: 9 days before 10 days", () => {
    expect(order([p("A", "X", 900, 10), p("B", "X", 900, 9)])).toEqual(["B|X", "A|X"]);
  });

  it("equal rate and turnaround: lender name by code point, not by locale", () => {
    // Code point: "Zeta" (Z = U+005A) is before "alpha" (a = U+0061).
    // A locale sort would put "alpha" first.
    expect(order([p("alpha", "X", 900, 10), p("Zeta", "X", 900, 10)])).toEqual(["Zeta|X", "alpha|X"]);
  });

  it("equal rate, turnaround and lender: program type by code point", () => {
    expect(order([p("A", "SBA Express", 900, 10), p("A", "504 Loan", 900, 10)])).toEqual([
      "A|504 Loan",
      "A|SBA Express",
    ]);
  });

  it("each group is ordered on its own, and a row never moves to another group's order", () => {
    const borrower = input({ yearsInBusiness: 1 });
    const programs = [
      program({ lenderName: "F2", programType: "X", minYearsInBusiness: 1, rateMinBp: 900 }),
      program({ lenderName: "C2", programType: "X", minYearsInBusiness: 2, rateMinBp: 700 }),
      program({ lenderName: "N2", programType: "X", eligibleBusinessType: "Retail", rateMinBp: 550 }),
      program({ lenderName: "F1", programType: "X", minYearsInBusiness: 1, rateMinBp: 800 }),
      program({ lenderName: "C1", programType: "X", minYearsInBusiness: 2, rateMinBp: 600 }),
      program({ lenderName: "N1", programType: "X", eligibleBusinessType: "Retail", rateMinBp: 500 }),
    ];
    const r = matchPrograms(borrower, programs, TODAY);
    expect(keys(r.fits)).toEqual(["F1|X", "F2|X"]);
    expect(keys(r.close)).toEqual(["C1|X", "C2|X"]);
    expect(keys(r.noFit)).toEqual(["N1|X", "N2|X"]);
  });

  it("the order does not depend on the order the programs arrive in", () => {
    const programs = [
      p("Coastal", "SBA Express", 1010, 14),
      p("Atlas", "504 Loan", 550, 82),
      p("Zeta", "SBA Express", 1010, 14),
      p("alpha", "504 Loan", 1010, 14),
      p("Atlas", "SBA Express", 1010, 5),
      p("Midwest", "504 Loan", 550, 82),
    ];
    const expected = order(programs);
    expect(expected).toEqual([
      "Atlas|504 Loan",
      "Midwest|504 Loan",
      "Atlas|SBA Express",
      "Coastal|SBA Express",
      "Zeta|SBA Express",
      "alpha|504 Loan",
    ]);
    expect(order([...programs].reverse())).toEqual(expected);
    expect(order([programs[3], programs[0], programs[5], programs[2], programs[4], programs[1]])).toEqual(expected);
  });

  it("matching does not reorder or change the programs it is given", () => {
    const programs = Object.freeze(
      [p("B", "X", 900, 5), p("A", "X", 800, 5)].map((x) => Object.freeze(x)),
    );
    const before = programs.map((x) => x.key);
    expect(() => matchPrograms(input(), programs as Program[], TODAY)).not.toThrow();
    expect(programs.map((x) => x.key)).toEqual(before);
  });
});

describe("the result", () => {
  it("carries the rules version", () => {
    expect(matchPrograms(input(), [program()], TODAY).rulesVersion).toBe(RULES_VERSION);
  });

  it("knows nothing about imports (D25)", () => {
    expect(matchPrograms(input(), [program({ importId: 7 })], TODAY)).not.toHaveProperty("importId");
  });

  it("matching nothing gives four empty groups", () => {
    const r: MatchResult = matchPrograms(input(), [], TODAY);
    expect([r.fits, r.close, r.askFirst, r.noFit]).toEqual([[], [], [], []]);
  });
});

// --- Properties (fast-check) -------------------------------------------------

const TYPES = [
  "Construction",
  "Healthcare",
  "Manufacturing",
  "Restaurant/Food Service",
  "Retail",
  "Professional Services",
] as const;
const TIERS: CreditTier[] = ["Fair", "Good", "Excellent"];

const lenderChecksArb = fc.record({
  maxDebtRatioBp: fc.option(fc.integer({ min: 0, max: 10_000 }), { nil: null }),
  requiresCollateral: fc.constantFrom<Program["requiresCollateral"]>("Yes", "No", "Varies"),
  specialRequirements: fc.option(fc.string({ maxLength: 40 }), { nil: null }),
  sbaGuaranteeBp: fc.integer({ min: 0, max: 10_000 }),
  lastUpdated: fc.constantFrom("2026-10-12", "2026-09-11", "2026-09-10", "2026-01-01"),
});

// Small value pools, so ties on rate and turnaround are common and the
// tie-breakers (lender, program) get exercised.
const programArb: fc.Arbitrary<Program> = fc
  .record({
    lenderName: fc.constantFrom("Atlas", "Coastal Capital", "alpha", "Zeta", "Summit"),
    programType: fc.constantFrom(
      "504 Loan",
      "7(a) Small Loan",
      "7(a) Standard",
      "Community Advantage",
      "SBA Express",
    ),
    minDollars: fc.integer({ min: 1, max: 300_000 }),
    spanDollars: fc.integer({ min: 0, max: 5_000_000 }),
    minCreditScore: fc.integer({ min: 600, max: 700 }),
    creditTierRequired: fc.constantFrom(...TIERS),
    minYearsInBusiness: fc.integer({ min: 0, max: 4 }),
    rateMinBp: fc.constantFrom(550, 600, 640, 1000, 1010, 1100),
    turnaroundDays: fc.constantFrom(5, 10, 20, 82),
    eligibleBusinessType: fc.constantFrom("All", "All", "All", ...TYPES),
    checks: lenderChecksArb,
  })
  .map(({ checks, minDollars, spanDollars, ...r }) =>
    program({
      ...r,
      ...checks,
      minLoanCents: usd(minDollars),
      maxLoanCents: usd(minDollars + spanDollars),
      rateMaxBp: r.rateMinBp + 200,
    }),
  );

const inputArb: fc.Arbitrary<BorrowerInput> = fc.record({
  amountCents: fc.integer({ min: 1, max: 600_000 }).map(usd),
  businessType: fc.constantFrom<string>(...TYPES, "Other"),
  creditTier: fc.option(fc.constantFrom(...TIERS), { nil: null }),
  yearsInBusiness: fc.option(fc.integer({ min: 0, max: 6 }), { nil: null }),
  creditScore: fc.option(fc.integer({ min: 300, max: 850 }), { nil: null }),
});

const catalogArb = fc.uniqueArray(programArb, {
  selector: (p) => p.key,
  maxLength: 15,
});

describe("properties", () => {
  it("better credit or more years never removes a fit", () => {
    const better = fc.record({
      tierSteps: fc.integer({ min: 0, max: 2 }),
      moreYears: fc.integer({ min: 0, max: 10 }),
      moreScore: fc.integer({ min: 0, max: 300 }),
    });
    let fitsSeen = 0;
    fc.assert(
      fc.property(inputArb, programArb, better, (borrower, p, d) => {
        // Only fields the rep already gave can improve. Adding a field that was
        // empty is new information, not "better".
        const improved: BorrowerInput = {
          ...borrower,
          creditTier:
            borrower.creditTier === null
              ? null
              : TIERS[Math.min(TIERS.indexOf(borrower.creditTier) + d.tierSteps, 2)],
          yearsInBusiness:
            borrower.yearsInBusiness === null ? null : borrower.yearsInBusiness + d.moreYears,
          creditScore:
            borrower.creditScore === null ? null : Math.min(850, borrower.creditScore + d.moreScore),
        };
        if (one(borrower, p).status === "fits") {
          fitsSeen++;
          expect(one(improved, p).status).toBe("fits");
        }
      }),
      { numRuns: 2000 },
    );
    expect(fitsSeen).toBeGreaterThan(10); // the property was not vacuous
  });

  it("the same input always gives the same groups in the same order, whatever order the programs arrive in", () => {
    fc.assert(
      fc.property(
        inputArb,
        catalogArb.chain((programs) =>
          fc.tuple(
            fc.constant(programs),
            fc.shuffledSubarray(programs, {
              minLength: programs.length,
              maxLength: programs.length,
            }),
          ),
        ),
        (borrower, [programs, shuffled]) => {
          const result = matchPrograms(borrower, programs, TODAY);
          expect(matchPrograms(borrower, shuffled, TODAY)).toEqual(result);
          expect(matchPrograms(borrower, programs, TODAY)).toEqual(result);
        },
      ),
    );
  });

  it("every program lands in exactly one group", () => {
    fc.assert(
      fc.property(inputArb, catalogArb, (borrower, programs) => {
        const r = matchPrograms(borrower, programs, TODAY);
        const placed = [...r.fits, ...r.close, ...r.askFirst, ...r.noFit];
        expect(placed.map((e) => e.program.key).sort()).toEqual(
          programs.map((x) => x.key).sort(),
        );
      }),
    );
  });

  it("every group is ordered by rate, then turnaround, then lender, then program", () => {
    const sorted = (e: Evaluation[]) =>
      e.every((cur, i) => {
        if (i === 0) return true;
        const a = e[i - 1].program;
        const b = cur.program;
        const cmp = (x: string | number, y: string | number) => (x < y ? -1 : x > y ? 1 : 0);
        return (
          (cmp(a.rateMinBp, b.rateMinBp) ||
            cmp(a.turnaroundDays, b.turnaroundDays) ||
            cmp(a.lenderName, b.lenderName) ||
            cmp(a.programType, b.programType)) <= 0
        );
      });
    fc.assert(
      fc.property(inputArb, catalogArb, (borrower, programs) => {
        const r = matchPrograms(borrower, programs, TODAY);
        for (const group of [r.fits, r.close, r.askFirst, r.noFit]) expect(sorted(group)).toBe(true);
      }),
    );
  });

  it("with no tier and known years, typing a score never moves a row out of Ask first into Doesn't fit (D27)", () => {
    let askFirstSeen = 0;
    fc.assert(
      fc.property(
        inputArb.map((i) => ({ ...i, creditTier: null, creditScore: null, yearsInBusiness: i.yearsInBusiness ?? 2 })),
        programArb,
        fc.integer({ min: 300, max: 850 }),
        (borrower, p, score) => {
          if (one(borrower, p).status === "ask_first") {
            askFirstSeen++;
            expect(one({ ...borrower, creditScore: score }, p).status).not.toBe("no_fit");
          }
        },
      ),
      { numRuns: 2000 },
    );
    expect(askFirstSeen).toBeGreaterThan(10); // the property was not vacuous
  });

  it("when credit is a row's only problem, typing any score keeps it Close", () => {
    let closeSeen = 0;
    fc.assert(
      fc.property(
        inputArb.map((i) => ({ ...i, creditScore: null })),
        programArb,
        fc.integer({ min: 300, max: 850 }),
        (borrower, p, score) => {
          const before = one(borrower, p);
          if (before.status === "close" && before.closeProblem === "credit") {
            closeSeen++;
            const after = one({ ...borrower, creditScore: score }, p);
            expect(after.status).toBe("close");
            expect(after.closeProblem).toBe("credit");
          }
        },
      ),
      { numRuns: 2000 },
    );
    expect(closeSeen).toBeGreaterThan(10); // the property was not vacuous
  });
});
