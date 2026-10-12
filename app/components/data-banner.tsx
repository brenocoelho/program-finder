import { Link } from "react-router";
import type { Freshness } from "~/matching/rules";
import { STALE_AFTER_DAYS } from "~/matching/rules-version";
import { formatHumanDate } from "~/shared/date";

/**
 * When the data was imported and how old its rates are, with a link to
 * /data-health. The import date is not the rate date: a file imported today
 * can hold rates from months ago (D8).
 */
export function DataBanner({
  liveImport,
  freshness,
}: {
  liveImport: { id: number; createdAt: string };
  freshness: Freshness | null;
}) {
  const ratesConfirmed =
    freshness === null
      ? null
      : freshness.oldest === freshness.newest
        ? formatHumanDate(freshness.oldest)
        : `${formatHumanDate(freshness.oldest)} – ${formatHumanDate(freshness.newest)}`;

  return (
    <div className="space-y-1 text-sm">
      {freshness !== null && freshness.staleCount > 0 && (
        <p className="font-medium text-amber-700 dark:text-amber-400">
          Rates may be out of date for {freshness.staleCount} of {freshness.total} programs (over{" "}
          {STALE_AFTER_DAYS} days old)
        </p>
      )}
      <p className="text-gray-600 dark:text-gray-400">
        {ratesConfirmed !== null && <>Rates last confirmed {ratesConfirmed} · </>}
        Imported {formatHumanDate(liveImport.createdAt.slice(0, 10))} ·{" "}
        <Link to="/data-health" className="underline">
          See details
        </Link>
      </p>
    </div>
  );
}
