import type { Program } from "~/programs/program";

/**
 * The distinct business types in the live catalog, alphabetical, excluding
 * "All" (a wildcard marker on the program row, not a borrower-facing
 * choice, D5). "Other" is not included either: the UI always offers it in
 * addition to this list, no program row is ever named "Other".
 */
export function businessTypesOf(programs: readonly Program[]): string[] {
  const types = new Set(programs.map((p) => p.eligibleBusinessType).filter((t) => t !== "All"));
  return [...types].sort((a, b) => a.localeCompare(b));
}
