"use client";

/**
 * ImageDialog — insert an image into the post via Markdown, with real
 * alt-text guidance. Every image needs descriptive alt text: it feeds the
 * SEO scorer's `image-alt` check, accessibility, and screen readers.
 *
 * Accessible modal: portal to <body>, focus trap, ESC/backdrop to close,
 * body scroll lock, focus restoration, ARIA dialog semantics.
 *
 * The form state lives in ImageDialogBody, which only mounts while the dialog
 * is open — so it resets naturally on every open (no setState-in-effect).
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface ImageDialogProps {
  open: boolean;
  onClose: () => void;
  /** Prefill from the current textarea selection, if any. */
  initialUrl: string;
  initialAlt: string;
  /** Passed through so the dialog can suggest weaving it into alt text. */
  focusKeyword: string;
  onInsert: (url: string, alt: string, title: string) => void;
}

const URL_PATTERN = /^(https?:\/\/|\/|\.\/|\.\.\/)/i;

function altHint(alt: string, focusKeyword: string): {
  tone: "error" | "warn" | "ok";
  message: string;
} {
  const text = alt.trim();
  if (!text) {
    return {
      tone: "error",
      message:
        "Missing alt text — the image-alt SEO check will fail, and screen-reader users get nothing.",
    };
  }
  if (text.length < 12) {
    return {
      tone: "warn",
      message: "A bit thin — describe what's actually in the image.",
    };
  }
  const kw = focusKeyword.trim();
  if (kw && !text.toLowerCase().includes(kw.toLowerCase())) {
    return {
      tone: "ok",
      message: `Good and descriptive. Natural next step: weave “${kw}” in if it fits.`,
    };
  }
  return { tone: "ok", message: "Descriptive alt text — this helps SEO and accessibility." };
}

export function ImageDialog(props: ImageDialogProps) {
  if (!props.open) return null;
  return <ImageDialogBody key="open" {...props} />;
}

function ImageDialogBody({
  onClose,
  initialUrl,
  initialAlt,
  focusKeyword,
  onInsert,
}: ImageDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const [url, setUrl] = useState(initialUrl);
  const [alt, setAlt] = useState(initialAlt);
  const [title, setTitle] = useState("");
  const [imgError, setImgError] = useState(false);

  // Focus the URL field; restore focus to the trigger button on close.
  useEffect(() => {
    openerRef.current = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => urlRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      openerRef.current?.focus?.();
    };
  }, []);

  // ESC to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Focus trap: wrap Tab between the first and last focusable elements.
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onTab);
    return () => document.removeEventListener("keydown", onTab);
  }, []);

  // Scroll lock while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = url.trim();
    if (!cleanUrl || !URL_PATTERN.test(cleanUrl)) return;
    onInsert(
      cleanUrl,
      alt.replace(/[\]]/g, " ").replace(/\s+/g, " ").trim(),
      title.trim().replace(/"/g, "'")
    );
    onClose();
  };

  const urlValid = URL_PATTERN.test(url.trim());
  const hint = altHint(alt, focusKeyword);
  const snippet = `![${alt.trim() || "alt text"}](${url.trim() || "https://…"}${
    title.trim() ? ` "${title.trim()}"` : ""
  })`;
  const canPreview = /^https?:\/\//i.test(url.trim());

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-dialog-title"
      aria-describedby="image-dialog-desc"
    >
      {/* Backdrop */}
      <div
        className="animate-backdrop-in absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className="animate-modal-in relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl shadow-black/20"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 id="image-dialog-title" className="font-serif text-lg font-semibold text-ink">
            Insert image
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 px-5 py-4">
          <p id="image-dialog-desc" className="text-xs leading-relaxed text-ink-muted">
            Inserts Markdown at the cursor. Images are hosted externally — paste a
            public URL.
          </p>

          {/* URL */}
          <div>
            <label htmlFor="image-url" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Image URL
            </label>
            <input
              id="image-url"
              ref={urlRef}
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setImgError(false); // a corrected URL should re-attempt preview
              }}
              placeholder="https://example.com/photo.jpg"
              className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted/60 focus:border-brand"
            />
            {url.trim() && !urlValid && (
              <p className="mt-1 text-xs text-brand">
                URL must start with http(s):// or a /-relative path.
              </p>
            )}
          </div>

          {/* Alt text with guidance */}
          <div>
            <label htmlFor="image-alt" className="mb-1 flex items-baseline justify-between text-xs font-semibold uppercase tracking-wider text-ink-muted">
              <span>Alt text</span>
              <span className="font-normal normal-case tracking-normal text-ink-muted/70">
                {alt.trim().length} chars
              </span>
            </label>
            <textarea
              id="image-alt"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              rows={2}
              placeholder="A descriptive sentence about the image…"
              className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted/60 focus:border-brand"
            />
            <p
              className={`mt-1 text-xs ${
                hint.tone === "error"
                  ? "font-medium text-brand"
                  : hint.tone === "warn"
                    ? "text-brand"
                    : "text-ink-muted"
              }`}
            >
              {hint.message}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted/80">
              Screen readers announce alt text in place of the image. Say what the
              image shows and why it’s on the page — skip “image of…”, “photo of…”.
            </p>
          </div>

          {/* Optional title */}
          <div>
            <label htmlFor="image-title" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Title <span className="font-normal normal-case tracking-normal text-ink-muted/70">(optional tooltip)</span>
            </label>
            <input
              id="image-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. A diagram of the deploy pipeline"
              className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted/60 focus:border-brand"
            />
          </div>

          {/* Live preview */}
          <div className="rounded-xl border border-line bg-surface-soft/50 p-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Preview
            </p>
            {canPreview && !imgError ? (
              // eslint-disable-next-line @next/next/no-img-element -- arbitrary external URLs
              <img
                src={url.trim()}
                alt={alt.trim() || "Image preview"}
                onError={() => setImgError(true)}
                className="mb-2 max-h-32 w-full rounded-lg border border-line object-cover"
              />
            ) : null}
            <code className="block overflow-x-auto whitespace-pre rounded-md bg-paper px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-ink">
              {snippet}
            </code>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!url.trim() || !urlValid}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-strong disabled:opacity-50"
            >
              Insert image
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
