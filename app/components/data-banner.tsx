import { Link } from "react-router";
import { formatHumanDate } from "~/shared/date";

/** The live import's date, with a link to the full picture at /data-health. */
export function DataBanner({ liveImport }: { liveImport: { id: number; createdAt: string } }) {
  return (
    <p className="text-sm text-gray-600 dark:text-gray-400">
      Program data as of {formatHumanDate(liveImport.createdAt.slice(0, 10))} ·{" "}
      <Link to="/data-health" className="underline">
        See details
      </Link>
    </p>
  );
}
