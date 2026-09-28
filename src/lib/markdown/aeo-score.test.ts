import { describe, expect, it } from "vitest";
import { computeAeoScore, type AeoInput } from "./aeo-score";

function input(over: Partial<AeoInput> = {}): AeoInput {
  return {
    title: "How self-hosting a blog works",
    excerpt: "Self-hosting means running the server yourself.",
    content: "",
    answer: "",
    takeaways: [],
    sources: [],
    focusKeyword: "",
    ...over,
  };
}

function checkIds(result: ReturnType<typeof computeAeoScore>) {
  return Object.fromEntries(result.checks.map((c) => [c.id, c.passed]));
}

const GOOD_ANSWER =
  "Self-hosting a blog means running the web server on hardware you control, so your posts live as plain files on your own disk rather than inside someone else's database. You keep the content, you keep the domain, and you decide when to move it.";

const SELF_CONTAINED =
  "A git-backed blog keeps every post as a plain markdown file inside a repository, which means a post can be read, edited, diffed and restored with tools that already exist on every developer machine. Because the storage format is text rather than a proprietary binary, the content outlives whatever served it, and a full backup is a single clone command rather than a vendor export. Nothing has to be running for the archive to stay readable, so the worst case is a site that is temporarily down rather than a blog that is gone. Recovery is cloning a repository and starting the process again, which usually takes minutes.";

const TABLE_ROW = "| Plan | Price | RAM |\n| --- | --- | --- |\n| Entry | $4.50 | 512 MB |";

const GOOD_BODY = [
  "Self-hosting a blog means running the server on hardware you control.",
  "",
  SELF_CONTAINED,
  "",
  "## What does it actually cost?",
  "",
  "A small VPS runs this comfortably for about $5 per month. According to the 2026 figures I measured across three providers, the median entry plan was $4.50 with 512 MB of RAM. We found the build step, not the runtime, was the expensive part.",
  "",
  "## Is it worth the maintenance?",
  "",
  TABLE_ROW,
].join("\n");

describe("computeAeoScore", () => {
  it("returns 0-100 and a non-empty checklist with real weights", () => {
    const result = computeAeoScore(input());
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.checks.length).toBeGreaterThan(8);
    const total = result.checks.reduce((s, c) => s + c.weight, 0);
    expect(total).toBeGreaterThan(50);
  });

  it("is deterministic", () => {
    const a = computeAeoScore(input({ content: GOOD_BODY }));
    const b = computeAeoScore(input({ content: GOOD_BODY }));
    expect(a.score).toBe(b.score);
  });

  it("rewards a direct answer", () => {
    const without = checkIds(computeAeoScore(input({ content: GOOD_BODY })));
    const with_ = checkIds(
      computeAeoScore(input({ content: GOOD_BODY, answer: GOOD_ANSWER }))
    );
    expect(without["answer-field"]).toBe(false);
    expect(with_["answer-field"]).toBe(true);
  });

  it("rejects a too-short answer rather than passing on any value", () => {
    expect(checkIds(computeAeoScore(input({ answer: "Yes." })))["answer-field"]).toBe(
      false
    );
  });

  it("rewards a self-contained passage and penalises a pronoun-heavy one", () => {
    const good = checkIds(computeAeoScore(input({ content: GOOD_BODY })));
    expect(good["self-contained"]).toBe(true);

    const vague = [
      "It is a thing that you can do. They will tell you that it works and this is why it is good for you when you are looking at it. We think that it is the way to go and you can do it too because they said so."
    ]
      .concat(Array(4).fill("Filler sentence that pads the length out to the band. "))
      .join("\n\n");
    expect(
      checkIds(computeAeoScore(input({ content: vague })))["self-contained"]
    ).toBe(false);
  });

  it("requires three takeaways, not one", () => {
    expect(
      checkIds(computeAeoScore(input({ takeaways: ["only one"] })))["takeaways"]
    ).toBe(false);
    expect(
      checkIds(
        computeAeoScore(input({ takeaways: ["a", "b", "c", "d"] }))
      )["takeaways"]
    ).toBe(true);
  });

  it("rewards a real source entry with a title or url", () => {
    expect(checkIds(computeAeoScore(input()))["sources"]).toBe(false);
    expect(
      checkIds(
        computeAeoScore(input({ sources: [{ title: "", url: "", author: "", year: "" }] }))
      )["sources"]
    ).toBe(false);
    expect(
      checkIds(
        computeAeoScore(
          input({ sources: [{ title: "A paper", url: "https://x.dev", author: "", year: "" }] })
        )
      )["sources"]
    ).toBe(true);
  });

  it("flags keyword stuffing as a liability, not a ranking factor", () => {
    const stuffed = `${"self hosting ".repeat(40)}\n\n${SELF_CONTAINED}`;
    const checks = checkIds(
      computeAeoScore(
        input({ content: stuffed, focusKeyword: "self hosting" })
      )
    );
    expect(checks["keyword-density"]).toBe(false);
  });

  it("treats natural keyword use as passing", () => {
    const natural = `${GOOD_BODY}\n\nOne more note on self hosting and its costs.`;
    expect(
      checkIds(
        computeAeoScore(input({ content: natural, focusKeyword: "self hosting" }))
      )["keyword-density"]
    ).toBe(true);
  });

  it("does not blow up on a regex-special focus keyword", () => {
    expect(() =>
      computeAeoScore(input({ content: "Body.", focusKeyword: "c++ (a.b)*" }))
    ).not.toThrow();
  });

  it("detects filler phrasing and dash-heavy rhythm", () => {
    const slop = "In today's fast-paced world, let's delve into it \u2014 it's crucial to note \u2014 that this matters. We think \u2014 really \u2014 it does. That is \u2014 the \u2014 point. Which \u2014 is \u2014 why \u2014 we \u2014 care.";
    expect(checkIds(computeAeoScore(input({ content: slop })))["no-flat-language"]).toBe(
      false
    );
  });

  it("ignores headings and dashes inside fenced code", () => {
    const codeOnly = "```js\n// a heading with a \u2014 dash\nconst x = 1;\n```";
    const checks = checkIds(computeAeoScore(input({ content: codeOnly })));
    // Code is stripped before the dash/heading heuristics run.
    expect(checks["no-flat-language"]).toBe(true);
  });

  it("scores a strong post above a weak one", () => {
    const strong = computeAeoScore(
      input({
        content: GOOD_BODY,
        answer: GOOD_ANSWER,
        takeaways: ["one", "two", "three"],
        sources: [{ title: "S", url: "https://x.dev", author: "", year: "" }],
        focusKeyword: "self hosting",
      })
    );
    const weak = computeAeoScore(input({ content: "Short and thin." }));
    expect(strong.score).toBeGreaterThan(weak.score + 30);
  });

  it("handles an entirely empty post without throwing", () => {
    const result = computeAeoScore(input());
    expect(Number.isFinite(result.score)).toBe(true);
  });
});
