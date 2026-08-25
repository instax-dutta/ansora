"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Live markdown preview for the admin editor.
 *
 * Renders through POST /api/admin/preview — i.e. the exact same server
 * pipeline (src/lib/markdown/render.ts) the public site uses, so the preview
 * is byte-identical to shipped output by construction. react-markdown cannot
 * host this pipeline: it runs unified synchronously (runSync), which breaks
 * on async plugins like rehype-pretty-code/Shiki (see the route's comment).
 *
 * The HTML is produced entirely by our own renderer (same sanitization and
 * link/image handling as every public page), not from user-supplied markup.
 */
const DEBOUNCE_MS = 350;

export function MarkdownPreview({ markdown }: { markdown: string }) {
  const [html, setHtml] = useState("");
  const [error, setError] = useState(false);
  const requestIdRef = useRef(0);
  const isEmpty = !markdown.trim();

  useEffect(() => {
    if (!markdown.trim()) return;
    const id = ++requestIdRef.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/admin/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markdown }),
        });
        // Ignore stale responses (fast typists outrun earlier requests).
        if (requestIdRef.current !== id) return;
        if (!res.ok) throw new Error(`Preview failed (${res.status})`);
        const data = (await res.json()) as { html: string };
        setHtml(data.html);
        setError(false);
      } catch {
        if (requestIdRef.current === id) setError(true);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [markdown]);

  return (
    <div
      aria-live="polite"
      aria-busy={!html && !error && !!markdown.trim()}
      className="prose prose-warm max-w-none text-[1rem] leading-7"
    >
      {!isEmpty ? (
        error ? (
          <p role="alert" className="text-brand-strong">
            Preview unavailable — retrying on your next edit.
          </p>
        ) : html ? (
          <div dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <p className="text-ink-muted italic">Rendering preview…</p>
        )
      ) : (
        <p className="text-ink-muted italic">Nothing to preview yet — start writing.</p>
      )}
    </div>
  );
}
