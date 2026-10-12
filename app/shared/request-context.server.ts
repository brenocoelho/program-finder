import { createContext, type MiddlewareFunction } from "react-router";
import type { Logger } from "pino";
import { logger } from "~/shared/logger.server";

export type RequestContext = {
  requestId: string;
  logger: Logger;
  /** Server-Timing entries in ms, by name. `total` is added by the middleware. */
  timings: Record<string, number>;
};

export const requestContext = createContext<RequestContext>();

const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

export const requestMiddleware: MiddlewareFunction<Response> = async (
  { request, context },
  next,
) => {
  const start = performance.now();
  const incoming = request.headers.get("x-request-id");
  const requestId =
    incoming !== null && VALID_REQUEST_ID.test(incoming)
      ? incoming
      : crypto.randomUUID();

  const ctx: RequestContext = {
    requestId,
    logger: logger.child({ requestId }),
    timings: {},
  };
  context.set(requestContext, ctx);

  const response = await next();

  const durationMs = performance.now() - start;
  response.headers.set("X-Request-Id", requestId);
  response.headers.set(
    "Server-Timing",
    Object.entries({ ...ctx.timings, total: durationMs })
      .map(([name, ms]) => `${name};dur=${ms.toFixed(1)}`)
      .join(", "),
  );
  ctx.logger.info(
    {
      method: request.method,
      path: new URL(request.url).pathname,
      status: response.status,
      durationMs: Math.round(durationMs),
    },
    "request",
  );

  return response;
};
