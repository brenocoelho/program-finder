import type { ImportStatus, ImportSummary, Program } from "~/programs/program";
import { sql } from "~/shared/db.server";

type ImportRow = {
  id: number;
  source_name: string;
  file_sha256: string;
  status: ImportStatus;
  row_count: number;
  issue_count: number;
  rules_version: number;
  created_at: Date;
};

function toImportSummary(row: ImportRow): ImportSummary {
  return {
    id: row.id,
    sourceName: row.source_name,
    fileSha256: row.file_sha256,
    status: row.status,
    rowCount: row.row_count,
    issueCount: row.issue_count,
    rulesVersion: row.rules_version,
    createdAt: row.created_at.toISOString(),
  };
}

/** The live import: the accepted one with the highest id. Null if none was accepted yet. */
export async function loadLiveImport(): Promise<ImportSummary | null> {
  const [row] = await sql<ImportRow[]>`
    select id, source_name, file_sha256, status, row_count, issue_count, rules_version, created_at
    from data_imports
    where status = 'accepted'
    order by id desc
    limit 1`;
  return row === undefined ? null : toImportSummary(row);
}

/** The latest imports of any status, newest first. */
export async function loadRecentImports(limit: number): Promise<ImportSummary[]> {
  const rows = await sql<ImportRow[]>`
    select id, source_name, file_sha256, status, row_count, issue_count, rules_version, created_at
    from data_imports
    order by id desc
    limit ${limit}`;
  return rows.map(toImportSummary);
}

type ProgramRow = {
  id: number;
  import_id: number;
  row_number: number;
  program_key: string;
  lender_name: string;
  program_type: string;
  min_loan_cents: number;
  max_loan_cents: number;
  min_credit_score: number;
  credit_tier_required: Program["creditTierRequired"];
  min_years_in_business: number;
  rate_min_bp: number;
  rate_max_bp: number;
  max_term_months: number;
  sba_guarantee_bp: number;
  eligible_business_type: string;
  requires_collateral: Program["requiresCollateral"];
  max_debt_ratio_bp: number | null;
  turnaround_days: number;
  special_requirements: string | null;
  last_updated: string;
};

export type LiveCatalog = { import: ImportSummary; programs: Program[] };

/**
 * The live import and its programs, read from Postgres on every call: there is
 * no cache, so a new import is live for the next request. Null when no import
 * has been accepted yet (never an empty list: "no data" is not "nothing fits").
 */
export async function loadLiveCatalog(): Promise<LiveCatalog | null> {
  const live = await loadLiveImport();
  if (live === null) return null;

  const rows = await sql<ProgramRow[]>`
    select id, import_id, row_number, program_key, lender_name, program_type,
           min_loan_cents, max_loan_cents, min_credit_score, credit_tier_required,
           min_years_in_business, rate_min_bp, rate_max_bp, max_term_months,
           sba_guarantee_bp, eligible_business_type, requires_collateral,
           max_debt_ratio_bp, turnaround_days, special_requirements,
           last_updated::text as last_updated
    from programs
    where import_id = ${live.id}
    order by row_number`;

  return {
    import: live,
    programs: rows.map((r) => ({
      id: r.id,
      importId: r.import_id,
      rowNumber: r.row_number,
      key: r.program_key,
      lenderName: r.lender_name,
      programType: r.program_type,
      minLoanCents: r.min_loan_cents,
      maxLoanCents: r.max_loan_cents,
      minCreditScore: r.min_credit_score,
      creditTierRequired: r.credit_tier_required,
      minYearsInBusiness: r.min_years_in_business,
      rateMinBp: r.rate_min_bp,
      rateMaxBp: r.rate_max_bp,
      maxTermMonths: r.max_term_months,
      sbaGuaranteeBp: r.sba_guarantee_bp,
      eligibleBusinessType: r.eligible_business_type,
      requiresCollateral: r.requires_collateral,
      maxDebtRatioBp: r.max_debt_ratio_bp,
      turnaroundDays: r.turnaround_days,
      specialRequirements: r.special_requirements,
      lastUpdated: r.last_updated,
    })),
  };
}
