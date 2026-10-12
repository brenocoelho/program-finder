import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "~/shared/db.server";
import { loadDataHealth } from "./data-health.server";
import { importCatalog } from "./import.server";
import { loadLiveCatalog } from "./programs.server";

const realCsv = readFileSync(new URL("../../data/programs.csv", import.meta.url), "utf8");

const silent = { info() {}, warn() {}, error() {} } as unknown as Parameters<typeof importCatalog>[1];

/** The real file with one rate changed: a different file that is still valid. */
function withNewRate(rate: string): string {
  return realCsv.replace(",11,13.6,", `,11,${rate},`);
}
/** The real file with a loan minimum nobody can read. */
const brokenCsv = realCsv.replace(",10000,250000,", ",ten thousand,250000,");

function file(contents: string, name = "programs.csv") {
  return { name, contents: new TextEncoder().encode(contents) };
}

async function count(table: "data_imports" | "programs" | "data_issues"): Promise<number> {
  const rows = await sql<{ n: number }[]>`select count(*)::int as n from ${sql(table)}`;
  return rows[0].n;
}

beforeAll(async () => {
  // These tests empty the import tables. Never let them run on the dev database.
  const [{ name }] = await sql<{ name: string }[]>`select current_database() as name`;
  if (!name.endsWith("_test")) throw new Error(`refusing to run on database ${name}`);
});

beforeEach(async () => {
  await sql`truncate recommendation_events, programs, data_issues, data_imports restart identity cascade`;
});

afterAll(() => sql.end());

describe("importing the catalog", () => {
  it("importing the same file two times gives only one import", async () => {
    const first = await importCatalog(file(realCsv), silent);
    const second = await importCatalog(file(realCsv), silent);

    expect(first).toMatchObject({ kind: "accepted", rowCount: 49 });
    expect(second).toMatchObject({ kind: "noop", importId: first.importId, status: "accepted" });
    expect(await count("data_imports")).toBe(1);
    expect(await count("programs")).toBe(49);
  });

  it("the real data/programs.csv is accepted with zero issues", async () => {
    const outcome = await importCatalog(file(realCsv), silent);
    expect(outcome).toMatchObject({ kind: "accepted", rowCount: 49 });
    expect(await count("data_issues")).toBe(0);
  });

  it("a program is saved in integer cents and basis points with its CSV line", async () => {
    await importCatalog(file(realCsv), silent);
    const [row] = await sql<Record<string, unknown>[]>`
      select row_number, program_key, min_loan_cents, max_loan_cents,
             rate_min_bp, rate_max_bp, sba_guarantee_bp, max_debt_ratio_bp,
             last_updated::text as last_updated
      from programs where program_key = 'First National Bank|504 Loan'`;
    expect(row).toEqual({
      row_number: 4,
      program_key: "First National Bank|504 Loan",
      min_loan_cents: 25_000_000,
      max_loan_cents: 500_000_000,
      rate_min_bp: 700,
      rate_max_bp: 770,
      sba_guarantee_bp: 4000,
      max_debt_ratio_bp: 5000,
      last_updated: "2026-01-23",
    });
  });

  it("the file's hash and name are recorded, and no path", async () => {
    await importCatalog(file(realCsv, "programs.csv"), silent);
    const [row] = await sql<{ source_name: string; file_sha256: string }[]>`
      select source_name, file_sha256 from data_imports`;
    expect(row.source_name).toBe("programs.csv");
    expect(row.file_sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("one bad row rejects the file and keeps the previous data live", async () => {
    const good = await importCatalog(file(realCsv), silent);
    const bad = await importCatalog(file(brokenCsv), silent);

    expect(bad).toMatchObject({ kind: "rejected", issueCount: 1, rowCount: 49 });
    const live = await loadLiveCatalog();
    expect(live?.import.id).toBe(good.importId);
    expect(live?.programs).toHaveLength(49);
  });

  it("a rejected file saves no programs, only its issues with row number and column", async () => {
    await importCatalog(file(realCsv), silent);
    await importCatalog(file(brokenCsv), silent);

    expect(await count("programs")).toBe(49);
    const issues = await sql<Record<string, unknown>[]>`
      select row_number, column_name, value, code from data_issues`;
    expect(issues).toEqual([
      { row_number: 2, column_name: "min_loan_amount", value: "ten thousand", code: "not_a_number" },
    ]);
  });

  it("importing the same rejected file again adds no second rejected import", async () => {
    await importCatalog(file(realCsv), silent);
    await importCatalog(file(brokenCsv), silent);
    const again = await importCatalog(file(brokenCsv), silent);

    expect(again).toMatchObject({ kind: "noop", status: "rejected" });
    expect(await count("data_imports")).toBe(2);
    expect(await count("data_issues")).toBe(1);
  });

  it("a rejected first file leaves no live data", async () => {
    await importCatalog(file(brokenCsv), silent);
    expect(await loadLiveCatalog()).toBeNull();
  });

  it("an empty file is rejected, never imported as zero programs", async () => {
    const outcome = await importCatalog(file(""), silent);
    expect(outcome).toMatchObject({ kind: "rejected", rowCount: 0 });
    expect(await loadLiveCatalog()).toBeNull();
  });

  it("a new valid file becomes live and the old rows stay as history", async () => {
    const first = await importCatalog(file(realCsv), silent);
    const second = await importCatalog(file(withNewRate("13.7")), silent);

    expect(second.kind).toBe("accepted");
    expect(second.importId).toBeGreaterThan(first.importId);
    const live = await loadLiveCatalog();
    expect(live?.import.id).toBe(second.importId);
    expect(await count("programs")).toBe(98);
    const old = await sql`select 1 from programs where import_id = ${first.importId}`;
    expect(old).toHaveLength(49);
  });

  it("going back to an earlier file is a new import, so it can be made live again", async () => {
    const a = await importCatalog(file(realCsv), silent);
    await importCatalog(file(withNewRate("13.7")), silent);
    const back = await importCatalog(file(realCsv), silent);

    expect(back.kind).toBe("accepted");
    expect(back.importId).not.toBe(a.importId);
    expect((await loadLiveCatalog())?.import.id).toBe(back.importId);
  });

  it("two imports of the same file at the same time give one import", async () => {
    const [x, y] = await Promise.all([
      importCatalog(file(realCsv), silent),
      importCatalog(file(realCsv), silent),
    ]);
    expect([x.kind, y.kind].sort()).toEqual(["accepted", "noop"]);
    expect(await count("data_imports")).toBe(1);
    expect(await count("programs")).toBe(49);
  });
});

describe("reading the live catalog", () => {
  it("with no import yet there is no live data, not an empty list", async () => {
    expect(await loadLiveCatalog()).toBeNull();
  });

  it("each read goes to the database: a new import is seen without a restart", async () => {
    await importCatalog(file(realCsv), silent);
    const before = await loadLiveCatalog();
    await importCatalog(file(withNewRate("13.7")), silent);
    const after = await loadLiveCatalog();

    const pick = (c: typeof before) =>
      c?.programs.find((p) => p.key === "First National Bank|Community Advantage")?.rateMaxBp;
    expect(pick(before)).toBe(1360);
    expect(pick(after)).toBe(1370);
  });

  it("live programs carry the fields the engine needs, in the file's order", async () => {
    await importCatalog(file(realCsv), silent);
    const live = await loadLiveCatalog();
    expect(live?.programs.map((p) => p.rowNumber)).toEqual(
      Array.from({ length: 49 }, (_, i) => i + 2),
    );
    expect(live?.programs[0]).toMatchObject({
      key: "First National Bank|Community Advantage",
      minLoanCents: 1_000_000,
      maxLoanCents: 25_000_000,
      creditTierRequired: "Fair",
      requiresCollateral: "Varies",
      lastUpdated: "2026-01-16",
    });
  });

  it("a blank debt ratio and a blank special requirement come back as null", async () => {
    await importCatalog(file(realCsv), silent);
    const live = await loadLiveCatalog();
    const row = live?.programs.find((p) => p.rowNumber === 8);
    expect(row?.maxDebtRatioBp).toBeNull();
    const blankSpecial = live?.programs.find((p) => p.rowNumber === 5);
    expect(blankSpecial?.specialRequirements).toBeNull();
  });
});

describe("data health", () => {
  it("with no import yet it reports nothing loaded", async () => {
    expect(await loadDataHealth()).toEqual({ live: null, history: [], latestIssues: [] });
  });

  it("data-health shows the live import with its rows and file hash", async () => {
    const outcome = await importCatalog(file(realCsv), silent);
    const health = await loadDataHealth();
    expect(health.live).toMatchObject({
      id: outcome.importId,
      status: "accepted",
      rowCount: 49,
      issueCount: 0,
      sourceName: "programs.csv",
    });
    expect(health.live?.fileSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(health.latestIssues).toEqual([]);
  });

  it("data-health shows the latest rejected import's issues with row numbers", async () => {
    const good = await importCatalog(file(realCsv), silent);
    const bad = await importCatalog(file(brokenCsv, "new-rates.csv"), silent);
    const health = await loadDataHealth();

    expect(health.live?.id).toBe(good.importId);
    expect(health.history.map((h) => [h.id, h.status])).toEqual([
      [bad.importId, "rejected"],
      [good.importId, "accepted"],
    ]);
    expect(health.latestIssues).toEqual([
      {
        rowNumber: 2,
        column: "min_loan_amount",
        value: "ten thousand",
        code: "not_a_number",
        message: "Must be a number",
      },
    ]);
  });

  it("history lists the last 10 imports, newest first", async () => {
    for (let i = 0; i < 12; i++) {
      await importCatalog(file(withNewRate(`${13 + (i % 2)}.${i}`)), silent);
    }
    const health = await loadDataHealth();
    expect(health.history).toHaveLength(10);
    const ids = health.history.map((h) => h.id);
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
  });
});
