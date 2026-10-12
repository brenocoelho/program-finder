import { describe, expect, it } from "vitest";
import { daysBetween, parseUsDateToIso } from "./date";

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

describe("days between two ISO dates", () => {
  it("the same day is 0 and the next day is 1", () => {
    expect(daysBetween("2026-10-12", "2026-10-12")).toBe(0);
    expect(daysBetween("2026-10-12", "2026-10-13")).toBe(1);
  });

  it("counts real calendar days across months, a leap February and a new year", () => {
    expect(daysBetween("2026-09-11", "2026-10-12")).toBe(31);
    expect(daysBetween("2026-01-29", "2026-03-01")).toBe(31);
    expect(daysBetween("2028-01-30", "2028-03-01")).toBe(31);
    expect(daysBetween("2026-12-01", "2027-01-01")).toBe(31);
  });

  it("is negative when the second date is earlier", () => {
    expect(daysBetween("2026-10-13", "2026-10-12")).toBe(-1);
  });
});
