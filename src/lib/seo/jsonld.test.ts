import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "./jsonld";

/**
 * The JSON-LD block is embedded in a raw <script> tag — post fields must
 * never be able to break out of it (e.g. a headline containing `</script>`).
 */
describe("serializeJsonLd", () => {
  it("escapes script-tag breakouts while keeping valid JSON", () => {
    const out = serializeJsonLd({
      headline: '</script><script>alert(1)</script>',
    });
    expect(out).not.toContain("</script>");
    expect(out).toContain("\\u003c/script\\u003e");
    // Semantically identical when parsed back.
    expect(JSON.parse(out)).toEqual({
      headline: "</script><script>alert(1)</script>",
    });
  });

  it("escapes &, <, > and line separators", () => {
    const out = serializeJsonLd({ v: "a&b<c>d\u2028e\u2029" });
    const parsed = JSON.parse(out) as { v: string };
    expect(parsed.v).toBe("a&b<c>d\u2028e\u2029");
    expect(out).not.toMatch(/&(?!amp;|lt;|gt;|#)/);
    expect(out).toContain("\\u0026");
    expect(out).toContain("\\u2028");
  });
});
