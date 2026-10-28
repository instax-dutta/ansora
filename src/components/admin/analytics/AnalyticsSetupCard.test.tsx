// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnalyticsSettingsState } from "@/lib/analytics/reports";
import { AnalyticsSetupCard } from "./AnalyticsSetupCard";

/**
 * The setup panel is the only place a non-technical writer meets this feature,
 * so the tests are about what it says and what it refuses to ask for.
 */
const EMPTY_CONFIG = {
  enabled: false,
  provider: "none" as const,
  websiteId: "",
  baseUrl: "",
  reportBaseUrl: "",
};

function state(overrides: Partial<AnalyticsSettingsState> = {}): AnalyticsSettingsState {
  return {
    provider: "none",
    enabled: false,
    websiteId: "",
    baseUrl: "",
    reportBaseUrl: "",
    tracking: false,
    reporting: false,
    missing: ["a provider", "a website ID", "a tracker URL", "ANALYTICS_API_KEY"],
    scriptUrl: "",
    apiBase: null,
    trackerOrigin: null,
    cspAllowsTracker: true,
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("<AnalyticsSetupCard />", () => {
  it("explains what is collected and where it lives, without asking for a secret", () => {
    render(<AnalyticsSetupCard initial={{ analytics: EMPTY_CONFIG, state: state() }} />);
    expect(screen.getByText(/Ansora stores no visitor data itself/)).toBeDefined();
    // The API key belongs in the deployment environment, not a form here.
    expect(screen.queryByLabelText(/API key/i)).toBeNull();
    // Named in the status strip and in the guidance below it.
    expect(screen.getAllByText(/ANALYTICS_API_KEY/).length).toBeGreaterThan(0);
  });

  it("offers the supported provider and defaults to collecting nothing", () => {
    render(<AnalyticsSetupCard initial={{ analytics: EMPTY_CONFIG, state: state() }} />);
    const toggle = screen.getByRole("checkbox") as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    const select = screen.getByLabelText("Provider") as HTMLSelectElement;
    expect(select.value).toBe("none");
    expect(screen.getByRole("option", { name: /Umami/ })).toBeDefined();
  });

  it("saves the public settings to the analytics config endpoint", async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { analytics: Record<string, unknown> };
      expect(body.analytics).toMatchObject({ provider: "umami", websiteId: "site-1" });
      // A credential must never be part of this payload.
      expect(JSON.stringify(body)).not.toContain("API_KEY");
      return new Response(
        JSON.stringify({
          ok: true,
          analytics: state({
            provider: "umami",
            enabled: true,
            websiteId: "site-1",
            baseUrl: "https://analytics.example.com",
            tracking: true,
            reporting: false,
            missing: ["ANALYTICS_API_KEY"],
            scriptUrl: "https://analytics.example.com/script.js",
            apiBase: "https://analytics.example.com/api",
            trackerOrigin: "https://analytics.example.com",
          }),
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AnalyticsSetupCard initial={{ analytics: EMPTY_CONFIG, state: state() }} />);
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.selectOptions(screen.getByLabelText("Provider"), "umami");
    await userEvent.type(screen.getByLabelText("Website ID"), "site-1");
    await userEvent.type(screen.getByLabelText("Tracker URL"), "https://analytics.example.com");
    await userEvent.click(screen.getByRole("button", { name: /Save analytics settings/ }));

    await waitFor(() => expect(screen.getByText("Saved ✓")).toBeDefined());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/analytics/config",
      expect.objectContaining({ method: "PUT" })
    );
    // Collection is on, reporting is not: the panel says so explicitly.
    await waitFor(() =>
      expect(screen.getByText(/Browser tracking: ready/)).toBeDefined()
    );
    expect(screen.getByText(/Server reporting: not ready/)).toBeDefined();
  });

  it("warns when the Content-Security-Policy would block the tracker", () => {
    render(
      <AnalyticsSetupCard
        initial={{
          analytics: {
            enabled: true,
            provider: "umami",
            websiteId: "site-1",
            baseUrl: "https://analytics.example.com",
            reportBaseUrl: "",
          },
          state: state({
            provider: "umami",
            enabled: true,
            tracking: true,
            websiteId: "site-1",
            baseUrl: "https://analytics.example.com",
            scriptUrl: "https://analytics.example.com/script.js",
            trackerOrigin: "https://analytics.example.com",
            cspAllowsTracker: false,
          }),
        }}
      />
    );
    expect(screen.getByText(/ANALYTICS_SCRIPT_ORIGIN/)).toBeDefined();
  });

  it("surfaces a save failure instead of silently pretending it worked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "Invalid analytics settings." }), {
            status: 400,
            headers: { "content-type": "application/json" },
          })
      )
    );

    render(<AnalyticsSetupCard initial={{ analytics: EMPTY_CONFIG, state: state() }} />);
    await userEvent.click(screen.getByRole("button", { name: /Save analytics settings/ }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.queryByText("Saved ✓")).toBeNull();
  });
});
