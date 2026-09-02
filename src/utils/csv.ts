// CSV for the spreadsheet a member of staff opens, not for a machine to parse.
// Excel is the reader, so the file is UTF-8 with a byte-order mark and CRLF
// line endings, and every cell is quoted rather than only the ones that have to
// be.

export type CsvValue = string | number | null | undefined;

// Excel and Sheets read a cell opening with one of these as a formula. A client
// called "=Nada" or a note starting with "-" is not a formula, so the text is
// prefixed with an apostrophe, which both readers strip on display. Numbers are
// left alone: quoting a negative balance as text would stop the column adding
// up, which is the whole point of exporting it.
const FORMULA_STARTERS = ["=", "+", "-", "@", "\t", "\r"];

function cell(value: CsvValue): string {
  if (value === null || value === undefined) return '""';
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : '""';
  }
  const safe = FORMULA_STARTERS.some((c) => value.startsWith(c))
    ? `'${value}`
    : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

// A header row plus its data rows, as one CSV document.
export function buildCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(cell).join(","));
  // The BOM matters: without it Excel opens a UTF-8 file as Windows-1252 and
  // mangles every accented name in the list.
  return `\ufeff${lines.join("\r\n")}\r\n`;
}
