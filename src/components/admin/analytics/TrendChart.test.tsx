// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrendChart } from "./TrendChart";

/**
 * A chart is a picture of numbers, and a picture is inaccessible on its own.
 * These tests hold the two promises: the SVG carries a sentence, and the same
 * numbers are always available as a real table.
 */
const POINTS = [
  { date: "2026-10-01", pageviews: 120, visitors: null },
  { date: "2026-10-02", pageviews: 480, visitors: null },
  { date: "2026-10-03", pageviews: 60, visitors: null },
];

describe("<TrendChart />", () => {
  it("describes the series in words for assistive technology", () => {
    render(<TrendChart points={POINTS} label="Pageviews" />);
    const chart = screen.getByRole("img");
    expect(chart.getAttribute("aria-label")).toContain("660 total across 3 buckets");
    expect(chart.getAttribute("aria-label")).toContain("peak 480 on 2026-10-02");
  });

  it("always offers the same numbers as a table, not only as a picture", () => {
    render(<TrendChart points={POINTS} label="Pageviews" />);
    expect(screen.getByRole("table")).toBeDefined();
    expect(screen.getByRole("rowheader", { name: "2026-10-02" })).toBeDefined();
    expect(screen.getByRole("cell", { name: "480" })).toBeDefined();
  });

  it("says there is no data rather than drawing an empty chart", () => {
    render(<TrendChart points={[]} label="Pageviews" />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("No pageviews recorded in this period.")).toBeDefined();
  });

  it("keeps hourly buckets readable", () => {
    render(
      <TrendChart
        points={[{ date: "2026-10-01T14:00", pageviews: 5, visitors: null }]}
        label="Pageviews per hour"
      />
    );
    expect(screen.getByRole("rowheader", { name: "2026-10-01 14:00" })).toBeDefined();
  });

  it("survives an all-zero series without dividing by zero", () => {
    render(
      <TrendChart
        points={[
          { date: "2026-10-01", pageviews: 0, visitors: null },
          { date: "2026-10-02", pageviews: 0, visitors: null },
        ]}
        label="Pageviews"
      />
    );
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("0 total");
  });
});
