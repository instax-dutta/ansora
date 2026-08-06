import { describe, expect, it } from "vitest";
import { EMPTY, PERFECT } from "./seo-score.fixtures";
import { computeSeoScore } from "./seo-score";
function checkById(score: ReturnType<typeof computeSeoScore>, id: string) {
  const check = score.checks.find((c) => c.id === id);
  if (!check) throw new Error(`no check with id "${id}"`);
  return check;
}

describe("computeSeoScore", () => {
  it("scores a fully-optimized post 100 with every check passing", () => {
    // Exact-score assertions pin the weight table — update both together if
    // the weights are ever tuned.
    const result = computeSeoScore(PERFECT);
    expect(result.score).toBe(100);
    for (const check of result.checks) {
      expect(check.passed, check.id).toBe(true);
    }
  });

  it("scores an empty input near zero (23 = only auto-passing checks)", () => {
    // The only checks an empty post can pass are negative checks (no H1, no
    // skipped headings, no images, short content, no FAQ requirement).
    const result = computeSeoScore(EMPTY);
    expect(result.score).toBe(23);
    expect(checkById(result, "title-present").passed).toBe(false);
    expect(checkById(result, "content-length").passed).toBe(false);
    expect(checkById(result, "no-h1-body").passed).toBe(true);
    expect(checkById(result, "image-alt").passed).toBe(true);
  });

  it("flags a keyword-less title and missing keyword checks", () => {
    const result = computeSeoScore({ ...PERFECT, focusKeyword: "" });
    expect(checkById(result, "kw-set").passed).toBe(false);
    expect(checkById(result, "kw-in-title").passed).toBe(false);
    expect(checkById(result, "kw-in-first100").passed).toBe(false);
    expect(checkById(result, "kw-in-heading").passed).toBe(false);
    expect(checkById(result, "kw-in-slug").passed).toBe(false);
    expect(result.score).toBeLessThan(100);
  });

  it("requires the keyword in the slug as the slugified form", () => {
    // "self hosting" → slug form "self-hosting"; the plain substring check
    // would fail, the slugified-inclusion check passes.
    const pass = computeSeoScore({ ...PERFECT, slug: "why-self-hosting" });
    expect(checkById(pass, "kw-in-slug").passed).toBe(true);

    const fail = computeSeoScore({ ...PERFECT, slug: "my-blog-post" });
    expect(checkById(fail, "kw-in-slug").passed).toBe(false);
  });

  it("checks title length range", () => {
    const short = computeSeoScore({ ...PERFECT, title: "Short" });
    expect(checkById(short, "title-length").passed).toBe(false);

    const long = computeSeoScore({
      ...PERFECT,
      title: "Self Hosting Your Blog on a Budget VPS in 2026: A Complete Guide for Independent Writers Everywhere",
    });
    expect(checkById(long, "title-length").passed).toBe(false);
  });

  it("checks meta description length (with excerpt fallback)", () => {
    const short = computeSeoScore({ ...PERFECT, excerpt: "Too short" });
    expect(checkById(short, "meta-length").passed).toBe(false);

    // An explicit metaDescription overrides the excerpt.
    const overridden = computeSeoScore({
      ...PERFECT,
      excerpt: "Too short",
      metaDescription: PERFECT.excerpt,
    });
    expect(checkById(overridden, "meta-length").passed).toBe(true);
  });

  it("flags an H1 in the body", () => {
    const result = computeSeoScore({
      ...PERFECT,
      content: "# Surprise H1\n\n" + PERFECT.content,
    });
    expect(checkById(result, "no-h1-body").passed).toBe(false);
  });

  it("flags skipped heading levels (h2 → h4)", () => {
    const result = computeSeoScore({
      ...PERFECT,
      content: "## Level two\n\n#### Level four\n\n" + PERFECT.content,
    });
    expect(checkById(result, "heading-hierarchy").passed).toBe(false);
  });

  it("flags thin content under 300 words", () => {
    const result = computeSeoScore({ ...PERFECT, content: "Just a tiny post." });
    expect(checkById(result, "content-length").passed).toBe(false);
  });

  it("flags long sentences on the readability check", () => {
    const result = computeSeoScore({
      ...PERFECT,
      content:
        "This is one extremely long run-on sentence that just keeps going and going without any punctuation to give the reader a chance to breathe which makes the average sentence length far too high for comfortable reading.",
    });
    expect(checkById(result, "readability").passed).toBe(false);
  });

  it("requires alt text on every image", () => {
    const result = computeSeoScore({
      ...PERFECT,
      content: PERFECT.content + "\n\n![](https://example.com/no-alt.png)",
    });
    expect(checkById(result, "image-alt").passed).toBe(false);
  });

  it("rejects teaser-style excerpts for the AEO check", () => {
    const inThisPost = computeSeoScore({
      ...PERFECT,
      excerpt: "In this post we'll explore self hosting in depth, step by step.",
    });
    expect(checkById(inThisPost, "excerpt-declarative").passed).toBe(false);

    const discover = computeSeoScore({
      ...PERFECT,
      excerpt: "Discover the easiest way to self host a blog on a VPS.",
    });
    expect(checkById(discover, "excerpt-declarative").passed).toBe(false);
  });

  it("wants an FAQ block on posts over 500 words", () => {
    const longContent = Array.from({ length: 60 }, (_, i) => `Paragraph ${i}: ` + PERFECT.content).join("\n\n");
    const withoutFaq = computeSeoScore({ ...PERFECT, content: longContent, faqCount: 0 });
    expect(checkById(withoutFaq, "faq-if-long").passed).toBe(false);

    const withFaq = computeSeoScore({ ...PERFECT, content: longContent, faqCount: 2 });
    expect(checkById(withFaq, "faq-if-long").passed).toBe(true);
  });
});
