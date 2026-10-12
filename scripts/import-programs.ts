// Usage: npm run db:import [-- <file>]   (default: data/programs.csv)
// Imports a program catalog CSV (D17). A valid file becomes the live data. A
// file with any invalid row is rejected as a whole and the old data stays live.
// Exit code: 0 for imported or already imported, 1 for rejected or unreadable.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { importCatalog } from "~/programs/import.server";
import { sql } from "~/shared/db.server";

const DEFAULT_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "data",
  "programs.csv",
);

async function run(): Promise<number> {
  const target = process.argv[2] ?? DEFAULT_FILE;

  let contents: Buffer;
  try {
    contents = await readFile(target);
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    console.error(`Can't read ${target}${typeof code === "string" ? ` (${code})` : ""}`);
    return 1;
  }

  const outcome = await importCatalog({ name: path.basename(target), contents });
  switch (outcome.kind) {
    case "accepted":
      console.log(`Imported ${outcome.rowCount} programs (import ${outcome.importId}). They are live now.`);
      return 0;
    case "noop":
      console.log(
        `Nothing to do: this file was already imported (import ${outcome.importId}, ${outcome.status}).`,
      );
      return 0;
    case "rejected": {
      console.error(
        `Rejected: ${outcome.issueCount} problem${outcome.issueCount === 1 ? "" : "s"} in ${path.basename(target)} (import ${outcome.importId}). The previous data stays live.`,
      );
      for (const issue of outcome.issues) {
        const where = issue.rowNumber === null ? "file" : `row ${issue.rowNumber}`;
        const column = issue.column === null ? "" : `, ${issue.column}`;
        const value = issue.value === null || issue.value === "" ? "" : ` (got "${issue.value}")`;
        console.error(`  ${where}${column}: ${issue.message}${value}`);
      }
      return 1;
    }
  }
}

run()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error("import failed:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => sql.end({ timeout: 5 }));
