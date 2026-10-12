import { migrate } from "./scripts/migrate";
import { env } from "./app/shared/env.server";

function reason(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === "string") return code;
  return error instanceof Error && error.message ? error.message : "unknown error";
}

// Runs once before the integration tests: bring finder_test up to date.
export default async function setup(): Promise<void> {
  try {
    await migrate(env.TEST_DATABASE_URL, () => {});
  } catch (error) {
    throw new Error(
      "Integration tests need Postgres with the finder_test database. " +
        "Run `npm run db:up` first. " +
        `(${reason(error)})`,
    );
  }
}
