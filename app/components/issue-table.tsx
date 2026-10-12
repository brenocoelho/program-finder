import type { DataIssue } from "~/programs/program";

/** Every problem found in an imported file. Row numbers are file lines: the header is line 1. */
export function IssueTable({ issues }: { issues: DataIssue[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">Problems found in the file</caption>
        <thead>
          <tr className="border-b border-gray-300 dark:border-gray-700">
            <th scope="col" className="py-2 pr-4">Row</th>
            <th scope="col" className="py-2 pr-4">Column</th>
            <th scope="col" className="py-2 pr-4">Value</th>
            <th scope="col" className="py-2">Problem</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue, index) => (
            <tr key={index} className="border-b border-gray-200 align-top dark:border-gray-800">
              <td className="py-2 pr-4">
                {issue.rowNumber === null ? "Whole file" : issue.rowNumber}
              </td>
              <td className="py-2 pr-4 font-mono">{issue.column ?? "—"}</td>
              <td className="py-2 pr-4 font-mono break-all">
                {issue.value === null || issue.value === "" ? "—" : issue.value}
              </td>
              <td className="py-2">{issue.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Row numbers are line numbers in the file. The header is row 1.
      </p>
    </div>
  );
}
