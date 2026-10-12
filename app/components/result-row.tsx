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

/** FR-5: names the one problem and the gap. */
function closeMessage(evaluation: Evaluation): string {
  const { closeProblem, rules } = evaluation;
  if (closeProblem === "amount") {
    const fail = amountFail(rules)!;
    const side = fail.direction === "over" ? "over this lender's max" : "under the min";
    return `${formatCents(fail.gapCents)} ${side} (${formatCents(fail.limitCents)})`;
  }
  if (closeProblem === "years") {
    const fail = yearsFail(rules)!;
    return `Needs ${fail.needed}+ years in business (borrower: ${fail.has})`;
  }
  // credit: tier, score, or both (D13)
  const tier = tierFail(rules);
  const score = scoreFail(rules);
  const tierText = tier !== undefined ? (tier.needed === "Excellent" ? "Excellent credit" : `${tier.needed} credit or better`) : null;
  if (tierText !== null && score !== undefined) {
    return `Needs ${tierText} and ${score.needed}+ score (borrower: ${score.has})`;
  }
  if (tierText !== null) return `Needs ${tierText}`;
  return `Needs ${score!.needed}+ score (borrower: ${score!.has})`;
}

const ASK_LABEL: Record<string, string> = { years: "years in business", tier: "credit tier" };

/** FR-6: names the empty fields the rep should ask about. */
function askFirstMessage(evaluation: Evaluation): string {
  const fields = evaluation.checks
    .filter((c) => c.outcome === "unknown")
    .map((c) => ASK_LABEL[c.rule] ?? c.rule);
  return `Ask: ${fields.join(", ")}`;
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

      {lenderCheck !== null && <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{lenderCheck}</p>}

      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Rates as of {formatHumanDate(program.lastUpdated)}
        {evaluation.stale && (
          <span className="ml-2 font-medium text-amber-700 dark:text-amber-400">Rates may be out of date</span>
        )}
      </p>

      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-gray-600 dark:text-gray-400">Details</summary>
        <p>SBA guarantee: {formatBp(program.sbaGuaranteeBp)}</p>
      </details>
    </li>
  );
}
