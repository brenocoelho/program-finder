import { describe, expect, it } from "vitest";
import { parseUsDateToIso } from "./date";

describe("US date to ISO date", () => {
  it("1/16/2026 is 2026-01-16", () => {
    expect(parseUsDateToIso("1/16/2026")).toBe("2026-01-16");
    expect(parseUsDateToIso("01/06/2026")).toBe("2026-01-06");
  });

  it("the last day of a month is accepted and the day after is not", () => {
    expect(parseUsDateToIso("2/28/2026")).toBe("2026-02-28");
    expect(parseUsDateToIso("2/29/2026")).toBeNull();
    expect(parseUsDateToIso("2/29/2028")).toBe("2028-02-29");
    expect(parseUsDateToIso("4/31/2026")).toBeNull();
  });

  it("a month or day out of range is rejected, never swapped to day/month", () => {
    expect(parseUsDateToIso("13/1/2026")).toBeNull();
    expect(parseUsDateToIso("0/10/2026")).toBeNull();
    expect(parseUsDateToIso("1/0/2026")).toBeNull();
  });

  it("anything that is not M/D/YYYY is rejected", () => {
    for (const text of ["2026-01-16", "1/16/26", "Jan 16 2026", "", "1/16", "1/16/2026 10:00"]) {
      expect(parseUsDateToIso(text)).toBeNull();
    }
  });
});
