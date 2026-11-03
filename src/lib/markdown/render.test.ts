import { describe, expect, it } from "vitest";
import { renderMarkdown, renderMarkdownWithToc } from "./render";

describe("renderMarkdownWithToc", () => {
  it("returns the HTML and the heading outline from one pass", async () => {
    const markdown = [
      "## First section",
      "",
      "Body text.",
      "",
      "### Nested point",
      "",
      "```js",
      "const x = 1;",
      "```",
    ].join("\n");

    const { html, toc } = await renderMarkdownWithToc(markdown);

    expect(html).toContain('<h2 id="first-section"');
    expect(html).toContain('<h3 id="nested-point"');
    expect(toc).toEqual([
      { id: "first-section", text: "First section", level: 2 },
      { id: "nested-point", text: "Nested point", level: 3 },
    ]);
  });

  it("does not include the autolink marker in heading text", async () => {
    const { toc } = await renderMarkdownWithToc("## Hello World");
    expect(toc).toEqual([{ id: "hello-world", text: "Hello World", level: 2 }]);
    expect(toc[0].text).not.toContain("#");
  });

  it("still renders plain HTML through renderMarkdown", async () => {
    const html = await renderMarkdown("**bold**");
    expect(html).toContain("<strong>bold</strong>");
  });
});
