import type { ImportSummary } from "~/programs/program";

export function ImportHistory({
  imports,
  liveId,
  formatWhen,
}: {
  imports: ImportSummary[];
  liveId: number | null;
  formatWhen: (iso: string) => string;
}) {
  if (imports.length === 0) return <p>No file has been imported yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">The last 10 imports, newest first</caption>
        <thead>
          <tr className="border-b border-gray-300 dark:border-gray-700">
            <th scope="col" className="py-2 pr-4">When</th>
            <th scope="col" className="py-2 pr-4">File</th>
            <th scope="col" className="py-2 pr-4">Result</th>
            <th scope="col" className="py-2 pr-4">Rows</th>
            <th scope="col" className="py-2">Problems</th>
          </tr>
        </thead>
        <tbody>
          {imports.map((item) => (
            <tr key={item.id} className="border-b border-gray-200 dark:border-gray-800">
              <td className="py-2 pr-4">{formatWhen(item.createdAt)}</td>
              <td className="py-2 pr-4">{item.sourceName}</td>
              <td className="py-2 pr-4">
                {item.status === "rejected"
                  ? "Rejected"
                  : item.id === liveId
                    ? "Accepted, in use"
                    : "Accepted, replaced"}
              </td>
              <td className="py-2 pr-4">{item.rowCount}</td>
              <td className="py-2">{item.issueCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
