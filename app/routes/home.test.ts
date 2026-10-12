import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { Route } from "./+types/home";
import Home from "./home";

// SearchForm's useSubmit/useNavigation need a data router, which this
// static-markup render doesn't set up; MemoryRouter alone is enough for the
// <Link> in the no_data message, which is the only thing this test checks.
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useSubmit: () => () => {}, useNavigation: () => ({ state: "idle" }) };
});

function render(loaderData: unknown): string {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(Home, { loaderData } as unknown as Route.ComponentProps),
    ),
  );
}

describe("no program data loaded (FR-12)", () => {
  it("shows the message with a link to /data-health, not an empty screen", () => {
    const html = render({
      state: "no_data",
      values: { amount: "", type: "", tier: "", years: "", score: "" },
      fieldErrors: {},
      businessTypes: [],
      liveImport: null,
    });

    expect(html).toContain("No program data loaded yet");
    expect(html).toContain('href="/data-health"');
  });
});
