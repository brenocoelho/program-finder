import type { Route } from "./+types/data-health";
import { ImportHistory } from "~/components/import-history";
import { IssueTable } from "~/components/issue-table";
import { loadDataHealth } from "~/programs/data-health.server";
import { requestContext } from "~/shared/request-context.server";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Data health · Program Finder" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const ctx = context.get(requestContext);
  const start = performance.now();
  const health = await loadDataHealth();
  ctx.timings.db = performance.now() - start;
  return health;
}

/** "2026-10-12T13:49:25.000Z" -> "2026-10-12 13:49 UTC". Fixed format: same on server and browser. */
function formatWhen(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

export default function DataHealth({ loaderData }: Route.ComponentProps) {
  const { live, history, latestIssues } = loaderData;
  const latest = history[0];
  const latestRejected = latest !== undefined && latest.status === "rejected";

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6">
      <h1 className="text-2xl font-semibold">Data health</h1>

      <section aria-labelledby="live-heading" className="space-y-2">
        <h2 id="live-heading" className="text-lg font-semibold">
          Program data in use
        </h2>
        {live === null ? (
          <p>
            No program data loaded yet. Nothing can be matched until a file is
            imported (<code>npm run db:import</code>).
          </p>
        ) : (
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
            <dt className="font-medium">Imported</dt>
            <dd>{formatWhen(live.createdAt)}</dd>
            <dt className="font-medium">Programs</dt>
            <dd>{live.rowCount}</dd>
            <dt className="font-medium">File</dt>
            <dd>{live.sourceName}</dd>
            <dt className="font-medium">File hash</dt>
            <dd className="break-all font-mono text-sm">{live.fileSha256}</dd>
          </dl>
        )}
      </section>

      {latestRejected && (
        <section aria-labelledby="issues-heading" className="space-y-3">
          <h2 id="issues-heading" className="text-lg font-semibold">
            Last import was rejected
          </h2>
          <p role="status">
            {latest.sourceName} has {latest.issueCount}{" "}
            {latest.issueCount === 1 ? "problem" : "problems"}, so none of it was
            used.{" "}
            {live === null
              ? "There is no program data in use."
              : "The previous data is still in use."}{" "}
            Fix the file and import it again.
          </p>
          <IssueTable issues={latestIssues} />
        </section>
      )}

      <section aria-labelledby="history-heading" className="space-y-2">
        <h2 id="history-heading" className="text-lg font-semibold">
          Last imports
        </h2>
        <ImportHistory imports={history} liveId={live?.id ?? null} formatWhen={formatWhen} />
      </section>
    </main>
  );
}
