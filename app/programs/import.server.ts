import { createHash } from "node:crypto";
import path from "node:path";
import type { Logger } from "pino";
import { RULES_VERSION } from "~/matching/rules-version";
import { parseProgramsCsv } from "~/programs/parse-programs-csv";
import type { DataIssue, ImportStatus, NewProgram } from "~/programs/program";
import { sql } from "~/shared/db.server";
import { logger } from "~/shared/logger.server";

// Arbitrary constant: serializes imports, so two runs can't both read the same
// "previous live import" and each save a new one.
const IMPORT_LOCK_KEY = 874_201_002;
// 19 columns per program row: stays far below Postgres' 65,535 parameters.
const INSERT_CHUNK = 1000;

export type ImportOutcome =
  | { kind: "accepted"; importId: number; rowCount: number }
  | { kind: "rejected"; importId: number; rowCount: number; issueCount: number; issues: DataIssue[] }
  | { kind: "noop"; importId: number; status: ImportStatus };

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += INSERT_CHUNK) out.push(items.slice(i, i + INSERT_CHUNK));
  return out;
}

function programRows(importId: number, programs: NewProgram[]) {
  return programs.map((p) => ({
    import_id: importId,
    row_number: p.rowNumber,
    program_key: p.key,
    lender_name: p.lenderName,
    program_type: p.programType,
    min_loan_cents: p.minLoanCents,
    max_loan_cents: p.maxLoanCents,
    min_credit_score: p.minCreditScore,
    credit_tier_required: p.creditTierRequired,
    min_years_in_business: p.minYearsInBusiness,
    rate_min_bp: p.rateMinBp,
    rate_max_bp: p.rateMaxBp,
    max_term_months: p.maxTermMonths,
    sba_guarantee_bp: p.sbaGuaranteeBp,
    eligible_business_type: p.eligibleBusinessType,
    requires_collateral: p.requiresCollateral,
    max_debt_ratio_bp: p.maxDebtRatioBp,
    turnaround_days: p.turnaroundDays,
    special_requirements: p.specialRequirements,
    last_updated: p.lastUpdated,
  }));
}

function issueRows(importId: number, issues: DataIssue[]) {
  return issues.map((i) => ({
    import_id: importId,
    row_number: i.rowNumber,
    column_name: i.column,
    value: i.value,
    code: i.code,
    message: i.message,
  }));
}

/**
 * Saves a catalog file as a new import. A valid file becomes the live data; a
 * file with any issue is saved as rejected, with its issues, and the previous
 * data stays live (D18). One transaction, so nothing is half saved.
 *
 * Importing the file that is already live is a no-op. For any other file the
 * idempotency key is its hash plus the live import it would replace (SPEC
 * section 5): a retry of a rejected file is a no-op, and going back to an
 * earlier file after a newer one is a new import.
 */
export async function importCatalog(
  file: { name: string; contents: Uint8Array },
  log: Logger = logger,
): Promise<ImportOutcome> {
  const sha256 = createHash("sha256").update(file.contents).digest("hex");
  const parsed = parseProgramsCsv(file.contents);
  const status: ImportStatus = parsed.ok ? "accepted" : "rejected";
  const issues = parsed.ok ? [] : parsed.issues;
  const sourceName = path.basename(file.name);

  const outcome = await sql.begin(async (tx): Promise<ImportOutcome> => {
    await tx`select pg_advisory_xact_lock(${IMPORT_LOCK_KEY})`;

    const [live] = await tx<{ id: number; file_sha256: string }[]>`
      select id, file_sha256 from data_imports
      where status = 'accepted' order by id desc limit 1`;
    // The file that is already live: nothing to do (FR-13). The key below can't
    // catch this, because it names the live import and this file's own import
    // was saved when no import (or an older one) was live.
    if (live?.file_sha256 === sha256) {
      return { kind: "noop", importId: live.id, status: "accepted" };
    }
    const idempotencyKey = `${sha256}:${live?.id ?? "none"}`;

    const [created] = await tx<{ id: number }[]>`
      insert into data_imports
        (idempotency_key, source_name, file_sha256, status, row_count, issue_count, rules_version)
      values
        (${idempotencyKey}, ${sourceName}, ${sha256}, ${status}, ${parsed.rowCount},
         ${issues.length}, ${RULES_VERSION})
      on conflict (idempotency_key) do nothing
      returning id`;

    if (created === undefined) {
      const [existing] = await tx<{ id: number; status: ImportStatus }[]>`
        select id, status from data_imports where idempotency_key = ${idempotencyKey}`;
      return { kind: "noop", importId: existing.id, status: existing.status };
    }

    if (parsed.ok) {
      for (const rows of chunks(programRows(created.id, parsed.programs))) {
        await tx`insert into programs ${tx(rows)}`;
      }
      return { kind: "accepted", importId: created.id, rowCount: parsed.rowCount };
    }

    for (const rows of chunks(issueRows(created.id, parsed.issues))) {
      await tx`insert into data_issues ${tx(rows)}`;
    }
    return {
      kind: "rejected",
      importId: created.id,
      rowCount: parsed.rowCount,
      issueCount: parsed.issues.length,
      issues: parsed.issues,
    };
  });

  switch (outcome.kind) {
    case "accepted":
      log.info({ importId: outcome.importId, rows: outcome.rowCount, issues: 0 }, "import.accepted");
      break;
    case "rejected":
      log.warn(
        { importId: outcome.importId, rows: outcome.rowCount, issues: outcome.issueCount },
        "import.rejected",
      );
      break;
    case "noop":
      log.info({ importId: outcome.importId, status: outcome.status }, "import.noop");
      break;
  }
  return outcome;
}
