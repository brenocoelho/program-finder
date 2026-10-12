import { data } from "react-router";
import type { RequestContext } from "~/shared/request-context.server";

/**
 * Logs an unexpected error with the request id, then throws a 500 the root
 * ErrorBoundary turns into a plain message with that same id (FR-19). Never
 * lets the original error (or its stack) reach the browser.
 */
export function failRequest(ctx: RequestContext, error: unknown): never {
  ctx.logger.error({ err: error }, "unexpected error");
  throw data({ requestId: ctx.requestId }, { status: 500 });
}
