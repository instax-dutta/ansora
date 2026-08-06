// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { computeSeoScore, type SeoInput } from "@/lib/markdown/seo-score";
import { EMPTY, PERFECT } from "@/lib/markdown/seo-score.fixtures";
import { SeoPanel, toneFor } from "./SeoPanel";

// Mirrors the panel's own ring math (radius 26).
const CIRCUMFERENCE = 2 * Math.PI * 26;

function renderPanel(props: SeoInput) {
  return render(<SeoPanel {...props} />);
}

describe("SeoPanel — structure & a11y", () => {
  it("exposes the panel and score ring with accessible names", () => {
    renderPanel(PERFECT);
    expect(
      screen.getByRole("region", { name: "SEO and AEO score" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "SEO score 100 out of 100" })
    ).toBeInTheDocument();
  });

  it("renders every check label", () => {
    renderPanel(PERFECT);
    for (const label of [
      "Focus keyword is set",
      "Title is 30–60 characters",
      "Focus keyword appears in the first 100 words",
      "Readable: sentences ≤ ~25 words, no 150+ word paragraphs",
      "FAQ block present (posts over 500 words)",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});

describe("SeoPanel — score, ring and tone", () => {
  it("shows 100 with the Excellent tone and every check passing", () => {
    renderPanel(PERFECT);
    // 100/18-pass is pinned by the scorer unit tests — the panel must reflect it.
    expect(computeSeoScore(PERFECT).score).toBe(100);

    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("Excellent")).toHaveStyle({ color: "#3e9a5b" });
    expect(screen.getByText("18/18 checks passing")).toBeInTheDocument();

    expect(screen.getAllByText("✓")).toHaveLength(18);
    expect(screen.queryByText("✕")).not.toBeInTheDocument();
    // No failed checks → no hints anywhere.
    expect(screen.queryByText("Add a title.")).not.toBeInTheDocument();
  });

  it("draws the ring at full proportion with the tone color", () => {
    renderPanel(PERFECT);
    // The progress arc is the only circle with a stroke-dasharray — no
    // position-based assumptions about the SVG's circle order.
    const progress = screen
      .getByRole("img", { name: "SEO score 100 out of 100" })
      .querySelector("circle[stroke-dasharray]");
    expect(progress).toHaveAttribute("stroke", "#3e9a5b");
    expect(progress).toHaveAttribute(
      "stroke-dasharray",
      `${CIRCUMFERENCE} ${CIRCUMFERENCE}`
    );
  });

  it("scores an empty post 23 with the Needs work tone and check feedback", () => {
    renderPanel(EMPTY);
    const result = computeSeoScore(EMPTY);
    expect(result.score).toBe(23); // pinned by the scorer unit tests
    const passed = result.checks.filter((c) => c.passed).length;

    expect(screen.getByText("23")).toBeInTheDocument();
    expect(screen.getByText("Needs work")).toHaveStyle({ color: "#b3402e" });
    expect(screen.getByText(`${passed}/18 checks passing`)).toBeInTheDocument();
    expect(screen.getByText("5/18 checks passing")).toBeInTheDocument();

    expect(screen.getAllByText("✓")).toHaveLength(5);
    expect(screen.getAllByText("✕")).toHaveLength(13);

    // Failed checks surface their hints…
    expect(screen.getByText("Add a title.")).toBeInTheDocument();
    expect(screen.getByText(/Current word count: 0\./)).toBeInTheDocument();
    // …but passing checks never show theirs.
    expect(screen.queryByText(/Remove H1 headings/)).not.toBeInTheDocument();
  });

  it("scales the ring proportion for a partial score", () => {
    const result = computeSeoScore(EMPTY);
    renderPanel(EMPTY);
    const progress = screen
      .getByRole("img")
      .querySelector("circle[stroke-dasharray]");
    expect(progress).toHaveAttribute(
      "stroke-dasharray",
      `${(result.score / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}`
    );
  });

  it("labels a mid-range score 'Getting there'", () => {
    // Dropping the focus keyword fails the 30-weight keyword group, landing
    // the score in the 50–79 band — assert the bracket, not a magic number.
    const mid: SeoInput = { ...PERFECT, focusKeyword: "" };
    const result = computeSeoScore(mid);
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.score).toBeLessThan(80);

    renderPanel(mid);
    expect(screen.getByText(String(result.score))).toBeInTheDocument();
    expect(screen.getByText("Getting there")).toHaveStyle({ color: "#c98a1b" });
    expect(
      screen.getByRole("img", { name: `SEO score ${result.score} out of 100` })
    ).toBeInTheDocument();
  });
});

describe("SeoPanel — tone boundaries", () => {
  it("maps the tone brackets at their exact edges", () => {
    expect(toneFor(80).label).toBe("Excellent");
    expect(toneFor(100).label).toBe("Excellent");
    expect(toneFor(79).label).toBe("Getting there");
    expect(toneFor(50).label).toBe("Getting there");
    expect(toneFor(49).label).toBe("Needs work");
    expect(toneFor(0).label).toBe("Needs work");
  });

  it("colors each tone consistently with its label", () => {
    expect(toneFor(100).color).toBe("#3e9a5b");
    expect(toneFor(70).color).toBe("#c98a1b");
    expect(toneFor(23).color).toBe("#b3402e");
  });
});
