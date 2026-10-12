import type { DataIssue, ImportSummary, IssueCode } from "~/programs/program";
import { loadLiveImport, loadRecentImports } from "~/programs/programs.server";
import { sql } from "~/shared/db.server";

const HISTORY_SIZE = 10;

export type DataHealth = {
  /** The import the app is using now. Null until a file is accepted. */
  live: ImportSummary | null;
  /** The last 10 imports of any status, newest first. */
  history: ImportSummary[];
  /** Every issue of the newest import (empty when it was accepted). */
  latestIssues: DataIssue[];
};

type IssueRow = {
  row_number: number | null;
  column_name: string | null;
  value: string | null;
  code: IssueCode;
  message: string;
};

export async function loadDataHealth(): Promise<DataHealth> {
  const [live, history] = await Promise.all([loadLiveImport(), loadRecentImports(HISTORY_SIZE)]);
  const latest = history[0];
  if (latest === undefined || latest.issueCount === 0) {
    return { live, history, latestIssues: [] };
  }

  const rows = await sql<IssueRow[]>`
    select row_number, column_name, value, code, message
    from data_issues
    where import_id = ${latest.id}
    order by row_number nulls first, id`;
  return {
    live,
    history,
    latestIssues: rows.map((r) => ({
      rowNumber: r.row_number,
      column: r.column_name,
      value: r.value,
      code: r.code,
      message: r.message,
    })),
  };
}
