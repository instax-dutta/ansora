"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

interface IndexItem {
  slug: string;
  url: string;
  title: string;
  summary: string;
  tags: string[];
  date: string;
}

interface SearchIndex {
  items: IndexItem[];
}

const STOP = new Set([
  "the", "a", "an", "and", "or", "of", "for", "to", "in", "on", "with", "is",
  "are", "was", "were", "be", "by", "at", "from", "as", "it", "its", "this",
  "that", "how", "what", "why", "when", "your", "you", "i",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+.#-]+/)
    .map((t) => t.replace(/^[.-]+|[.-]+$/g, ""))
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/**
 * Client-side search.
 *
 * No database and no hosted service: the index is a static JSON route built
 * from the same git-backed content as everything else, so it cannot drift from
 * the published set and it never exposes a draft.
 *
 * Ranking is deliberately simple and explainable — every term must match, and
 * title matches outweigh tag and body matches — because an opaque relevance
 * score is worse than a predictable one when a reader can see their own query.
 */
export function SearchBox() {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<IndexItem[] | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Lazily fetch the index on first focus so ordinary visitors never pay for it.
  useEffect(() => {
    if (index !== null) return;
    let cancelled = false;
    void fetch("/search-index.json")
      .then((r) => r.json() as Promise<SearchIndex>)
      .then((data) => {
        if (!cancelled) setIndex(data.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setIndex([]);
      });
    return () => {
      cancelled = true;
    };
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !open) {
        const el = document.activeElement;
        const typing =
          el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
        if (!typing) {
          e.preventDefault();
          inputRef.current?.focus();
        }
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const results = useMemo(() => {
    const terms = tokenize(query);
    if (!index || terms.length === 0) return [];
    return index
      .map((item) => {
        const title = tokenize(item.title);
        const tags = item.tags.flatMap((t) => tokenize(t));
        const body = tokenize(item.summary);
        let score = 0;
        let all = true;
        for (const term of terms) {
          const inTitle = title.some((t) => t.startsWith(term));
          const inTag = tags.some((t) => t.startsWith(term));
          const inBody = body.some((t) => t.startsWith(term));
          if (!inTitle && !inTag && !inBody) {
            all = false;
            break;
          }
          if (inTitle) score += 3;
          if (inTag) score += 2;
          if (inBody) score += 1;
        }
        return { item, score, all };
      })
      .filter((r) => r.all)
      .sort((a, b) => b.score - a.score || b.item.date.localeCompare(a.item.date))
      .slice(0, 8)
      .map((r) => r.item);
  }, [index, query]);

  const showResults = open && query.trim().length > 0;

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor="site-search" className="sr-only">
        Search posts
      </label>
      <input
        id="site-search"
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="Search"
        autoComplete="off"
        className="w-28 rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none transition-all placeholder:text-ink-muted/70 focus:w-44 focus:border-brand sm:w-36 sm:focus:w-52"
      />

      {showResults && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-3rem))] overflow-hidden rounded-2xl border border-line bg-surface shadow-lg">
          {results.length === 0 ? (
            <p className="px-4 py-4 text-sm text-ink-muted">
              {index === null
                ? "Loading the index..."
                : `Nothing matches "${query.trim()}".`}
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {results.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={item.url}
                    onClick={() => {
                      setOpen(false);
                      setQuery("");
                    }}
                    className="block border-b border-line px-4 py-2.5 transition-colors last:border-b-0 hover:bg-surface-soft"
                  >
                    <span className="block text-sm font-medium leading-snug text-ink">
                      {item.title}
                    </span>
                    {item.summary && (
                      <span className="mt-0.5 line-clamp-2 block text-xs text-ink-muted">
                        {item.summary}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
