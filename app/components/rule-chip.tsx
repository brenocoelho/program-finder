import type { RuleCheck } from "~/matching/rules";

const STYLES: Record<RuleCheck["outcome"], string> = {
  pass: "bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100",
  unknown: "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100",
  fail: "bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100",
};

// The outcome in words, so it never depends on colour alone (WCAG 1.4.1).
const OUTCOME_WORD: Record<RuleCheck["outcome"], string> = {
  pass: "Meets",
  unknown: "Ask",
  fail: "Doesn't meet",
};

/** One rule's result in plain words: the outcome, what the program asks, what the borrower has. */
export function RuleChip({ check }: { check: RuleCheck }) {
  return (
    <span className={`inline-flex flex-col rounded px-2 py-1 text-sm ${STYLES[check.outcome]}`}>
      <span>
        <span className="font-semibold">{OUTCOME_WORD[check.outcome]}:</span> {check.requirement}
      </span>
      <span className="text-xs opacity-80">{check.borrower}</span>
    </span>
  );
}
