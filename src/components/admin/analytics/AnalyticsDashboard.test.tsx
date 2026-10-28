// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OverviewResponse, PagesResponse } from "@/lib/analytics/reports";
import { AnalyticsDashboard } from "./AnalyticsDashboard";

/**
 * The dashboard's honesty rules are what these tests protect:
 * - a metric the provider cannot report reads "not reported", never `0`;
 * - a provider outage keeps the last good numbers on screen and explains why;
 * - a chart is never the only representation of the numbers.
 */
function overviewResponse(overrides: Partial<OverviewResponse> = {}): OverviewResponse {
  return {
    configured: true,
    tracking: true,
    reporting: true,
    provider: "umami",
    missing: [],
    timezone: "Asia/Kolkata",
    query: {
      from: "2026-09-27",
      to: "2026-10-26",
      timezone: "Asia/Kolkata",
      granularity: "day",
      compareToPreviousPeriod: true,
    },
    overview: {
      pageviews: 1200,
      visitors: null,
      visits: 500,
      bounces: 100,
      engagementRate: 80,
      averageVisitDurationSeconds: 90,
      trend: [
        { date: "2026-10-25", pageviews: 600, visitors: null },
        { date: "2026-10-26", pageviews: 600, visitors: null },
      ],
      previousPeriod: { pageviews: 1000, visitors: null, visits: 400 },
      provider: "umami",
      fetchedAt: "2026-10-26T10:00:00.000Z",
    },
    degraded: null,
    ...overrides,
  };
}

function pagesResponse(overrides: Partial<PagesResponse> = {}): PagesResponse {
  return {
    configured: true,
    tracking: true,
    reporting: true,
    provider: "umami",
    missing: [],
    timezone: "Asia/Kolkata",
    query: {
      from: "2026-09-27",
      to: "2026-10-26",
      timezone: "Asia/Kolkata",
      granularity: "day",
      compareToPreviousPeriod: true,
    },
    rows: [
      {
        path: "/blog/self-hosting",
        pageviews: 900,
        visitors: null,
        change: 40,
        kind: "post",
        post: {
          slug: "self-hosting",
          title: "Self hosting",
          noIndex: false,
          updated: null,
        },
      },
      {
        path: "/blog/secret-draft",
        pageviews: 3,
        visitors: null,
        change: null,
        kind: "other",
        post: null,
      },
    ],
    total: 2,
    sources: [
      { key: "Direct / unknown", pageviews: 300 },
      { key: "news.ycombinator.com", pageviews: 100 },
    ],
    previousPeriod: { from: "2026-08-28", to: "2026-09-26" },
    opportunities: [
      {
        kind: "rising",
        slug: "self-hosting",
        title: "Self hosting",
        message: "Pageviews are up 40% versus the previous period (900 in this period).",
        href: "/admin/analytics/posts/self-hosting",
      },
    ],
    degraded: null,
    ...overrides,
  };
}

function stubFetch(overview: OverviewResponse, pages: PagesResponse) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.includes("/pages") ? pages : overview;
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("<AnalyticsDashboard />", () => {
  it("renders totals, the trend and the top content", async () => {
    stubFetch(overviewResponse(), pagesResponse());
    render(<AnalyticsDashboard timezone="Asia/Kolkata" />);

    // The title appears in the table and in the opportunities list.
    await waitFor(() => expect(screen.getAllByText("Self hosting").length).toBeGreaterThan(0));
    expect(screen.getAllByText("1,200").length).toBeGreaterThan(0);
    // The trend is also available as a table, not only as an SVG.
    expect(screen.getAllByRole("table").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Direct / unknown")).toBeDefined();
  });

  it("shows 'not reported' instead of zero when a provider cannot measure a metric", async () => {
    stubFetch(overviewResponse(), pagesResponse());
    render(<AnalyticsDashboard timezone="Asia/Kolkata" />);

    await waitFor(() => expect(screen.getByText("Unique visitors")).toBeDefined());
    // visitors is null for this provider; it must not be rendered as 0.
    expect(screen.getAllByText("Not reported by this provider").length).toBeGreaterThan(0);
    expect(screen.queryByText("0%")).toBeNull();
  });

  it("never titles an unpublished path as a post", async () => {
    stubFetch(overviewResponse(), pagesResponse());
    render(<AnalyticsDashboard timezone="Asia/Kolkata" />);

    await waitFor(() => expect(screen.getByText("/blog/secret-draft")).toBeDefined());
    expect(screen.getByText("Other page")).toBeDefined();
    expect(screen.queryByText("Secret draft")).toBeNull();
  });

  it("surfaces opportunities with their reason", async () => {
    stubFetch(overviewResponse(), pagesResponse());
    render(<AnalyticsDashboard timezone="Asia/Kolkata" />);

    await waitFor(() => expect(screen.getByText("Rising")).toBeDefined());
    expect(
      screen.getByText(/Pageviews are up 40% versus the previous period/)
    ).toBeDefined();
  });

  it("keeps the last good numbers and explains a provider outage", async () => {
    const fetchMock = stubFetch(overviewResponse(), pagesResponse());
    const first = render(<AnalyticsDashboard timezone="Asia/Kolkata" />);
    await waitFor(() => expect(screen.getAllByText("1,200").length).toBeGreaterThan(0));

    // Second load: the provider rejects the credentials.
    fetchMock.mockImplementation(async (input: RequestInfo | URL) =>
      new Response(
        JSON.stringify(
          String(input).includes("/pages")
            ? pagesResponse({ rows: [], sources: [], opportunities: [], degraded: { code: "unauthorized", message: "The analytics provider rejected the credentials (HTTP 401)." } })
            : overviewResponse({ overview: null, degraded: { code: "unauthorized", message: "The analytics provider rejected the credentials (HTTP 401)." } })
        ),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    await userEvent.click(screen.getByRole("button", { name: "90 days" }));

    await waitFor(() =>
      expect(screen.getByText(/Could not refresh from the provider/)).toBeDefined()
    );
    // The previous numbers are still on screen, not replaced by zeros.
    expect(screen.getAllByText("1,200").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Retry" })).toBeDefined();
    first.unmount();
  });

  it("explains an unconfigured integration without pretending there is data", async () => {
    stubFetch(
      overviewResponse({ configured: false, reporting: false, overview: null }),
      pagesResponse({ configured: false, reporting: false, rows: [], sources: [], opportunities: [] })
    );
    render(<AnalyticsDashboard timezone="Asia/Kolkata" />);

    await waitFor(() =>
      expect(screen.getByText(/Analytics is not fully configured yet/)).toBeDefined()
    );
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("offers a CSV export link for the current period", async () => {
    stubFetch(overviewResponse(), pagesResponse());
    render(<AnalyticsDashboard timezone="Asia/Kolkata" />);

    await waitFor(() => expect(screen.getByText("Export CSV")).toBeDefined());
    const href = screen.getByText("Export CSV").getAttribute("href") ?? "";
    expect(href).toContain("/api/admin/analytics/pages?");
    expect(href).toContain("format=csv");
    expect(href).toContain("timezone=Asia%2FKolkata");
  });
});
