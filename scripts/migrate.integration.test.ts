import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { env } from "~/shared/env.server";
import { migrate } from "./migrate";

const sql = postgres(env.DATABASE_URL, { max: 1 });
afterAll(() => sql.end());

describe("migrations", () => {
  it("running the migrations again applies nothing", async () => {
    expect(await migrate(env.DATABASE_URL, () => {})).toBe(0);
  });

  it("the schema from the spec exists", async () => {
    const rows = await sql<{ table_name: string }[]>`
      select table_name from information_schema.tables
      where table_schema = 'public' order by table_name`;
    expect(rows.map((r) => r.table_name)).toEqual(
      expect.arrayContaining([
        "data_imports",
        "data_issues",
        "programs",
        "recommendation_events",
        "reps",
        "schema_migrations",
      ]),
    );
  });

  it("the 8 rep codes and 2 manager codes are seeded once", async () => {
    const rows = await sql<{ code: string; role: string }[]>`
      select code, role from reps order by code`;
    expect(rows.map((r) => r.code)).toEqual([
      "M01", "M02", "R01", "R02", "R03", "R04", "R05", "R06", "R07", "R08",
    ]);
    expect(rows.filter((r) => r.role === "manager")).toHaveLength(2);
  });
});
