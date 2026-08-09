"use client";

import { useState } from "react";
import type { SiteConfig, ThemeConfig } from "@/lib/content/types";
import {
  ACCENT_SWATCHES,
  HEADING_FONT_LABELS,
  mix,
  RADIUS_LABELS,
  THEME_PRESETS,
  type HeadingFont,
  type RadiusStyle,
  type ThemePreset,
} from "@/lib/theme";

const inputClass =
  "w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted/60 focus:border-brand";

/** Small segmented button group (aria-pressed based). */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly [T, string][];
  onChange: (next: T) => void;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <div role="group" aria-label={label} className="flex overflow-hidden rounded-lg border border-line">
        {options.map(([key, text]) => (
          <button
            key={key}
            type="button"
            aria-pressed={value === key}
            onClick={() => onChange(key)}
            className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
              value === key
                ? "bg-brand text-on-brand"
                : "bg-surface text-ink-muted hover:bg-surface-soft hover:text-ink"
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SettingsForm({ initial }: { initial: SiteConfig }) {
  const [config, setConfig] = useState<SiteConfig>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  const set = (patch: Partial<SiteConfig>) => setConfig((prev) => ({ ...prev, ...patch }));
  const setTheme = (patch: Partial<ThemeConfig>) =>
    setConfig((prev) => ({ ...prev, theme: { ...prev.theme, ...patch } }));

  const preset = THEME_PRESETS[config.theme.preset] ?? THEME_PRESETS.warm;
  // The accent shown in the picker: a custom override, else the preset brand.
  const effectiveAccent = config.theme.accent || preset.light.brand;
  // The <input type="color"> needs a strict #rrggbb value at all times.
  const validAccent = /^#?[0-9a-f]{6}$/i.test(config.theme.accent)
    ? config.theme.accent
    : preset.light.brand;
  // Derived shades preview — mirrors resolveTheme's derivation so what the
  // admin sees is exactly what gets applied after saving.
  const derived =
    config.theme.accent && /^#?[0-9a-f]{6}$/i.test(config.theme.accent)
      ? {
          brand: config.theme.accent,
          strong: mix(config.theme.accent, "#000000", 0.22),
          soft: mix(config.theme.accent, "#ffffff", 0.82),
        }
      : { brand: preset.light.brand, strong: preset.light.brandStrong, soft: preset.light.brandSoft };

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

      <section className="space-y-5 rounded-2xl border border-line bg-surface p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-lg font-semibold text-ink">Appearance</h2>
          <button
            type="button"
            onClick={() =>
              setConfig((prev) => ({
                ...prev,
                theme: { preset: "warm", accent: "", radius: "soft", headingFont: "serif" },
              }))
            }
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink"
          >
            Reset to default
          </button>
        </div>
        <p className="text-sm text-ink-muted">
          Pick a style preset, then fine-tune it. Saves as a content commit and
          restyles the whole site (public + admin).
        </p>

        {/* Preset picker */}
        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink">Style preset</span>
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(THEME_PRESETS) as ThemePreset[]).map((id) => {
              const def = THEME_PRESETS[id];
              const selected = config.theme.preset === id;
              const p = def.light;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setTheme({ preset: id, accent: "" })}
                  className={`group rounded-xl border p-3 text-left transition-all ${
                    selected
                      ? "border-brand ring-1 ring-brand"
                      : "border-line hover:border-line-strong hover:bg-surface-soft/50"
                  }`}
                >
                  <span className="mb-2 flex items-center gap-1.5" aria-hidden="true">
                    <span className="h-4 w-4 rounded-full border border-line" style={{ background: p.paper }} />
                    <span className="h-4 w-4 rounded-full border border-line" style={{ background: p.surface }} />
                    <span className="h-4 w-4 rounded-full border border-line" style={{ background: p.ink }} />
                    <span className="h-4 w-4 rounded-full border border-line" style={{ background: p.brand }} />
                  </span>
                  <span className="block text-sm font-semibold text-ink">{def.label}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
                    {def.tagline}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Accent */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="theme-accent" className="mb-1.5 block text-sm font-medium text-ink">
              Accent color
            </label>
            <div className="flex items-center gap-2">
              <input
                id="theme-accent"
                type="color"
                value={validAccent}
                onChange={(e) => setTheme({ accent: e.target.value })}
                className="h-9 w-11 cursor-pointer rounded-lg border border-line bg-paper p-1"
                aria-label="Pick accent color"
              />
              <input
                id="theme-accent-hex"
                type="text"
                value={effectiveAccent}
                onChange={(e) => setTheme({ accent: e.target.value.trim() })}
                onBlur={(e) => {
                  // Normalize to a clean hex or fall back to the preset brand.
                  const v = e.target.value.trim();
                  const hex = /^#?[0-9a-f]{6}$/i.test(v) ? `#${v.replace("#", "").toLowerCase()}` : "";
                  setTheme({ accent: hex });
                }}
                placeholder={preset.light.brand}
                aria-label="Accent color as a hex value"
                className={inputClass}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ACCENT_SWATCHES.map((swatch) => (
                <button
                  key={swatch.hex}
                  type="button"
                  title={swatch.label}
                  aria-label={`Accent swatch: ${swatch.label} ${swatch.hex}`}
                  onClick={() => setTheme({ accent: swatch.hex })}
                  className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                    effectiveAccent.toLowerCase() === swatch.hex.toLowerCase()
                      ? "border-brand"
                      : "border-line hover:border-line-strong"
                  }`}
                  style={{ background: swatch.hex }}
                />
              ))}
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              Leave as the preset brand, or set any hex color.
            </p>
          </div>

          {/* Derived palette preview */}
          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink">Derived shades</span>
            <div className="flex items-center gap-1.5">
              {[
                ["brand", derived.brand],
                ["brand-strong", derived.strong],
                ["brand-soft", derived.soft],
              ].map(([label, color]) => (
                <span
                  key={label}
                  title={label as string}
                  className="h-8 w-8 rounded-lg border border-line"
                  style={{ background: color }}
                />
              ))}
              <span
                className="flex h-8 items-center rounded-lg border border-line px-2 text-xs font-bold"
                style={{ background: derived.brand, color: preset.light.onBrand }}
              >
                Aa
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              Light-mode sample — dark mode is derived automatically.
            </p>
          </div>
        </div>

        <Segmented<RadiusStyle>
          label="Corner radius"
          value={config.theme.radius}
          options={Object.entries(RADIUS_LABELS) as [RadiusStyle, string][]}
          onChange={(radius) => setTheme({ radius })}
        />

        <Segmented<HeadingFont>
          label="Heading font"
          value={config.theme.headingFont}
          options={Object.entries(HEADING_FONT_LABELS) as [HeadingFont, string][]}
          onChange={(headingFont) => setTheme({ headingFont })}
        />
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
        <p role="alert" className="rounded-lg border border-brand/30 bg-brand-soft px-3 py-2 text-sm text-brand-strong">
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
