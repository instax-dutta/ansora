import { describe, expect, it } from "vitest";
import {
  FRONTMATTER_WINDOW_BYTES,
  frontmatterHeadStatus,
  headHasCompleteFrontmatter,
} from "./frontmatter";

const front = (body: string) => `---\n${body}\n---\n`;

describe("frontmatterHeadStatus", () => {
  it("reports a complete block when the closing delimiter is inside the window", () => {
    const head = front("title: Hello\ntags:\n  - one\n  - two\n");
    expect(frontmatterHeadStatus(head)).toBe("complete");
    expect(headHasCompleteFrontmatter(head)).toBe(true);
  });

  it("reports truncated when the block starts but does not close", () => {
    const head = "---\ntitle: Hello\ntags:\n  - one\n";
    expect(frontmatterHeadStatus(head)).toBe("truncated");
    expect(headHasCompleteFrontmatter(head)).toBe(false);
  });

  it("reports none when the file has no frontmatter", () => {
    expect(frontmatterHeadStatus("# Just a heading\n\nbody")).toBe("none");
    expect(headHasCompleteFrontmatter("# Just a heading\n\nbody")).toBe(true);
  });

  it("tolerates CRLF line endings", () => {
    const head = "---\r\ntitle: Hello\r\n---\r\nbody";
    expect(frontmatterHeadStatus(head)).toBe("complete");
  });

  it("tolerates a byte order mark before the delimiter", () => {
    const head = "\uFEFF---\ntitle: Hello\n---\nbody";
    expect(frontmatterHeadStatus(head)).toBe("complete");
  });

  it("does not treat a horizontal rule later in the file as frontmatter", () => {
    const head = "Intro paragraph\n\n---\ntitle: not frontmatter\n---\n";
    expect(frontmatterHeadStatus(head)).toBe("none");
  });

  it("keeps the window large enough for a real frontmatter block", () => {
    expect(FRONTMATTER_WINDOW_BYTES).toBeGreaterThanOrEqual(16384);
  });
});
