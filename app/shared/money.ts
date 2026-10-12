// Text to integer money and percentages. String math only: no float ever holds
// a dollar amount or a rate (CLAUDE.md: integer cents, integer basis points).

export type Cents = number; // integer, Number.isSafeInteger
export type BasisPoints = number; // integer: 11.4% -> 1140, ratio 0.5 -> 5000

export type NumberProblem =
  | "empty"
  | "not_a_number"
  | "negative"
  | "not_whole_number"
  | "too_many_decimals"
  | "too_large";

export type NumberResult =
  | { ok: true; value: number }
  | { ok: false; reason: NumberProblem };

const PLAIN = /^(\d+)(?:\.(\d+))?$/;
// Commas only as thousands separators: "1,5" must never become 15.
const GROUPED = /^(\d{1,3}(?:,\d{3})+)(?:\.(\d+))?$/;

/**
 * Reads `text` as a non-negative decimal and returns it as an integer scaled
 * by 10^decimals (so 13.6 with decimals = 2 gives 1360).
 */
function scaled(text: string, decimals: number, dollars: boolean): NumberResult {
  let body = text.trim();
  if (body === "") return { ok: false, reason: "empty" };
  let negative = false;
  if (body.startsWith("-")) {
    negative = true;
    body = body.slice(1).trim();
  }
  if (dollars && body.startsWith("$")) body = body.slice(1).trim();

  const match = PLAIN.exec(body) ?? (dollars ? GROUPED.exec(body) : null);
  if (match === null) return { ok: false, reason: "not_a_number" };
  if (negative) return { ok: false, reason: "negative" };

  const whole = match[1].replaceAll(",", "");
  // 13.60 is the same number as 13.6: trailing zeros don't count as decimals.
  const fraction = (match[2] ?? "").replace(/0+$/, "");
  if (fraction.length > decimals) {
    return {
      ok: false,
      reason: decimals === 0 ? "not_whole_number" : "too_many_decimals",
    };
  }
  const value = Number(whole + fraction.padEnd(decimals, "0"));
  if (!Number.isSafeInteger(value)) return { ok: false, reason: "too_large" };
  return { ok: true, value };
}

/** "$250,000", "250,000" and "250000" are 25_000_000 cents. Whole dollars only. */
export function parseDollarsToCents(text: string): NumberResult {
  const dollars = scaled(text, 0, true);
  if (!dollars.ok) return dollars;
  const cents = dollars.value * 100;
  return Number.isSafeInteger(cents)
    ? { ok: true, value: cents }
    : { ok: false, reason: "too_large" };
}

/** "13.6" is 1360 basis points. Up to 2 decimals. */
export function parsePercentToBp(text: string): NumberResult {
  return scaled(text, 2, false);
}

/** "0.45" is 4500 basis points. Up to 4 decimals. */
export function parseRatioToBp(text: string): NumberResult {
  return scaled(text, 4, false);
}

/** "84" and "84.0" are 84. */
export function parseWholeNumber(text: string): NumberResult {
  return scaled(text, 0, false);
}
