import { Link } from "react-router";
import type { Route } from "./+types/home";
import { DataBanner } from "~/components/data-banner";
import { ResultGroup } from "~/components/result-group";
import { SearchForm } from "~/components/search-form";
import type { BorrowerRawInput } from "~/matching/borrower-input";
import { parseBorrowerInput } from "~/matching/borrower-input";
import { matchPrograms } from "~/matching/match";
import { businessTypesOf } from "~/programs/business-types";
import { loadLiveCatalog } from "~/programs/programs.server";
import { todayIso } from "~/shared/date";
import { failRequest } from "~/shared/route-errors.server";
import { requestContext } from "~/shared/request-context.server";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Program Finder" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const ctx = context.get(requestContext);
  const params = new URL(request.url).searchParams;

  const values: BorrowerRawInput = {
    amount: params.get("amount") ?? "",
    type: params.get("type") ?? "",
    tier: params.get("tier") ?? "",
    years: params.get("years") ?? "",
    score: params.get("score") ?? "",
  };

  const dbStart = performance.now();
  let catalog;
  try {
    catalog = await loadLiveCatalog();
  } catch (error) {
    failRequest(ctx, error);
  }
  ctx.timings.db = performance.now() - dbStart;

  if (catalog === null) {
    return {
      state: "no_data" as const,
      values,
      fieldErrors: {},
      businessTypes: [] as string[],
      liveImport: null,
    };
  }

  const businessTypes = businessTypesOf(catalog.programs);
  const liveImport = { id: catalog.import.id, createdAt: catalog.import.createdAt };

  // Amount and business type are needed before any results (D12): an empty
  // field here is "not yet known", never "invalid".
  if (values.amount.trim() === "" || values.type.trim() === "") {
    return {
      state: "need_input" as const,
      values,
      fieldErrors: {},
      businessTypes,
      liveImport,
    };
  }

  const parsed = parseBorrowerInput(values, businessTypes);
  if (!parsed.ok) {
    return {
      state: "invalid" as const,
      values,
      fieldErrors: parsed.fieldErrors,
      businessTypes,
      liveImport,
    };
  }

  const matchStart = performance.now();
  const result = matchPrograms(parsed.value, catalog.programs, todayIso());
  ctx.timings.match = performance.now() - matchStart;

  return {
    state: "results" as const,
    values,
    fieldErrors: {},
    businessTypes,
    liveImport,
    result,
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { state, values, fieldErrors, businessTypes, liveImport } = loaderData;

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Program Finder</h1>

      {liveImport !== null && <DataBanner liveImport={liveImport} />}

      <SearchForm values={values} fieldErrors={fieldErrors} businessTypes={businessTypes} />

      {state === "no_data" && (
        <p role="status">
          No program data loaded yet.{" "}
          <Link to="/data-health" className="underline">
            See data health
          </Link>
        </p>
      )}

      {state === "need_input" && (
        <p role="status">Enter the loan amount and business type to see programs.</p>
      )}

      {state === "invalid" && <p role="status">Fix the highlighted field to see programs.</p>}

      {state === "results" && (
        <div className="space-y-6">
          {loaderData.result.fits.length === 0 &&
            (loaderData.result.close.length > 0 || loaderData.result.askFirst.length > 0) && (
              <p role="status">No exact fits — here are the closest options:</p>
            )}
          <ResultGroup label="Fits" evaluations={loaderData.result.fits} />
          <ResultGroup label="Close" evaluations={loaderData.result.close} />
          <ResultGroup label="Ask first" evaluations={loaderData.result.askFirst} />
          <ResultGroup label="Doesn't fit" evaluations={loaderData.result.noFit} collapsed />
        </div>
      )}
    </main>
  );
}
