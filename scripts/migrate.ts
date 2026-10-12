// Usage: npm run db:migrate [-- <database-url>]  (also imported by vitest.integration-setup.ts)
// Applies db/migrations/*.sql in filename order and records what ran.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import postgres from "postgres";
import { env } from "~/shared/env.server";

const MIGRATIONS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "db",
  "migrations",
);
// Arbitrary constant: stops two migrate runs from racing each other.
const LOCK_KEY = 874_201_001;

/** Applies new migrations to `url`. Returns how many were applied. */
export async function migrate(
  url: string,
  log: (line: string) => void = console.log,
): Promise<number> {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql`select pg_advisory_lock(${LOCK_KEY})`;
    await sql`
      create table if not exists schema_migrations (
        filename    text primary key,
        applied_at  timestamptz not null default now()
      )`;

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => /^\d+.*\.sql$/.test(f))
      .sort();
    const done = new Set(
      (await sql<{ filename: string }[]>`select filename from schema_migrations`)
        .map((r) => r.filename),
    );

    let applied = 0;
    for (const file of files) {
      if (done.has(file)) {
        log(`skip   ${file}`);
        continue;
      }
      const text = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      await sql.begin(async (tx) => {
        await tx.unsafe(text);
        await tx`insert into schema_migrations (filename) values (${file})
                 on conflict (filename) do nothing`;
      });
      log(`apply  ${file}`);
      applied++;
    }
    log(applied === 0 ? "nothing to apply" : `applied ${applied}`);
    return applied;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

// Run as a script (not when imported by the test setup).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  migrate(process.argv[2] ?? env.DATABASE_URL).catch((error: unknown) => {
    console.error(
      "migrate failed:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  });
}
