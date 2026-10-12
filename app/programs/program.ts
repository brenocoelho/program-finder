import { z } from "zod";
import { parseUsDateToIso, type IsoDate } from "~/shared/date";
import {
  parseDollarsToCents,
  parsePercentToBp,
  parseRatioToBp,
  parseWholeNumber,
  type BasisPoints,
  type Cents,
  type NumberResult,
} from "~/shared/money";

export const CREDIT_TIERS = ["Fair", "Good", "Excellent"] as const;
export type CreditTier = (typeof CREDIT_TIERS)[number]; // rank Fair < Good < Excellent (D1)

export const COLLATERAL_VALUES = ["Yes", "No", "Varies"] as const;
export type Collateral = (typeof COLLATERAL_VALUES)[number];

// The codes saved in data_issues.code (docs/SPEC.md section 5, plus D23).
export const ISSUE_CODES = [
  "missing_value",
  "not_a_number",
  "not_whole_number",
  "negative",
  "too_many_decimals",
  "out_of_range",
  "min_over_max",
  "unknown_tier",
  "unknown_collateral",
  "bad_date",
  "duplicate_program",
  "malformed_csv",
  "missing_column",
  "empty_file",
] as const;
export type IssueCode = (typeof ISSUE_CODES)[number];

/** One thing wrong in an imported file. `rowNumber` is the CSV line (header = 1); null = the whole file. */
export type DataIssue = {
  rowNumber: number | null;
  column: string | null;
  value: string | null;
  code: IssueCode;
  message: string;
};

/** What one CSV row becomes. Money in integer cents, rates in integer basis points. */
export type NewProgram = {
  rowNumber: number;
  key: string; // `${lenderName}|${programType}` (D19)
  lenderName: string;
  programType: string;
  minLoanCents: Cents;
  maxLoanCents: Cents;
  minCreditScore: number;
  creditTierRequired: CreditTier;
  minYearsInBusiness: number; // whole years (D2)
  rateMinBp: BasisPoints;
  rateMaxBp: BasisPoints;
  maxTermMonths: number;
  sbaGuaranteeBp: BasisPoints;
  eligibleBusinessType: string; // "All" or one industry
  requiresCollateral: Collateral;
  maxDebtRatioBp: BasisPoints | null; // blank in the file = null
  turnaroundDays: number;
  specialRequirements: string | null;
  lastUpdated: IsoDate;
};

/** A program as saved: the live version of a row from one import. */
export type Program = NewProgram & { id: number; importId: number };

export type ImportStatus = "accepted" | "rejected";

/** One row of data_imports. `createdAt` is an ISO timestamp (UTC). */
export type ImportSummary = {
  id: number;
  sourceName: string;
  fileSha256: string;
  status: ImportStatus;
  rowCount: number;
  issueCount: number;
  rulesVersion: number;
  createdAt: string;
};

// --- One schema per CSV column -------------------------------------------
// A cell is text. Each schema turns it into a value, or adds one issue that
// carries our issue code in `params.issueCode`.

type Problem = { code: IssueCode; message: string };
type Read<T> = (text: string) => { value: T } | Problem;

const MISSING: Problem = { code: "missing_value", message: "Value is missing" };

function cell<T>(read: Read<T>) {
  return z.string().transform((raw, ctx): T => {
    const result = read(raw.trim());
    if ("code" in result) {
      ctx.issues.push({
        code: "custom",
        input: raw,
        message: result.message,
        params: { issueCode: result.code },
      });
      return z.NEVER;
    }
    return result.value;
  });
}

const text: Read<string> = (t) => (t === "" ? MISSING : { value: t });

const optionalText: Read<string | null> = (t) => ({ value: t === "" ? null : t });

type NumberOptions = {
  parse: (text: string) => NumberResult;
  /** What the column can hold, for "not whole number" / "too many decimals" messages. */
  holds: string;
  /** The value (in cents or basis points) must be more than 0. */
  positive?: boolean;
  /** The value (in cents or basis points) must be at most this much. */
  max?: { value: number; label: string };
};

function number(options: NumberOptions): Read<number> {
  return (t) => {
    if (t === "") return MISSING;
    const parsed = options.parse(t);
    if (!parsed.ok) {
      switch (parsed.reason) {
        case "empty":
          return MISSING;
        case "not_a_number":
          return { code: "not_a_number", message: "Must be a number" };
        case "negative":
          return { code: "negative", message: "Can't be negative" };
        case "not_whole_number":
          return { code: "not_whole_number", message: `Must be ${options.holds}` };
        case "too_many_decimals":
          return { code: "too_many_decimals", message: `Must be ${options.holds}` };
        case "too_large":
          return { code: "out_of_range", message: "Number is too large" };
      }
    }
    if (options.positive && parsed.value <= 0) {
      return { code: "out_of_range", message: "Must be more than 0" };
    }
    if (options.max && parsed.value > options.max.value) {
      return { code: "out_of_range", message: `Must be at most ${options.max.label}` };
    }
    return { value: parsed.value };
  };
}

function optional<T>(read: Read<T>): Read<T | null> {
  return (t) => (t === "" ? { value: null } : read(t));
}

function oneOf<T extends string>(
  values: readonly T[],
  code: "unknown_tier" | "unknown_collateral",
): Read<T> {
  return (t) => {
    if (t === "") return MISSING;
    const found = values.find((v) => v === t);
    return found !== undefined
      ? { value: found }
      : { code, message: `Must be ${values.join(", ")}` };
  };
}

const date: Read<IsoDate> = (t) => {
  if (t === "") return MISSING;
  const iso = parseUsDateToIso(t);
  return iso !== null
    ? { value: iso }
    : { code: "bad_date", message: "Must be a date like 1/16/2026" };
};

const dollars = number({ parse: parseDollarsToCents, holds: "whole dollars", positive: true });
const rate = number({ parse: parsePercentToBp, holds: "a percent with up to 2 decimals" });
const count = number({ parse: parseWholeNumber, holds: "a whole number" });

/** Header name -> schema. The order here is the order issues are reported in. */
const columnSchemas = {
  lender_name: cell(text),
  program_type: cell(text),
  min_loan_amount: cell(dollars),
  max_loan_amount: cell(dollars),
  min_credit_score: cell(number({ parse: parseWholeNumber, holds: "a whole number", positive: true })),
  credit_tier_required: cell(oneOf(CREDIT_TIERS, "unknown_tier")),
  min_years_in_business: cell(count),
  interest_rate_min: cell(rate),
  interest_rate_max: cell(rate),
  max_term_months: cell(number({ parse: parseWholeNumber, holds: "a whole number", positive: true })),
  sba_guarantee_pct: cell(
    number({
      parse: parsePercentToBp,
      holds: "a percent with up to 2 decimals",
      max: { value: 10_000, label: "100%" },
    }),
  ),
  eligible_business_types: cell(text),
  requires_collateral: cell(oneOf(COLLATERAL_VALUES, "unknown_collateral")),
  max_existing_debt_ratio: cell(
    optional(number({ parse: parseRatioToBp, holds: "a ratio with up to 4 decimals" })),
  ),
  turnaround_days: cell(count),
  special_requirements: cell(optionalText),
  last_updated: cell(date),
};

type ColumnName = keyof typeof columnSchemas;
type ColumnValues = { [K in ColumnName]: z.output<(typeof columnSchemas)[K]> };

export const PROGRAM_COLUMNS = Object.keys(columnSchemas) as ColumnName[];

const MAX_VALUE_LENGTH = 200; // data_issues.value keeps the first 200 chars

function clip(value: string): string {
  return value.length > MAX_VALUE_LENGTH ? value.slice(0, MAX_VALUE_LENGTH) : value;
}

function issueCodeOf(issue: z.core.$ZodIssue): IssueCode {
  const code = issue.code === "custom" ? issue.params?.issueCode : undefined;
  return ISSUE_CODES.find((c) => c === code) ?? "missing_value";
}

export type RowResult =
  | { ok: true; program: NewProgram }
  | { ok: false; issues: DataIssue[] };

/**
 * One CSV row (cells by header name) to a program, or every issue the row has.
 * Never throws. `cells` must hold a string for every column in PROGRAM_COLUMNS.
 */
export function readProgramRow(
  cells: Record<ColumnName, string>,
  rowNumber: number,
): RowResult {
  const issues: DataIssue[] = [];
  const values: Record<string, unknown> = {};

  for (const column of PROGRAM_COLUMNS) {
    const parsed = columnSchemas[column].safeParse(cells[column]);
    if (parsed.success) {
      values[column] = parsed.data;
      continue;
    }
    for (const issue of parsed.error.issues) {
      issues.push({
        rowNumber,
        column,
        value: clip(cells[column]),
        code: issueCodeOf(issue),
        message: issue.message,
      });
    }
  }

  // Pairs that must be in order. Only checkable when both columns were valid.
  const pairs = [
    ["min_loan_amount", "max_loan_amount"],
    ["interest_rate_min", "interest_rate_max"],
  ] as const;
  for (const [minColumn, maxColumn] of pairs) {
    const min = values[minColumn];
    const max = values[maxColumn];
    if (typeof min === "number" && typeof max === "number" && max < min) {
      issues.push({
        rowNumber,
        column: maxColumn,
        value: clip(cells[maxColumn]),
        code: "min_over_max",
        message: `Is below ${minColumn} (${cells[minColumn]})`,
      });
    }
  }

  if (issues.length > 0) return { ok: false, issues };

  // No issues: every column parsed, so `values` is complete.
  const v = values as ColumnValues;
  return {
    ok: true,
    program: {
      rowNumber,
      key: `${v.lender_name}|${v.program_type}`,
      lenderName: v.lender_name,
      programType: v.program_type,
      minLoanCents: v.min_loan_amount,
      maxLoanCents: v.max_loan_amount,
      minCreditScore: v.min_credit_score,
      creditTierRequired: v.credit_tier_required,
      minYearsInBusiness: v.min_years_in_business,
      rateMinBp: v.interest_rate_min,
      rateMaxBp: v.interest_rate_max,
      maxTermMonths: v.max_term_months,
      sbaGuaranteeBp: v.sba_guarantee_pct,
      eligibleBusinessType: v.eligible_business_types,
      requiresCollateral: v.requires_collateral,
      maxDebtRatioBp: v.max_existing_debt_ratio,
      turnaroundDays: v.turnaround_days,
      specialRequirements: v.special_requirements,
      lastUpdated: v.last_updated,
    },
  };
}
