"use client";

import { useState } from "react";
import type { SiteConfig } from "@/lib/content/types";

const inputClass =
  "w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted/60 focus:border-brand";

export function SettingsForm({ initial }: { initial: SiteConfig }) {
  const [config, setConfig] = useState<SiteConfig>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  const set = (patch: Partial<SiteConfig>) => setConfig((prev) => ({ ...prev, ...patch }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("saving");
    setError("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Save failed.");
      }
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2500);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Save failed.");
    }
  };

  return (
    <form onSubmit={save} className="max-w-2xl space-y-6">
      <section className="space-y-4 rounded-2xl border border-line bg-surface p-6">
        <h2 className="font-serif text-lg font-semibold text-ink">Site</h2>

        <div>
          <label htmlFor="site-title" className="mb-1.5 block text-sm font-medium text-ink">
            Site title
          </label>
          <input
            id="site-title"
            type="text"
            value={config.title}
            onChange={(e) => set({ title: e.target.value })}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="site-description" className="mb-1.5 block text-sm font-medium text-ink">
            Description
          </label>
          <textarea
            id="site-description"
            value={config.description}
            onChange={(e) => set({ description: e.target.value })}
            rows={3}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="site-base-url" className="mb-1.5 block text-sm font-medium text-ink">
            Base URL
          </label>
          <input
            id="site-base-url"
            type="url"
            value={config.baseUrl}
            onChange={(e) => set({ baseUrl: e.target.value })}
            placeholder="https://yourdomain.com"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-ink-muted">
            Used for canonical URLs, sitemap, RSS and Open Graph tags.
          </p>
        </div>

        <div>
          <label htmlFor="site-author" className="mb-1.5 block text-sm font-medium text-ink">
            Author name
          </label>
          <input
            id="site-author"
            type="text"
            value={config.author}
            onChange={(e) => set({ author: e.target.value })}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-ink-muted">
            Used in BlogPosting schema and post bylines.
          </p>
        </div>

        <div>
          <label htmlFor="site-og-image" className="mb-1.5 block text-sm font-medium text-ink">
            Default Open Graph image URL
          </label>
          <input
            id="site-og-image"
            type="url"
            value={config.defaultOgImage}
            onChange={(e) => set({ defaultOgImage: e.target.value })}
            placeholder="https://…"
            className={inputClass}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-line bg-surface p-6">
        <h2 className="font-serif text-lg font-semibold text-ink">Social links</h2>
        <p className="text-sm text-ink-muted">Shown in the footer. Leave empty to hide.</p>
        {(
          [
            ["twitter", "Twitter / X"],
            ["github", "GitHub"],
            ["linkedin", "LinkedIn"],
          ] as const
        ).map(([key, label]) => (
          <div key={key}>
            <label htmlFor={`social-${key}`} className="mb-1.5 block text-sm font-medium text-ink">
              {label}
            </label>
            <input
              id={`social-${key}`}
              type="url"
              value={config.social[key]}
              onChange={(e) => set({ social: { ...config.social, [key]: e.target.value } })}
              placeholder="https://…"
              className={inputClass}
            />
          </div>
        ))}
      </section>

      {error && (
        <p role="alert" className="rounded-lg border border-brand-300 bg-brand-soft px-3 py-2 text-sm text-brand-strong">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === "saving"}
          className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-strong disabled:opacity-60"
        >
          {status === "saving" ? "Saving…" : "Save settings"}
        </button>
        {status === "saved" && (
          <span role="status" className="text-sm font-medium text-brand-strong">
            Saved ✓
          </span>
        )}
      </div>
    </form>
  );
}
