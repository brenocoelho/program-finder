import { ResultRow } from "~/components/result-row";
import type { Evaluation } from "~/matching/match";

/** One status group (D10): Fits, Close and Ask first show plainly; Doesn't fit is collapsed with its count. */
export function ResultGroup({
  label,
  evaluations,
  collapsed = false,
}: {
  label: "Fits" | "Close" | "Ask first" | "Doesn't fit";
  evaluations: Evaluation[];
  collapsed?: boolean;
}) {
  if (evaluations.length === 0) return null;

  const rows = (
    <ul className="space-y-3">
      {evaluations.map((evaluation) => (
        <ResultRow key={evaluation.program.key} evaluation={evaluation} />
      ))}
    </ul>
  );

  if (collapsed) {
    return (
      <details>
        <summary className="cursor-pointer text-lg font-semibold">
          {label} ({evaluations.length})
        </summary>
        <div className="mt-3">{rows}</div>
      </details>
    );
  }

  return (
    <section aria-label={`${label} (${evaluations.length})`}>
      <h2 className="text-lg font-semibold">
        {label} ({evaluations.length})
      </h2>
      <div className="mt-3">{rows}</div>
    </section>
  );
}
