import Link from "next/link";
import type { Opportunity, OpportunityKind } from "@/lib/analytics/opportunities";

const KIND_LABELS: Record<OpportunityKind, string> = {
  noindex: "Not in search",
  rising: "Rising",
  declining: "Declining",
  unmeasured: "Not enough data",
  stale: "Review",
};

/**
 * Evidence-backed next steps.
 *
 * Every entry names the post, the observation, and the reason, and links to the
 * report that produced it. Nothing here claims that changing a title would add
 * traffic — the numbers are the argument, the author makes the decision.
 */
export function OpportunityList({ opportunities }: { opportunities: Opportunity[] }) {
  if (opportunities.length === 0) {
    return (
      <section aria-label="What to do next" className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-serif text-lg font-semibold text-ink">What to do next</h2>
        <p className="mt-3 text-sm text-ink-muted">
          Nothing stands out in this period. Posts need a real sample before a
          trend means anything, so quiet numbers are reported as quiet, not as
          failure.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="What to do next" className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="font-serif text-lg font-semibold text-ink">What to do next</h2>
      <ul className="mt-4 space-y-3">
        {opportunities.map((opportunity) => (
          <li key={`${opportunity.kind}-${opportunity.slug}`}>
            <Link
              href={opportunity.href}
              className="block rounded-xl border border-line px-3 py-2.5 transition-colors hover:border-line-strong hover:bg-surface-soft/50"
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-strong">
                  {KIND_LABELS[opportunity.kind]}
                </span>
                <span className="min-w-0 truncate text-sm font-medium text-ink">
                  {opportunity.title}
                </span>
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-ink-muted">
                {opportunity.message}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
