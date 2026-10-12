import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  formatBp,
  formatCents,
  parseDollarsToCents,
  parsePercentToBp,
  parseRatioToBp,
  parseWholeNumber,
} from "./money";

const ok = (value: number) => ({ ok: true, value });
const bad = (reason: string) => ({ ok: false, reason });

describe("dollars to cents", () => {
  it("$250,000, 250,000 and 250000 are the same amount", () => {
    expect(parseDollarsToCents("$250,000")).toEqual(ok(25_000_000));
    expect(parseDollarsToCents("250,000")).toEqual(ok(25_000_000));
    expect(parseDollarsToCents("250000")).toEqual(ok(25_000_000));
    expect(parseDollarsToCents("$ 250000")).toEqual(ok(25_000_000));
  });

  it("250000.50 is rejected: whole dollars only", () => {
    expect(parseDollarsToCents("250000.50")).toEqual(bad("not_whole_number"));
  });

  it("250000.00 is the same amount as 250000", () => {
    expect(parseDollarsToCents("250000.00")).toEqual(ok(25_000_000));
  });

  it("a comma that is not a thousands separator is rejected, never read as 15", () => {
    expect(parseDollarsToCents("1,5")).toEqual(bad("not_a_number"));
    expect(parseDollarsToCents("12,34")).toEqual(bad("not_a_number"));
  });

  it("text that is not a number is rejected", () => {
    for (const text of ["abc", "1e5", "25 000", "$", "--5"]) {
      expect(parseDollarsToCents(text)).toEqual(bad("not_a_number"));
    }
  });

  it("a negative amount is reported as negative", () => {
    expect(parseDollarsToCents("-5")).toEqual(bad("negative"));
  });

  it("empty or blank text is reported as empty", () => {
    expect(parseDollarsToCents("")).toEqual(bad("empty"));
    expect(parseDollarsToCents("   ")).toEqual(bad("empty"));
  });

  it("an amount too big to hold exactly is rejected", () => {
    expect(parseDollarsToCents("99999999999999999999")).toEqual(bad("too_large"));
  });

  it("zero is a valid number here (the row rules decide if it is allowed)", () => {
    expect(parseDollarsToCents("0")).toEqual(ok(0));
  });

  it("property: whole dollars always become exactly 100 times as many cents", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000_000 }), (dollars) => {
        expect(parseDollarsToCents(String(dollars))).toEqual(ok(dollars * 100));
      }),
    );
  });
});

describe("dollars to cents: k/m shorthand (D26)", () => {
  it("10k is 10,000 dollars", () => {
    expect(parseDollarsToCents("10k")).toEqual(ok(1_000_000));
  });

  it("250k and 1.2m are read as shorthand dollars", () => {
    expect(parseDollarsToCents("250k")).toEqual(ok(25_000_000));
    expect(parseDollarsToCents("1.2m")).toEqual(ok(120_000_000));
  });

  it("the suffix is case-insensitive", () => {
    expect(parseDollarsToCents("250K")).toEqual(ok(25_000_000));
    expect(parseDollarsToCents("1.2M")).toEqual(ok(120_000_000));
  });

  it("shorthand combines with $ and thousands commas", () => {
    expect(parseDollarsToCents("$1,200k")).toEqual(ok(120_000_000));
    expect(parseDollarsToCents("$250k")).toEqual(ok(25_000_000));
  });

  it("a shorthand value that can't resolve to a whole cent is rejected", () => {
    expect(parseDollarsToCents("1.234567891m")).toEqual(bad("too_many_decimals"));
  });

  it("an unrecognized suffix is rejected, not read as a plain number", () => {
    expect(parseDollarsToCents("250x")).toEqual(bad("not_a_number"));
    expect(parseDollarsToCents("250kk")).toEqual(bad("not_a_number"));
  });

  it("a negative shorthand amount is reported as negative", () => {
    expect(parseDollarsToCents("-5k")).toEqual(bad("negative"));
  });
});

describe("percent to basis points", () => {
  it("13.6 is 1360 and 11 is 1100", () => {
    expect(parsePercentToBp("13.6")).toEqual(ok(1360));
    expect(parsePercentToBp("11")).toEqual(ok(1100));
    expect(parsePercentToBp("0.05")).toEqual(ok(5));
  });

  it("13.60 is the same as 13.6", () => {
    expect(parsePercentToBp("13.60")).toEqual(ok(1360));
  });

  it("three real decimals are rejected", () => {
    expect(parsePercentToBp("13.666")).toEqual(bad("too_many_decimals"));
  });

  it("a percent sign or a comma decimal is rejected", () => {
    expect(parsePercentToBp("13.6%")).toEqual(bad("not_a_number"));
    expect(parsePercentToBp("13,6")).toEqual(bad("not_a_number"));
  });

  it("a negative rate is reported as negative", () => {
    expect(parsePercentToBp("-0.5")).toEqual(bad("negative"));
  });

  it("property: two-decimal percents convert exactly, with no float drift", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), (bp) => {
        const text = `${Math.floor(bp / 100)}.${String(bp % 100).padStart(2, "0")}`;
        expect(parsePercentToBp(text)).toEqual(ok(bp));
      }),
    );
  });
});

describe("ratio to basis points", () => {
  it("0.45 is 4500, 0.5 is 5000 and 1 is 10000", () => {
    expect(parseRatioToBp("0.45")).toEqual(ok(4500));
    expect(parseRatioToBp("0.5")).toEqual(ok(5000));
    expect(parseRatioToBp("1")).toEqual(ok(10_000));
  });

  it("four decimals are accepted and five real decimals are rejected", () => {
    expect(parseRatioToBp("0.4567")).toEqual(ok(4567));
    expect(parseRatioToBp("0.45678")).toEqual(bad("too_many_decimals"));
  });
});

describe("whole numbers", () => {
  it("84 and 84.0 are 84", () => {
    expect(parseWholeNumber("84")).toEqual(ok(84));
    expect(parseWholeNumber("84.0")).toEqual(ok(84));
  });

  it("84.5 is rejected: whole numbers only", () => {
    expect(parseWholeNumber("84.5")).toEqual(bad("not_whole_number"));
  });

  it("a negative or non-numeric value is rejected", () => {
    expect(parseWholeNumber("-1")).toEqual(bad("negative"));
    expect(parseWholeNumber("two")).toEqual(bad("not_a_number"));
    expect(parseWholeNumber("")).toEqual(bad("empty"));
  });
});

describe("cents to dollars text", () => {
  it("whole dollars have no decimals and thousands separators", () => {
    expect(formatCents(25_000_000)).toBe("$250,000");
    expect(formatCents(1_000_000)).toBe("$10,000");
    expect(formatCents(100)).toBe("$1");
    expect(formatCents(0)).toBe("$0");
  });

  it("anything that is not whole dollars shows both decimals", () => {
    expect(formatCents(25_000_001)).toBe("$250,000.01");
    expect(formatCents(1)).toBe("$0.01");
    expect(formatCents(150)).toBe("$1.50");
  });

  it("an amount survives parse then format", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 5_000_000_000 }), (dollars) => {
        const text = formatCents(dollars * 100);
        expect(parseDollarsToCents(text)).toEqual({ ok: true, value: dollars * 100 });
      }),
    );
  });
});

describe("basis points to percent text", () => {
  it("1140 is 11.40% and 1100 is 11.00%: always two decimals", () => {
    expect(formatBp(1140)).toBe("11.40%");
    expect(formatBp(1100)).toBe("11.00%");
  });

  it("0 is 0.00%", () => {
    expect(formatBp(0)).toBe("0.00%");
  });

  it("a negative value keeps its sign", () => {
    expect(formatBp(-50)).toBe("-0.50%");
  });
});
