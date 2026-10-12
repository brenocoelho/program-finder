export type IsoDate = string; // "2026-01-16"

const US_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/** "1/16/2026" (month/day/year) to "2026-01-16". Null if it isn't a real calendar date. */
export function parseUsDateToIso(text: string): IsoDate | null {
  const match = US_DATE.exec(text.trim());
  if (match === null) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  // Day 0 of the next month is the last day of this one (UTC: no time zone shifts).
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) return null;
  const pad = (n: number, width: number) => String(n).padStart(width, "0");
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}
