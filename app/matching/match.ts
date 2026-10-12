import type { BorrowerInput } from "~/matching/borrower-input";
import { checkRules, isStale, type RuleCheck, type RuleName, type RuleResult } from "~/matching/rules";
import { RULES_VERSION } from "~/matching/rules-version";
import type { Program } from "~/programs/program";
import type { IsoDate } from "~/shared/date";

export type { RuleCheck, RuleName, RuleResult };

export type Status = "fits" | "close" | "ask_first" | "no_fit";
/** Tier and score failing both count as one "credit" problem (D4, D13). */
export type Problem = "amount" | "years" | "credit";

export type Evaluation = {
  program: Program;
  status: Status;
  rules: RuleResult[];
  checks: RuleCheck[]; // the same rules in plain words, same order
  stale: boolean;
  closeProblem: Problem | null; // set only when status is "close"
};

export type MatchResult = {
  rulesVersion: number;
  fits: Evaluation[];
  close: Evaluation[];
  askFirst: Evaluation[];
  noFit: Evaluation[];
};

/** Docs/SPEC.md section 4, first match wins. */
function statusOf(rules: RuleResult[]): { status: Status; closeProblem: Problem | null } {
  const failed = (name: RuleName) => rules.some((r) => r.rule === name && r.outcome === "fail");

  if (failed("industry")) return { status: "no_fit", closeProblem: null }; // never Close (D4)

  const problems: Problem[] = [];
  if (failed("amount")) problems.push("amount");
  if (failed("years")) problems.push("years");
  if (failed("tier") || failed("score")) problems.push("credit"); // one problem (D13)
  const hasUnknown = rules.some((r) => r.outcome === "unknown");

  if (problems.length === 0) {
    return { status: hasUnknown ? "ask_first" : "fits", closeProblem: null };
  }
  // Close needs every field known, so we never say "close" on a guess (D12).
  if (problems.length === 1 && !hasUnknown) return { status: "close", closeProblem: problems[0] };
  return { status: "no_fit", closeProblem: null };
}

/** By UTF-16 code unit would differ for characters above U+FFFF; this is by code point (FR-7). */
function compareCodePoints(a: string, b: string): number {
  const x = Array.from(a);
  const y = Array.from(b);
  const length = Math.min(x.length, y.length);
  for (let i = 0; i < length; i++) {
    const diff = x[i].codePointAt(0)! - y[i].codePointAt(0)!;
    if (diff !== 0) return diff;
  }
  return x.length - y.length;
}

/** Lowest starting rate, then fastest turnaround, then lender, then program type (D7). */
function byRank(a: Evaluation, b: Evaluation): number {
  const p = a.program;
  const q = b.program;
  return (
    p.rateMinBp - q.rateMinBp ||
    p.turnaroundDays - q.turnaroundDays ||
    compareCodePoints(p.lenderName, q.lenderName) ||
    compareCodePoints(p.programType, q.programType)
  );
}

/**
 * Pure: every program is checked against every rule and lands in exactly one
 * group. The same input and programs give the same groups in the same order,
 * whatever order the programs arrive in. Does not change `programs`.
 */
export function matchPrograms(
  input: BorrowerInput,
  programs: readonly Program[],
  today: IsoDate,
): MatchResult {
  const result: MatchResult = {
    rulesVersion: RULES_VERSION,
    fits: [],
    close: [],
    askFirst: [],
    noFit: [],
  };

  for (const program of programs) {
    const { rules, checks } = checkRules(input, program);
    const { status, closeProblem } = statusOf(rules);
    const evaluation: Evaluation = {
      program,
      status,
      rules,
      checks,
      stale: isStale(program.lastUpdated, today),
      closeProblem,
    };
    switch (status) {
      case "fits":
        result.fits.push(evaluation);
        break;
      case "close":
        result.close.push(evaluation);
        break;
      case "ask_first":
        result.askFirst.push(evaluation);
        break;
      case "no_fit":
        result.noFit.push(evaluation);
        break;
    }
  }

  for (const group of [result.fits, result.close, result.askFirst, result.noFit]) {
    group.sort(byRank);
  }
  return result;
}
