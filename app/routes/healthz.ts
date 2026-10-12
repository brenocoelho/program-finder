import type { Route } from "./+types/healthz";
import { sql } from "~/shared/db.server";
import { requestContext } from "~/shared/request-context.server";

const DB_TIMEOUT_MS = 2000;

export async function loader({ context }: Route.LoaderArgs) {
  const ctx = context.get(requestContext);
  const start = performance.now();
  let dbUp = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      sql`select 1`,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("db check timed out")),
          DB_TIMEOUT_MS,
        );
      }),
    ]);
    dbUp = true;
  } catch (error) {
    ctx.logger.error({ err: error }, "healthz db check failed");
  } finally {
    clearTimeout(timer);
  }
  ctx.timings.db = performance.now() - start;

  return Response.json(
    { status: dbUp ? "ok" : "error", db: dbUp ? "up" : "down" },
    { status: dbUp ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
