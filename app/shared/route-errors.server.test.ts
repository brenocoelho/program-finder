import { describe, expect, it, vi } from "vitest";
import { failRequest } from "./route-errors.server";
import type { RequestContext } from "./request-context.server";

function contextWith(requestId: string) {
  const error = vi.fn();
  const ctx = {
    requestId,
    logger: { error, info: vi.fn(), warn: vi.fn() } as unknown as RequestContext["logger"],
    timings: {},
  } satisfies RequestContext;
  return { ctx, error };
}

describe("failing a request (FR-19)", () => {
  it("throws a 500 carrying the request id, never the original error", () => {
    const { ctx } = contextWith("abc-123");
    let thrown: { data: unknown; init: ResponseInit | null } | undefined;
    try {
      failRequest(ctx, new Error("db exploded with a secret stack trace"));
    } catch (error) {
      thrown = error as typeof thrown;
    }

    expect(thrown?.data).toEqual({ requestId: "abc-123" });
    expect(thrown?.init).toMatchObject({ status: 500 });
  });

  it("logs the original error with the request id before throwing", () => {
    const { ctx, error } = contextWith("abc-123");
    const original = new Error("boom");
    try {
      failRequest(ctx, original);
    } catch {
      // expected
    }
    expect(error).toHaveBeenCalledWith({ err: original }, "unexpected error");
  });
});
