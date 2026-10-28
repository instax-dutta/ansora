import { describe, expect, it } from "vitest";
import { sanitiseCsvCell, toCsv } from "./csv";

/**
 * CSV export is a spreadsheet injection surface. A post titled
 * `=HYPERLINK("http://evil","click")` must not become a live formula in the
 * author's spreadsheet, and a title containing a newline must not be able to
 * forge extra rows.
 */
describe("sanitiseCsvCell", () => {
  it("neutralises formula starters with a leading apostrophe", () => {
    for (const dangerous of ["=1+1", "+1", "-1", "@SUM(A1)", "\tcmd"]) {
      expect(sanitiseCsvCell(dangerous)).toBe(`'${dangerous}`);
    }
  });

  it("defuses a leading carriage return by flattening it", () => {
    // A CR is a row break in a spreadsheet. Flattening it leaves a leading
    // space, which is inert — so the cell needs no apostrophe and, more
    // importantly, cannot start a new record.
    const cell = sanitiseCsvCell("\rcmd");
    expect(cell).toBe(" cmd");
    expect(cell).not.toMatch(/^[=+\-@\t\r]/);
  });

  it("leaves ordinary text and numbers alone", () => {
    expect(sanitiseCsvCell("Self hosting")).toBe("Self hosting");
    expect(sanitiseCsvCell(42)).toBe("42");
    expect(sanitiseCsvCell(-75)).toBe("-75");
  });

  it("flattens line breaks so a cell cannot forge a row", () => {
    expect(sanitiseCsvCell("line one\nline two")).toBe("line one line two");
    expect(sanitiseCsvCell("a\r\nb")).toBe("a b");
  });

  it("renders missing values as empty cells", () => {
    expect(sanitiseCsvCell(null)).toBe("");
    expect(sanitiseCsvCell(undefined)).toBe("");
  });
});

describe("toCsv", () => {
  it("quotes fields that contain separators or quotes", () => {
    const csv = toCsv(["title", "views"], [['Hello, "world"', 10]]);
    expect(csv).toBe('title,views\r\n"Hello, ""world""",10\r\n');
  });

  it("keeps a hostile title inert and on one row", () => {
    const csv = toCsv(
      ["post", "views"],
      [['=HYPERLINK("http://evil.example","click")\nsecond row', 3]]
    );
    const lines = csv.split("\r\n").filter(Boolean);
    expect(lines).toHaveLength(2);
    // Quoted because it contains commas, and inert because it starts with an
    // apostrophe inside the quotes.
    expect(lines[1]).toBe('"\'=HYPERLINK(""http://evil.example"",""click"") second row",3');
    expect(lines[1]).not.toContain("\n");
  });

  it("ends every row with CRLF, including the last", () => {
    expect(toCsv(["a"], [["1"], ["2"]])).toBe("a\r\n1\r\n2\r\n");
  });

  it("still emits headers when there are no rows", () => {
    expect(toCsv(["a", "b"], [])).toBe("a,b\r\n");
  });
});
