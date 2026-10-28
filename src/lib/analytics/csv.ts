/**
 * CSV export.
 *
 * Exported tables land in a spreadsheet, which makes two problems ours:
 *
 * 1. **Formula injection** — a post titled `=HYPERLINK("…")` must be inert.
 *    Any text cell starting with `=`, `+`, `-`, `@`, tab or CR is prefixed with
 *    an apostrophe, which spreadsheets treat as literal text. Numbers are
 *    exempt, so a negative change stays a number.
 * 2. **Row forgery** — an embedded newline in a title would create extra rows.
 *    Line breaks are flattened to spaces.
 */

const FORMULA_START = /^[=+\-@\t\r]/;

/** Render one cell safely. Numbers stay numbers; text cannot start a formula. */
export function sanitiseCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  // Collapse every line break first, so the formula check sees the real first
  // character and the cell cannot span rows.
  const flattened = value.replace(/\r\n?/g, " ").replace(/\n/g, " ");
  if (FORMULA_START.test(flattened)) return `'${flattened}`;
  return flattened;
}

/** RFC 4180 quoting: only when the field contains a comma, quote or CRLF. */
function quote(field: string): string {
  if (/[",\r\n]/.test(field)) return `"${field.replace(/"/g, '""')}"`;
  return field;
}

/** Build a CSV document that Excel, Numbers and Google Sheets open cleanly. */
export function toCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>
): string {
  const lines = [headers.map((header) => quote(sanitiseCsvCell(header))).join(",")];
  for (const row of rows) {
    lines.push(row.map((cell) => quote(sanitiseCsvCell(cell))).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}
