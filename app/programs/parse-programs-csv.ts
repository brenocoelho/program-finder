import { parse } from "csv-parse/sync";
import {
  PROGRAM_COLUMNS,
  readProgramRow,
  type DataIssue,
  type NewProgram,
} from "~/programs/program";

export type ParsedCatalog =
  | { ok: true; programs: NewProgram[]; rowCount: number }
  | { ok: false; issues: DataIssue[]; rowCount: number };

type Info = { lines: number };
type Parsed = { record: string[]; info: Info };

function fileIssue(
  code: DataIssue["code"],
  message: string,
  extra: Partial<DataIssue> = {},
): DataIssue {
  return { rowNumber: null, column: null, value: null, code, message, ...extra };
}

function decode(input: string | Uint8Array): string | DataIssue {
  if (typeof input === "string") return input.replace(/^﻿/, "");
  try {
    // fatal: bad bytes are an issue, never silently garbled lender names.
    // TextDecoder drops a leading byte order mark by itself.
    return new TextDecoder("utf-8", { fatal: true }).decode(input);
  } catch {
    return fileIssue("malformed_csv", "The file is not UTF-8 text");
  }
}

/**
 * The catalog file to programs, or every issue found. Pure: no I/O, never
 * throws. Any issue rejects the whole file (D18): `ok: false` carries no programs.
 */
export function parseProgramsCsv(input: string | Uint8Array): ParsedCatalog {
  const text = decode(input);
  if (typeof text !== "string") return { ok: false, issues: [text], rowCount: 0 };

  let records: Parsed[];
  try {
    // With `info: true` each item is { record, info }; csv-parse's types don't show it.
    records = parse(text, {
      relax_column_count: true, // we report a short or long row ourselves
      skip_empty_lines: true,
      info: true,
    }) as unknown as Parsed[];
  } catch (error) {
    const lines = (error as { lines?: unknown } | null)?.lines;
    const detail = error instanceof Error ? `: ${error.message}` : "";
    return {
      ok: false,
      rowCount: 0,
      issues: [
        fileIssue("malformed_csv", `The file can't be read as CSV${detail}`, {
          rowNumber: typeof lines === "number" ? lines : null,
        }),
      ],
    };
  }

  const [headerRecord, ...dataRecords] = records;
  if (headerRecord === undefined || dataRecords.length === 0) {
    return {
      ok: false,
      rowCount: 0,
      issues: [fileIssue("empty_file", "The file has no program rows")],
    };
  }

  const header = headerRecord.record.map((name) => name.trim());
  const missing = PROGRAM_COLUMNS.filter((column) => !header.includes(column));
  if (missing.length > 0) {
    return {
      ok: false,
      rowCount: dataRecords.length,
      issues: missing.map((column) =>
        fileIssue("missing_column", "Column is missing from the header", { column }),
      ),
    };
  }
  const columnIndex = Object.fromEntries(
    PROGRAM_COLUMNS.map((column) => [column, header.indexOf(column)]),
  ) as Record<(typeof PROGRAM_COLUMNS)[number], number>;

  const issues: DataIssue[] = [];
  const programs: NewProgram[] = [];
  const firstRowOfKey = new Map<string, number>();

  for (const { record, info } of dataRecords) {
    // csv-parse reports the line a record ends on; a quoted line break inside
    // a cell moves it down, so step back to the line the record starts on.
    const breaks = record.reduce((sum, c) => sum + (c.match(/\n/g)?.length ?? 0), 0);
    const rowNumber = info.lines - breaks;

    if (record.length !== header.length) {
      issues.push(
        fileIssue(
          "malformed_csv",
          `Row has ${record.length} values, the header has ${header.length}`,
          { rowNumber },
        ),
      );
      continue;
    }

    const cells = Object.fromEntries(
      PROGRAM_COLUMNS.map((column) => [column, record[columnIndex[column]] ?? ""]),
    ) as Record<(typeof PROGRAM_COLUMNS)[number], string>;

    const row = readProgramRow(cells, rowNumber);
    if (!row.ok) {
      issues.push(...row.issues);
      continue;
    }

    const earlier = firstRowOfKey.get(row.program.key);
    if (earlier !== undefined) {
      issues.push(
        fileIssue(
          "duplicate_program",
          `Same lender and program type as row ${earlier}`,
          { rowNumber },
        ),
      );
      continue;
    }
    firstRowOfKey.set(row.program.key, rowNumber);
    programs.push(row.program);
  }

  const rowCount = dataRecords.length;
  return issues.length > 0
    ? { ok: false, issues, rowCount }
    : { ok: true, programs, rowCount };
}
