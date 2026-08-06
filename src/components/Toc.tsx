import type { TocItem } from "@/lib/markdown/pipeline";

export function Toc({ items }: { items: TocItem[] }) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Table of contents" className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
        On this page
      </p>
      <ul className="mt-3 space-y-2 border-l border-line pl-4 text-sm">
        {items.map((item) => (
          <li
            key={item.id}
            className={item.level === 3 ? "pl-4" : ""}
          >
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
