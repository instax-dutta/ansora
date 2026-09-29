import { describe, expect, it, vi } from "vitest";
import { normalizeFrontmatter, normalizeFrontmatterLoose } from "./types";

/**
 * The failure that took a live blog offline.
 *
 * A post had a field whose YAML type was not what the schema expected (YAML
 * turns `answer: 2026` into a number, `answer: yes` into a boolean). Strict
 * parsing threw inside `listPosts()`, `safeListPosts()` degraded to `[]`, and
 * every listing page rendered as an empty blog.
 *
 * The rule these tests lock in: **a read must never be taken down by bad data
 * in one post.** Strict validation stays on the write path, where rejecting bad
 * input is the point.
 */

vi.spyOn(console, "warn").mockImplementation(() => {});

describe("normalizeFrontmatterLoose", () => {
  it("keeps every other post's data when one field has the wrong type", () => {
    const raw = {
      title: "A real post",
      slug: "a-real-post",
      date: "2026-01-01",
      excerpt: "A summary.",
      published: true,
      // YAML typed these as number/boolean, zod wanted string.
      answer: 2026,
      updatedReason: true,
    };
    const { meta } = normalizeFrontmatterLoose(raw, "a-real-post");
    // The post survives...
    expect(meta.title).toBe("A real post");
    expect(meta.published).toBe(true);
    // ...with only the bad fields defaulted.
    expect(meta.answer).toBe("");
    expect(meta.updatedReason).toBe("");
  });

  it("never throws on any single-field type confusion", () => {
    for (const bad of [2026, true, null, [], {}, 0, false]) {
      expect(() =>
        normalizeFrontmatterLoose(
          { title: "T", slug: "t", answer: bad },
          "t"
        )
      ).not.toThrow();
    }
  });

  it("never throws when a nested object is the wrong shape", () => {
    // `seo` failing wholesale must not fail the post; the whole block falls
    // back to defaults so the post still publishes with a real title.
    const { meta } = normalizeFrontmatterLoose(
      { title: "T", slug: "t", seo: "nonsense" },
      "t"
    );
    expect(meta.title).toBe("T");
    expect(meta.seo.noIndex).toBe(false);
  });

  it("never throws on a malformed list field", () => {
    const { meta } = normalizeFrontmatterLoose(
      { title: "T", slug: "t", takeaways: "should be a list", faq: "nope" },
      "t"
    );
    expect(meta.title).toBe("T");
    expect(meta.takeaways).toEqual([]);
    expect(meta.faq).toEqual([]);
  });

  it("reports the offending field so an author can fix it", () => {
    const { problems } = normalizeFrontmatterLoose(
      { title: "T", slug: "t", answer: 2026 },
      "the-bad-post"
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].field).toBe("answer");
    expect(problems[0].issue).toBeTruthy();
  });

  it("preserves a real Date from gray-matter", () => {
    const { meta } = normalizeFrontmatterLoose(
      { title: "T", slug: "t", date: new Date("2026-05-05T00:00:00Z") },
      "t"
    );
    expect(meta.date).toBe("2026-05-05T00:00:00.000Z");
  });

  it("returns no problems for valid frontmatter", () => {
    const { problems, meta } = normalizeFrontmatterLoose(
      { title: "T", slug: "t", date: "2026-01-01", published: true },
      "t"
    );
    expect(problems).toEqual([]);
    expect(meta.title).toBe("T");
  });

  it("ignores unknown keys instead of failing", () => {
    const { meta, problems } = normalizeFrontmatterLoose(
      { title: "T", slug: "t", someFutureField: { anything: true } },
      "t"
    );
    expect(meta.title).toBe("T");
    expect(problems).toEqual([]);
  });
});

describe("normalizeFrontmatter stays strict for writes", () => {
  it("throws on a bad field", () => {
    // The write path must keep rejecting bad input - that is its job.
    expect(() =>
      normalizeFrontmatter({ title: "T", slug: "t", answer: 2026 })
    ).toThrow();
  });

  it("throws on a missing or wrongly-typed field", () => {
    // Every schema field has a default, so "missing" is fine; a wrong *type*
    // is the thing the write path must reject.
    expect(() => normalizeFrontmatter({ slug: "t" })).not.toThrow();
    expect(() =>
      normalizeFrontmatter({ title: "T", slug: "t", answer: 2026 })
    ).toThrow();
    expect(() =>
      normalizeFrontmatter({ title: "T", slug: "t", seo: "nonsense" })
    ).toThrow();
  });
});
