import { readFileSync } from "node:fs";
import { RouterContextProvider } from "react-router";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { importCatalog } from "~/programs/import.server";
import { sql } from "~/shared/db.server";
import { requestContext, type RequestContext } from "~/shared/request-context.server";
import { loader } from "./home";

const realCsv = readFileSync(new URL("../../data/programs.csv", import.meta.url), "utf8");
const silent = { info() {}, warn() {}, error() {} } as unknown as Parameters<typeof importCatalog>[1];

function file(contents: string, name = "programs.csv") {
  return { name, contents: new TextEncoder().encode(contents) };
}

function contextFor(requestId = "test-request-id"): { context: RouterContextProvider; ctx: RequestContext } {
  const ctx: RequestContext = { requestId, logger: silent as RequestContext["logger"], timings: {} };
  const context = new RouterContextProvider(new Map([[requestContext, ctx]]));
  return { context, ctx };
}

async function runLoader(search: string) {
  const { context } = contextFor();
  const request = new Request(`http://localhost/?${search}`);
  return loader({ request, context, params: {} } as never);
}

beforeAll(async () => {
  const [{ name }] = await sql<{ name: string }[]>`select current_database() as name`;
  if (!name.endsWith("_test")) throw new Error(`refusing to run on database ${name}`);
});

beforeEach(async () => {
  await sql`truncate recommendation_events, programs, data_issues, data_imports restart identity cascade`;
});

afterAll(() => sql.end());

describe("the finder screen loader", () => {
  it("shows no_data, not nothing fits, when no import has been accepted (FR-12)", async () => {
    const result = await runLoader("amount=250000&type=Retail");
    expect(result).toMatchObject({ state: "no_data", businessTypes: [] });
  });

  it("an empty amount or business type shows need_input, not invalid (D12)", async () => {
    await importCatalog(file(realCsv), silent);

    expect(await runLoader("")).toMatchObject({ state: "need_input" });
    expect(await runLoader("amount=250000")).toMatchObject({ state: "need_input" });
    expect(await runLoader("type=Retail")).toMatchObject({ state: "need_input" });
  });

  it("a bad field shows invalid with its fieldError and no results (FR-2)", async () => {
    await importCatalog(file(realCsv), silent);

    const result = await runLoader("amount=250000&type=Retail&score=6800");
    expect(result).toMatchObject({ state: "invalid", fieldErrors: { score: expect.any(String) } });
    expect(result).not.toHaveProperty("result");
  });

  it("a full valid input shows results grouped by status", async () => {
    await importCatalog(file(realCsv), silent);

    const result = await runLoader("amount=250000&type=Construction&tier=Good&years=3");
    expect(result.state).toBe("results");
    if (result.state !== "results") throw new Error("expected results");
    expect(result.result.fits.length).toBeGreaterThan(0);
  });

  it("Server-Timing carries db and match on results, only db on need_input (NFR-1)", async () => {
    await importCatalog(file(realCsv), silent);

    const { context, ctx } = contextFor();
    const request = new Request("http://localhost/?amount=250000&type=Construction");
    await loader({ request, context, params: {} } as never);
    expect(ctx.timings.db).toBeGreaterThanOrEqual(0);
    expect(ctx.timings.match).toBeGreaterThanOrEqual(0);

    const { context: needInputContext, ctx: needInputCtx } = contextFor();
    const needInputRequest = new Request("http://localhost/");
    await loader({ request: needInputRequest, context: needInputContext, params: {} } as never);
    expect(needInputCtx.timings.db).toBeGreaterThanOrEqual(0);
    expect(needInputCtx.timings.match).toBeUndefined();
  });
});
