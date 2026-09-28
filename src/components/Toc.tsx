import type { TocItem } from "@/lib/markdown/pipeline";

/**
 * Table of contents built from the same heading ids `rehype-slug` generates at
 * render time, so every anchor resolves.
 *
 * Two variants: the sidebar card, and `embedded` for the mobile disclosure
 * (already wrapped in a bordered container by the caller, so it renders bare).
 */
export function Toc({
  items,
  variant = "card",
}: {
  items: TocItem[];
  variant?: "card" | "embedded";
}) {
  if (items.length === 0) return null;

  if (variant === "embedded") {
    return (
      <ul className="space-y-2 text-sm">
        {items.map((item) => (
          <li key={item.id} className={item.level === 3 ? "pl-4" : ""}>
            <a
              href={`#${item.id}`}
              className="text-ink-muted transition-colors hover:text-brand"
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <nav
      aria-label="Table of contents"
      className="rounded-2xl border border-line bg-surface p-5"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
        On this page
      </p>
      <ul className="mt-3 space-y-2 border-l border-line pl-4 text-sm">
        {items.map((item) => (
          <li key={item.id} className={item.level === 3 ? "pl-4" : ""}>
            <a
              href={`#${item.id}`}
              className="text-ink-muted transition-colors hover:text-brand"
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
