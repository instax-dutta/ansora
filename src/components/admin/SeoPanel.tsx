"use client";

import { useMemo } from "react";
import { computeSeoScore } from "@/lib/markdown/seo-score";

export interface SeoPanelProps {
  title: string;
  excerpt: string;
  focusKeyword: string;
  slug: string;
  content: string;
  metaDescription: string;
  faqCount: number;
}

export function toneFor(score: number): { color: string; label: string } {
  if (score >= 80) return { color: "#3e9a5b", label: "Excellent" };
  if (score >= 50) return { color: "#c98a1b", label: "Getting there" };
  return { color: "#b3402e", label: "Needs work" };
}

export function SeoPanel(props: SeoPanelProps) {
  const result = useMemo(() => computeSeoScore(props), [props]);
  const { score, checks } = result;
  const tone = toneFor(score);
  const passed = checks.filter((c) => c.passed).length;
  const radius = 26;
  const circumference = 2 * Math.PI * radius;

  return (
    <section
      aria-label="SEO and AEO score"
      className="rounded-2xl border border-line bg-surface p-4"
    >
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 64 64" className="h-16 w-16 shrink-0" role="img" aria-label={`SEO score ${score} out of 100`}>
          <circle cx="32" cy="32" r={radius} fill="none" strokeWidth="7" className="stroke-line" />
          <circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            stroke={tone.color}
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
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            SEO / AEO score
          </p>
          <p className="font-serif text-lg font-semibold" style={{ color: tone.color }}>
            {tone.label}
          </p>
          <p className="text-xs text-ink-muted">
            {passed}/{checks.length} checks passing
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {checks.map((check) => (
          <li key={check.id}>
            <div className="flex items-start gap-2">
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  check.passed
                    ? "bg-brand-soft text-brand-strong"
                    : "bg-surface-soft text-ink-muted"
                }`}
              >
                {check.passed ? "✓" : "✕"}
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
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
