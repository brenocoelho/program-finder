import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { DataBanner } from "~/components/data-banner";
import type { Freshness } from "~/matching/rules";

// The banner must never make old rates look current (D8).

function bannerText(freshness: Freshness | null, createdAt = "2026-10-12T13:49:25.000Z"): string {
  const html = renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(DataBanner, { liveImport: { id: 1, createdAt }, freshness })),
  );
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

describe("the data banner", () => {
  it("says when the rates were confirmed, not only when the file was imported", () => {
    const text = bannerText({ oldest: "2026-01-01", newest: "2026-02-08", staleCount: 49, total: 49 });
    expect(text).toContain("Rates last confirmed Jan 1, 2026 – Feb 8, 2026");
    expect(text).toContain("Imported Oct 12, 2026");
    expect(text).not.toContain("as of Oct 12, 2026");
  });

  it("warns how many programs have rates over 31 days old", () => {
    const text = bannerText({ oldest: "2026-01-01", newest: "2026-02-08", staleCount: 49, total: 49 });
    expect(text).toContain("Rates may be out of date for 49 of 49 programs (over 31 days old)");
  });

  it("no warning when no row is stale", () => {
    const text = bannerText({ oldest: "2026-10-01", newest: "2026-10-01", staleCount: 0, total: 3 });
    expect(text).not.toContain("out of date");
    expect(text).toContain("Rates last confirmed Oct 1, 2026");
  });
});
