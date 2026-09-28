"use client";

import { useMemo } from "react";
import type { PostMeta, SiteConfig } from "@/lib/content/types";
import { computeAeoScore, aeoToneFor, type AeoInput } from "@/lib/markdown/aeo-score";
import { computeSeoScore } from "@/lib/markdown/seo-score";
import { resolveSerp, resolveSocial, truncate } from "@/lib/seo/preview";

/**
 * The two scores, side by side.
 *
 * `computeSeoScore` answers "will this rank in classic search?".
 * `computeAeoScore` answers "will an answer engine quote this?". They are
 * reported together on purpose: a high traditional score does not imply a
 * citable post (keyword placement is worth little to a model, and keyword
 * stuffing actively hurts), so collapsing them into one number would hide the
 * most useful signal in the editor.
 */
export interface ScorePanelProps {
  meta: PostMeta;
  content: string;
  config: SiteConfig;
  faqCount: number;
}

function Ring({
  score,
  color,
  label,
  title,
}: {
  score: number;
  color: string;
  label: string;
  title: string;
}) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="flex items-center gap-3">
      <svg
        viewBox="0 0 64 64"
        className="h-14 w-14 shrink-0"
        role="img"
        aria-label={`${title}: ${score} out of 100`}
      >
        <circle cx="32" cy="32" r={radius} fill="none" strokeWidth="7" className="stroke-line" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * circumference} ${circumference}`}
          transform="rotate(-90 32 32)"
        />
        <text
          x="32"
          y="32"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="15"
          fontWeight="700"
          fill="currentColor"
          className="fill-ink"
        >
          {score}
        </text>
      </svg>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          {title}
        </p>
        <p className="truncate font-serif text-base font-semibold" style={{ color }}>
          {label}
        </p>
      </div>
    </div>
  );
}

function CheckList({
  checks,
}: {
  checks: { id: string; label: string; passed: boolean; hint: string }[];
}) {
  const failing = checks.filter((c) => !c.passed);
  const passing = checks.length - failing.length;
  return (
    <details className="rounded-xl border border-line bg-paper">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
        {passing}/{checks.length} passing
        {failing.length > 0 && (
          <span className="ml-2 text-ink-muted">- {failing.length} to fix</span>
        )}
      </summary>
      <ul className="space-y-2 border-t border-line px-4 py-3">
        {checks.map((check) => (
          <li key={check.id} className="flex items-start gap-2">
            <span
              aria-hidden="true"
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                check.passed
                  ? "bg-brand-soft text-brand-strong"
                  : "bg-surface-soft text-ink-muted"
              }`}
            >
              {check.passed ? "\u2713" : "\u2715"}
            </span>
            <div>
              <p className={`text-sm ${check.passed ? "text-ink" : "text-ink-muted"}`}>
                {check.label}
              </p>
              {!check.passed && check.hint && (
                <p className="mt-0.5 text-xs leading-relaxed text-ink-muted/90">
                  {check.hint}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function ScorePanel({ meta, content, config, faqCount }: ScorePanelProps) {
  const seo = useMemo(
    () =>
      computeSeoScore({
        title: meta.title,
        excerpt: meta.excerpt,
        focusKeyword: meta.focusKeyword,
        slug: meta.slug,
        content,
        metaDescription: meta.seo.metaDescription,
        faqCount,
      }),
    [meta, content, faqCount]
  );

  const aeoInput: AeoInput = useMemo(
    () => ({
      title: meta.title,
      excerpt: meta.excerpt,
      content,
      answer: meta.answer,
      takeaways: meta.takeaways,
      sources: meta.sources,
      focusKeyword: meta.focusKeyword,
    }),
    [meta, content]
  );
  const aeo = useMemo(() => computeAeoScore(aeoInput), [aeoInput]);

  const serp = useMemo(() => resolveSerp(meta, config), [meta, config]);
  const social = useMemo(() => resolveSocial(meta, config), [meta, config]);

  const seoTone =
    seo.score >= 80
      ? { color: "#3e9a5b", label: "Excellent" }
      : seo.score >= 50
        ? { color: "#c98a1b", label: "Getting there" }
        : { color: "#b3402e", label: "Needs work" };

  return (
    <section aria-label="SEO and citability scores" className="space-y-4 rounded-2xl border border-line bg-surface p-4">
      <div className="grid grid-cols-2 gap-3">
        <Ring
          score={seo.score}
          color={seoTone.color}
          label={seoTone.label}
          title="SEO"
        />
        <Ring
          score={aeo.score}
          color={aeoToneFor(aeo.score).color}
          label={aeoToneFor(aeo.score).label}
          title="Citable"
        />
      </div>

      <p className="text-xs leading-relaxed text-ink-muted">
        <span className="font-semibold text-ink">Citable</span> is not the same
        question as SEO. It measures whether an AI answer engine can lift a
        self-contained passage out of this post. Keyword placement barely moves
        it; sourcing, specific numbers and a direct answer move it a lot.
      </p>

      <CheckList checks={aeo.checks} />
      <CheckList checks={seo.checks} />

      {/* Live search-result preview, from the values that will actually ship */}
      <div className="rounded-xl border border-line bg-paper p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Search result preview
        </p>
        <p className="truncate text-xs text-ink-muted">{serp.url}</p>
        <p className="mt-1 text-lg leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">
          {serp.displayTitle}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">
          {truncate(serp.description, 160) || "No description set."}
        </p>
        {serp.titleTruncated && (
          <p className="mt-2 text-xs text-ink-muted">
            Title is longer than 60 characters, so search results will truncate
            it. The cut-off text above is what people will see.
          </p>
        )}
      </div>

      {/* Live social-card preview */}
      <div className="rounded-xl border border-line bg-paper p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Social card preview
        </p>
        {social.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={social.image}
            alt=""
            className="mb-3 aspect-[1.91/1] w-full rounded-lg border border-line object-cover"
          />
        ) : (
          <div className="mb-3 flex aspect-[1.91/1] w-full items-center justify-center rounded-lg border border-dashed border-line-strong text-xs text-ink-muted">
            No cover image
          </div>
        )}
        <p className="truncate text-xs uppercase text-ink-muted">{serp.siteName}</p>
        <p className="mt-0.5 font-medium leading-snug text-ink">
          {social.title || "Untitled"}
        </p>
        {social.description && (
          <p className="mt-1 line-clamp-2 text-sm text-ink-muted">
            {social.description}
          </p>
        )}
        {social.missingImage && (
          <p className="mt-2 text-xs text-ink-muted">
            Without a cover image this falls back to a small text-only card,
            which gets far fewer clicks. Adding a cover image URL is the single
            biggest social improvement available.
          </p>
        )}
      </div>
    </section>
  );
}
