"use client";

import { useState } from "react";
import type { AnalyticsSettingsState, VerifyResponse } from "@/lib/analytics/reports";
import type { AnalyticsConfig } from "@/lib/content/types";

const inputClass =
  "w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted/60 focus:border-brand";

interface Initial {
  analytics: AnalyticsConfig;
  /** Public state as resolved on the server, for the status strip. */
  state: AnalyticsSettingsState;
}

/**
 * Connect / disconnect analytics.
 *
 * Written for a non-technical writer: pick the provider, paste the two public
 * values, save, then press one button that says whether it actually works. The
 * server-side key is never asked for here — it lives in the deployment's
 * environment, is never written to the content repo, and is reported as
 * present-or-missing rather than echoed back.
 */
export function AnalyticsSetupCard({ initial }: { initial: Initial }) {
  const [form, setForm] = useState<AnalyticsConfig>(initial.analytics);
  const [state, setState] = useState<AnalyticsSettingsState>(initial.state);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const [verify, setVerify] = useState<VerifyResponse | null>(null);

  const set = (patch: Partial<AnalyticsConfig>) => setForm((prev) => ({ ...prev, ...patch }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("saving");
    setMessage("");
    try {
      const res = await fetch("/api/admin/analytics/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analytics: form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed.");
      setState(data.analytics as AnalyticsSettingsState);
      setStatus("saved");
      setVerify(null);
      setTimeout(() => setStatus("idle"), 2500);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Save failed.");
    }
  };

  const testConnection = async () => {
    setMessage("");
    try {
      const res = await fetch("/api/admin/analytics/verify", { method: "POST" });
      const data = (await res.json()) as VerifyResponse;
      setVerify(data);
    } catch {
      setVerify({
        ok: false,
        health: null,
        error: { code: "unreachable", message: "Could not reach the test endpoint." },
      });
    }
  };

  return (
    <form onSubmit={save} className="max-w-2xl space-y-6">
      <section className="space-y-4 rounded-2xl border border-line bg-surface p-6">
        <div>
          <h2 className="font-serif text-lg font-semibold text-ink">Analytics provider</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            Ansora stores no visitor data itself. Connect a privacy-focused
            analytics service you control, and this panel reads its reports.
            Leave it off and your blog collects nothing at all.
          </p>
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-line px-3 py-3">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(event) => set({ enabled: event.target.checked })}
            className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]"
          />
          <span>
            <span className="block text-sm font-medium text-ink">
              Collect pageviews on the public site
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
              Adds one small script to public pages. Admin pages, the API and the
              markdown mirror are never tracked.
            </span>
          </span>
        </label>

        <div>
          <label htmlFor="analytics-provider" className="mb-1.5 block text-sm font-medium text-ink">
            Provider
          </label>
          <select
            id="analytics-provider"
            value={form.provider}
            onChange={(event) => set({ provider: event.target.value as AnalyticsConfig["provider"] })}
            className={inputClass}
          >
            <option value="none">None</option>
            <option value="umami">Umami (self-hosted or Cloud)</option>
          </select>
          <p className="mt-1 text-xs text-ink-muted">
            Umami is supported first because it is self-hostable and reports the
            per-page and referrer data this panel needs.
          </p>
        </div>

        <div>
          <label htmlFor="analytics-website" className="mb-1.5 block text-sm font-medium text-ink">
            Website ID
          </label>
          <input
            id="analytics-website"
            type="text"
            value={form.websiteId}
            onChange={(event) => set({ websiteId: event.target.value })}
            placeholder="8f2c1a4b-…"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-ink-muted">
            From the provider&apos;s website settings. This one is public — it
            ships to the browser with the tracker.
          </p>
        </div>

        <div>
          <label htmlFor="analytics-base" className="mb-1.5 block text-sm font-medium text-ink">
            Tracker URL
          </label>
          <input
            id="analytics-base"
            type="url"
            value={form.baseUrl}
            onChange={(event) => set({ baseUrl: event.target.value })}
            placeholder="https://analytics.example.com"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-ink-muted">
            Where your analytics instance is served. The tracker script is loaded
            from <code>/script.js</code> here.
          </p>
        </div>

        <div>
          <label htmlFor="analytics-report-base" className="mb-1.5 block text-sm font-medium text-ink">
            Reporting API base (optional)
          </label>
          <input
            id="analytics-report-base"
            type="url"
            value={form.reportBaseUrl}
            onChange={(event) => set({ reportBaseUrl: event.target.value })}
            placeholder="https://api.umami.is/v1"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-ink-muted">
            Only needed when the reporting API lives somewhere other than the
            tracker host, such as Umami Cloud.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <button
            type="submit"
            disabled={status === "saving"}
            className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-strong disabled:opacity-60"
          >
            {status === "saving" ? "Saving…" : "Save analytics settings"}
          </button>
          <button
            type="button"
            onClick={testConnection}
            className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand"
          >
            Test connection
          </button>
          {status === "saved" && (
            <span role="status" className="text-sm font-medium text-brand-strong">
              Saved ✓
            </span>
          )}
        </div>

        {message && (
          <p role="alert" className="rounded-lg border border-brand/30 bg-brand-soft px-3 py-2 text-sm text-brand-strong">
            {message}
          </p>
        )}
      </section>

      <section aria-label="Analytics status" className="space-y-3 rounded-2xl border border-line bg-surface p-6">
        <h2 className="font-serif text-lg font-semibold text-ink">Status</h2>
        <ul className="space-y-2 text-sm">
          <StatusRow
            ok={state.tracking}
            label="Browser tracking"
            detail={state.tracking ? `Tracker at ${state.scriptUrl}` : "Nothing is collected."}
          />
          <StatusRow
            ok={state.reporting}
            label="Server reporting"
            detail={
              state.reporting
                ? `Reading reports from ${state.apiBase}`
                : "Needs ANALYTICS_API_KEY in the deployment environment."
            }
          />
          <StatusRow
            ok={state.cspAllowsTracker || !state.tracking}
            label="Content-Security-Policy"
            detail={
              state.cspAllowsTracker || !state.tracking
                ? "The tracker host is allowed."
                : `Set ANALYTICS_SCRIPT_ORIGIN=${state.trackerOrigin} and rebuild — the browser's policy is compiled at build time, so a runtime-only value will not unblock the tracker.`
            }
          />
        </ul>

        {state.missing.length > 0 && (
          <p className="text-xs leading-relaxed text-ink-muted">
            Still needed: {state.missing.join(", ")}.
          </p>
        )}

        {verify && (
          <p
            role="status"
            className={`rounded-lg border px-3 py-2 text-sm ${
              verify.ok
                ? "border-line bg-surface-soft text-ink"
                : "border-brand/30 bg-brand-soft text-brand-strong"
            }`}
          >
            {verify.ok
              ? `Connection works${verify.health?.latencyMs !== null && verify.health?.latencyMs !== undefined ? ` (${verify.health.latencyMs} ms)` : ""}.`
              : `Connection failed: ${verify.error?.message ?? "unknown error"}`}
          </p>
        )}

        <div className="border-t border-line pt-3 text-xs leading-relaxed text-ink-muted">
          <p>
            Credentials belong in the deployment environment, never in
            <code> site.config.json</code> — that file is committed to git. Set{" "}
            <code>ANALYTICS_API_KEY</code> where your site runs, then reload this
            page.
          </p>
          <p className="mt-2">
            Retention, bot filtering and consent are the provider&apos;s
            responsibility. Self-hosting analytics does not by itself make a site
            compliant with every jurisdiction.
          </p>
        </div>
      </section>
    </form>
  );
}

function StatusRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        aria-hidden="true"
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ok ? "bg-brand" : "bg-ink-muted/50"}`}
      />
      <span>
        <span className="font-medium text-ink">
          {label}: {ok ? "ready" : "not ready"}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">{detail}</span>
      </span>
    </li>
  );
}
