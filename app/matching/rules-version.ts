import type { CreditTier } from "~/programs/program";

// Bump on any change to a business rule, and update the spec, the tests and
// docs/DECISIONS.md in the same change (CLAUDE.md).
export const RULES_VERSION = 1;

/** A row last updated more than this many days before today is stale (D8). */
export const STALE_AFTER_DAYS = 31;

/** Excellent > Good > Fair (D1). */
export const TIER_RANK: Record<CreditTier, number> = { Fair: 1, Good: 2, Excellent: 3 };
