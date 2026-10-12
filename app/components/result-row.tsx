import { RuleChip } from "~/components/rule-chip";
import type { Evaluation } from "~/matching/match";
import type { RuleResult } from "~/matching/rules";
import { formatHumanDate } from "~/shared/date";
import { formatBp, formatCents } from "~/shared/money";

function amountFail(rules: RuleResult[]) {
  return rules.find((r) => r.rule === "amount" && r.outcome === "fail") as
    | (RuleResult & { rule: "amount"; outcome: "fail" })
    | undefined;
}

function yearsFail(rules: RuleResult[]) {
  return rules.find((r) => r.rule === "years" && r.outcome === "fail") as
    | (RuleResult & { rule: "years"; outcome: "fail" })
    | undefined;
}

function tierFail(rules: RuleResult[]) {
  return rules.find((r) => r.rule === "tier" && r.outcome === "fail") as
    | (RuleResult & { rule: "tier"; outcome: "fail" })
    | undefined;
}

function scoreFail(rules: RuleResult[]) {
  return rules.find((r) => r.rule === "score" && r.outcome === "fail") as
    | (RuleResult & { rule: "score"; outcome: "fail" })
    | undefined;
}

function amountText(fail: RuleResult & { rule: "amount"; outcome: "fail" }): string {
  const side = fail.direction === "over" ? "over this lender's max" : "under the min";
  return `${formatCents(fail.gapCents)} ${side} (${formatCents(fail.limitCents)})`;
}

function yearsText(fail: RuleResult & { rule: "years"; outcome: "fail" }): string {
  return `Needs ${fail.needed}+ years in business (borrower: ${fail.has})`;
}

/** Tier, score, or both, as one credit problem (D13). Null when credit doesn't fail. */
function creditText(rules: RuleResult[]): string | null {
  const tier = tierFail(rules);
  const score = scoreFail(rules);
  const tierText = tier !== undefined ? (tier.needed === "Excellent" ? "Excellent credit" : `${tier.needed} credit or better`) : null;
  if (tierText !== null && score !== undefined) {
    return `Needs ${tierText} and ${score.needed}+ score (borrower: ${score.has})`;
  }
  if (tierText !== null) return `Needs ${tierText}`;
  if (score !== undefined) return `Needs ${score.needed}+ score (borrower: ${score.has})`;
  return null;
}

/** FR-5: names the one problem and the gap. */
function closeMessage(evaluation: Evaluation): string {
  const { closeProblem, rules } = evaluation;
  if (closeProblem === "amount") return amountText(amountFail(rules)!);
  if (closeProblem === "years") return yearsText(yearsFail(rules)!);
  return creditText(rules)!;
}

const ASK_LABEL: Record<string, string> = { years: "years in business", tier: "credit tier" };

/** The empty fields to ask about. An empty tier next to a failed score can't change anything (D27). */
function askFields(evaluation: Evaluation): string[] {
  const scoreFailed = scoreFail(evaluation.rules) !== undefined;
  return evaluation.checks
    .filter((c) => c.outcome === "unknown" && !(c.rule === "tier" && scoreFailed))
    .map((c) => ASK_LABEL[c.rule] ?? c.rule);
}

/** FR-6: names the empty fields the rep should ask about. */
function askFirstMessage(evaluation: Evaluation): string {
  return `Ask: ${askFields(evaluation).join(", ")}`;
}

/** Why a row doesn't fit, in words: the colour of the chips is not enough. */
function noFitMessage(evaluation: Evaluation): string {
  const { rules } = evaluation;
  const industry = rules.find((r) => r.rule === "industry" && r.outcome === "fail") as
    | (RuleResult & { rule: "industry"; outcome: "fail" })
    | undefined;
  // The business type never changes, so it is the whole answer (D4).
  if (industry !== undefined) return `Doesn't fit: only for ${industry.required}`;

  const reasons: string[] = [];
  const amount = amountFail(rules);
  if (amount !== undefined) reasons.push(amountText(amount));
  const years = yearsFail(rules);
  if (years !== undefined) reasons.push(yearsText(years));
  const credit = creditText(rules);
  if (credit !== null) reasons.push(credit);
  const ask = askFields(evaluation);
  if (ask.length > 0) reasons.push(`Ask: ${ask.join(", ")}`);
  return `Doesn't fit: ${reasons.join(" · ")}`;
}

function lenderWillCheck(evaluation: Evaluation): string | null {
  const { program } = evaluation;
  const items: string[] = [];
  if (program.maxDebtRatioBp !== null) {
    items.push(`maximum debt ratio ${formatBp(program.maxDebtRatioBp)}`);
  }
  if (program.specialRequirements !== null) items.push(program.specialRequirements);
  return items.length > 0 ? `Lender will check: ${items.join("; ")}` : null;
}

/** One program's match, with the same fields in the same columns in every status group (FR-8). */
export function ResultRow({ evaluation }: { evaluation: Evaluation }) {
  const { program, status, checks } = evaluation;
  const lenderCheck = lenderWillCheck(evaluation);

  return (
    <li className="rounded border border-gray-200 p-4 dark:border-gray-700">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">
          {program.lenderName} · {program.programType}
        </h3>
        <span className="text-sm">
          {formatBp(program.rateMinBp)}–{formatBp(program.rateMaxBp)}
          {evaluation.stale && (
            <span className="ml-2 font-medium text-amber-700 dark:text-amber-400">
              Rates may be out of date (as of {formatHumanDate(program.lastUpdated)})
            </span>
          )}
        </span>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-gray-500 dark:text-gray-400">Max term</dt>
          <dd>{program.maxTermMonths} months</dd>
        </div>
        <div>
          <dt className="text-gray-500 dark:text-gray-400">Decision</dt>
          <dd>{program.turnaroundDays} days</dd>
        </div>
        <div>
          <dt className="text-gray-500 dark:text-gray-400">Collateral</dt>
          <dd>{program.requiresCollateral}</dd>
        </div>
        <div>
          <dt className="text-gray-500 dark:text-gray-400">Needs</dt>
          <dd>
            {formatCents(program.minLoanCents)}–{formatCents(program.maxLoanCents)}, {program.creditTierRequired},
            needs {program.minCreditScore}+, {program.minYearsInBusiness}+ yrs
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap gap-2">
        {checks.map((check) => (
          <RuleChip key={check.rule} check={check} />
        ))}
      </div>

      {status === "close" && <p className="mt-2 text-sm font-medium">{closeMessage(evaluation)}</p>}
      {status === "ask_first" && <p className="mt-2 text-sm font-medium">{askFirstMessage(evaluation)}</p>}
      {status === "no_fit" && <p className="mt-2 text-sm font-medium">{noFitMessage(evaluation)}</p>}

      {lenderCheck !== null && <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{lenderCheck}</p>}

      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Rates as of {formatHumanDate(program.lastUpdated)}
      </p>

      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-gray-600 dark:text-gray-400">Details</summary>
        <p>SBA guarantee: {formatBp(program.sbaGuaranteeBp)}</p>
      </details>
    </li>
  );
}
