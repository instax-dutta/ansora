"use client";

import Link from "next/link";
import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import type { Post, PostMeta } from "@/lib/content/types";
import { slugify } from "@/lib/utils";
import { ImageDialog } from "./ImageDialog";
import { SeoPanel } from "./SeoPanel";
import { ShortcutPanel } from "./ShortcutPanel";

interface EditorProps {
  post: Post | null;
}

function ToolbarButton({
  title,
  onClick,
  children,
  ...rest
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="rounded-md px-2 py-1 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface hover:text-ink"
      {...rest}
    >
      {children}
    </button>
  );
}

const IS_MAC =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.userAgent);
const MOD = IS_MAC ? "⌘" : "Ctrl";

const BLANK_META: PostMeta = {
  title: "",
  slug: "",
  date: new Date().toISOString(),
  excerpt: "",
  coverImage: "",
  tags: [],
  published: false,
  focusKeyword: "",
  seo: { metaTitle: "", metaDescription: "", canonicalUrl: "", noIndex: false },
  faq: [],
};

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-ink-muted/80">{hint}</p>}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted/60 focus:border-brand";
const textareaClass =
  "w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted/60 focus:border-brand";

export function PostEditor({ post }: EditorProps) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isNew = post === null;

  const [meta, setMeta] = useState<PostMeta>(() => post?.meta ?? BLANK_META);
  const [body, setBody] = useState(() => post?.content ?? "");
  const [slugEdited, setSlugEdited] = useState(() => !!post);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [dialogPrefill, setDialogPrefill] = useState({ url: "", alt: "" });
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const updateMeta = useCallback((patch: Partial<PostMeta>) => {
    setMeta((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  }, []);

  // The slug auto-follows the title until the author edits it manually.
  const derivedSlug =
    !slugEdited && meta.title.trim() ? slugify(meta.title) : "";
  const effectiveSlug = derivedSlug || meta.slug;

  /* ------------------------------ Toolbar -------------------------------- */

  const wrapSelection = (before: string, after: string, placeholder: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = body.slice(start, end) || placeholder;
    const next = body.slice(0, start) + before + selected + after + body.slice(end);
    setBody(next);
    setDirty(true);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const insertAtCursor = (text: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = body.slice(0, start) + text + body.slice(end);
    setBody(next);
    setDirty(true);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + text.length, start + text.length);
    });
  };

  /* --------------------------- Image dialog ----------------------------- */

  const openImageDialog = () => {
    const el = textareaRef.current;
    const sel = el ? body.slice(el.selectionStart, el.selectionEnd) : "";
    const trimmed = sel.trim();
    const looksLikeUrl = /^https?:\/\/\S+$/i.test(trimmed);
    setDialogPrefill({
      url: looksLikeUrl ? trimmed : "",
      alt: !looksLikeUrl && trimmed.length <= 80 ? trimmed : "",
    });
    setImageDialogOpen(true);
  };

  const insertImage = (url: string, alt: string, title: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const suffix = title ? ` "${title}"` : "";
    const md = `![${alt}](${url}${suffix})`;
    setBody(body.slice(0, start) + md + body.slice(end));
    setDirty(true);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + md.length, start + md.length);
    });
  };

  /* ------------------------ Keyboard shortcuts --------------------------- */
  // useEffectEvent keeps the latest handlers/state visible to the one-time
  // window listener without re-subscribing on every keystroke.
  const onShortcut = useEffectEvent((e: KeyboardEvent) => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
    if (document.activeElement !== textareaRef.current) return;
    const key = e.key.toLowerCase();
    if (key === "b") {
      e.preventDefault();
      wrapSelection("**", "**", "bold text");
    } else if (key === "i") {
      e.preventDefault();
      wrapSelection("*", "*", "italic text");
    } else if (key === "k") {
      e.preventDefault();
      if (e.shiftKey) openImageDialog();
      else wrapSelection("[", "](https://example.com)", "link text");
    } else if (e.shiftKey && key === "h") {
      e.preventDefault();
      insertAtCursor("\n## Heading\n\n");
    } else if (e.shiftKey && e.code === "Digit7") {
      // e.key would be "&" on US layouts — match the physical key instead.
      e.preventDefault();
      insertAtCursor("\n- ");
    } else if (e.shiftKey && key === "e") {
      e.preventDefault();
      insertAtCursor("\n```\n\n```\n");
    }
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onShortcut(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* ------------------------------- Saving --------------------------------- */

  const save = useCallback(async () => {
    const slug = effectiveSlug ? slugify(effectiveSlug) : "untitled-post";
    // Skip autosaves of a truly empty post.
    if (!meta.title.trim() && !body.trim() && !effectiveSlug.trim()) return;

    setSaveState("saving");
    setError("");
    try {
      const endpoint = isNew
        ? "/api/admin/posts"
        : `/api/admin/posts/${encodeURIComponent(slug)}`;
      const res = await fetch(endpoint, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meta, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed.");
      setDirty(false);
      setSaveState("saved");
      setLastSavedAt(new Date().toLocaleTimeString());
      if (isNew) {
        router.replace(`/admin/posts/${encodeURIComponent(data.slug)}/edit`);
        router.refresh();
      }
    } catch (err) {
      setSaveState("error");
      setError(err instanceof Error ? err.message : "Save failed.");
    }
  }, [meta, body, isNew, router, effectiveSlug]);

  // Debounced autosave: 3s after the last change (every save is a git commit,
  // so we avoid commit spam).
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => {
      void save();
    }, 3000);
    return () => clearTimeout(timer);
  }, [meta, body, dirty, save]);

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const faq = meta.faq;

  return (
    <div className="relative flex h-[calc(100dvh-3.5rem)] flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-2">
        <Link
          href="/admin/posts"
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Posts
        </Link>
        <span className="hidden font-mono text-xs text-ink-muted sm:block">
          {isNew ? "New post" : `/${meta.slug || "…"}`}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {saveState === "saving" && <span className="text-xs text-ink-muted">Saving…</span>}
          {saveState === "saved" && (
            <span className="text-xs text-ink-muted" role="status">
              Saved{lastSavedAt ? ` at ${lastSavedAt}` : ""}
            </span>
          )}
          {saveState === "error" && (
            <span className="text-xs font-medium text-brand" role="alert">
              Save failed
            </span>
          )}
          <button
            type="button"
            onClick={() => void save()}
            disabled={saveState === "saving"}
            className="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-strong disabled:opacity-60"
          >
            {isNew ? "Create" : "Save"}
          </button>
          <span className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium">
            {meta.published ? (
              <span className="text-brand-strong">Published</span>
            ) : (
              <span className="text-ink-muted">Draft</span>
            )}
          </span>
        </div>
      </div>

      {error && (
        <p role="alert" className="border-b border-line bg-brand-soft px-4 py-2 text-sm text-brand-strong">
          {error}
        </p>
      )}

      {/* Mobile view switcher */}
      <div className="flex border-b border-line md:hidden">
        {(["edit", "preview"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setMobileView(v)}
            aria-pressed={mobileView === v}
            className={`flex-1 px-4 py-2 text-sm font-medium capitalize transition-colors ${
              mobileView === v ? "bg-brand-soft text-brand-strong" : "text-ink-muted"
            }`}
          >
            {v === "edit" ? "Write" : "Preview"}
          </button>
        ))}
      </div>

      {/* Workspace */}
      <div className="flex min-h-0 flex-1">
        {/* Editor pane */}
        <div
          className={`min-w-0 flex-1 flex-col ${mobileView === "edit" ? "flex" : "hidden"} md:flex`}
        >
          <div className="flex flex-wrap gap-1 border-b border-line bg-surface-soft/40 px-3 py-1.5">
            <ToolbarButton title="Bold" onClick={() => wrapSelection("**", "**", "bold text")}>
              B
            </ToolbarButton>
            <ToolbarButton title="Italic" onClick={() => wrapSelection("*", "*", "italic text")}>
              I
            </ToolbarButton>
            <ToolbarButton title="Heading 2" onClick={() => insertAtCursor("\n## Heading\n\n")}>
              H2
            </ToolbarButton>
            <ToolbarButton
              title="Link"
              onClick={() => wrapSelection("[", "](https://example.com)", "link text")}
            >
              🔗
            </ToolbarButton>
            <ToolbarButton
              title={`Insert image (external URL) — ${MOD}⇧K`}
              onClick={openImageDialog}
            >
              🖼
            </ToolbarButton>
            <ToolbarButton
              title={`Keyboard shortcuts — ${MOD}B, ${MOD}I, ${MOD}K…`}
              onClick={() => setShortcutsOpen((o) => !o)}
              onMouseDown={(e) => e.stopPropagation()}
              aria-expanded={shortcutsOpen}
              aria-haspopup="true"
            >
              ⌨
            </ToolbarButton>
            <ToolbarButton title="Quote" onClick={() => insertAtCursor("\n> ")}>
              ❝
            </ToolbarButton>
            <ToolbarButton title="Bullet list" onClick={() => insertAtCursor("\n- ")}>
              • List
            </ToolbarButton>
            <ToolbarButton title="Code block" onClick={() => insertAtCursor("\n```\n\n```\n")}>
              Code
            </ToolbarButton>
          </div>
          <label htmlFor="post-body" className="sr-only">
            Post content (Markdown)
          </label>
          <textarea
            id="post-body"
            ref={textareaRef}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setDirty(true);
            }}
            placeholder={"Write in Markdown…\n\nStart with ## a subheading, **bold**, `code`, or a code fence:"}
            spellCheck={false}
            className="min-h-0 flex-1 resize-none bg-paper p-4 font-mono text-sm leading-6 text-ink outline-none placeholder:text-ink-muted/50"
          />
        </div>

        {/* Preview pane */}
        <div
          className={`min-w-0 flex-1 overflow-y-auto border-l border-line bg-paper ${mobileView === "preview" ? "flex" : "hidden"} md:flex`}
        >
          <article className="mx-auto w-full max-w-2xl px-6 py-6">
            <div className="prose prose-warm max-w-none text-[1rem] leading-7">
              <Markdown>{body || "*Nothing to preview yet — start writing.*"}</Markdown>
            </div>
          </article>
        </div>

        {/* Sidebar */}
        <aside className="hidden w-80 shrink-0 space-y-5 overflow-y-auto border-l border-line bg-surface p-4 lg:block xl:w-96">
          <SeoPanel
            title={meta.title}
            excerpt={meta.excerpt}
            focusKeyword={meta.focusKeyword}
            slug={meta.slug}
            content={body}
            metaDescription={meta.seo.metaDescription}
            faqCount={faq.filter((f) => f.question && f.answer).length}
          />

          <section className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Publishing
            </h2>
            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-line bg-paper px-3 py-2.5">
              <span className="text-sm font-medium text-ink">Published</span>
              <input
                type="checkbox"
                checked={meta.published}
                onChange={(e) => updateMeta({ published: e.target.checked })}
                className="h-4 w-4 accent-brand"
              />
            </label>
            <Field label="Date (ISO)" htmlFor="post-date">
              <input
                id="post-date"
                type="text"
                value={meta.date}
                onChange={(e) => updateMeta({ date: e.target.value })}
                className={inputClass}
              />
            </Field>
          </section>

          <section className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Post
            </h2>
            <Field label="Title" htmlFor="post-title">
              <input
                id="post-title"
                type="text"
                value={meta.title}
                onChange={(e) => updateMeta({ title: e.target.value })}
                placeholder="A great title"
                className={inputClass}
              />
            </Field>
            <Field
              label="Slug"
              htmlFor="post-slug"
              hint="Auto-generated from the title — edit to override."
            >
              <div className="flex gap-1.5">
                <input
                  id="post-slug"
                  type="text"
                  value={effectiveSlug}
                  onChange={(e) => {
                    setSlugEdited(true);
                    updateMeta({ slug: e.target.value });
                  }}
                  placeholder="a-great-title"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => {
                    setSlugEdited(true);
                    updateMeta({ slug: slugify(meta.title) });
                  }}
                  title="Regenerate from title"
                  className="shrink-0 rounded-lg border border-line px-2.5 text-sm text-ink-muted transition-colors hover:border-line-strong hover:text-brand"
                >
                  ↻
                </button>
              </div>
            </Field>
            <Field label="Excerpt" htmlFor="post-excerpt" hint="Used for meta descriptions and cards — make it a quotable answer.">
              <textarea
                id="post-excerpt"
                value={meta.excerpt}
                onChange={(e) => updateMeta({ excerpt: e.target.value })}
                rows={3}
                placeholder="A short, declarative summary…"
                className={textareaClass}
              />
            </Field>
            <Field label="Cover image URL" htmlFor="post-cover">
              <input
                id="post-cover"
                type="url"
                value={meta.coverImage}
                onChange={(e) => updateMeta({ coverImage: e.target.value })}
                placeholder="https://…"
                className={inputClass}
              />
            </Field>
            <Field label="Tags (comma separated)" htmlFor="post-tags">
              <input
                id="post-tags"
                type="text"
                value={meta.tags.join(", ")}
                onChange={(e) =>
                  updateMeta({
                    tags: e.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="writing, meta, seo"
                className={inputClass}
              />
            </Field>
          </section>

          <section className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              SEO &amp; AEO
            </h2>
            <Field label="Focus keyword" htmlFor="focus-keyword" hint="Powers most of the SEO checks above.">
              <input
                id="focus-keyword"
                type="text"
                value={meta.focusKeyword}
                onChange={(e) => updateMeta({ focusKeyword: e.target.value })}
                placeholder="e.g. self-hosting a blog"
                className={inputClass}
              />
            </Field>
            <Field label="Meta title" htmlFor="meta-title" hint="Falls back to the title.">
              <input
                id="meta-title"
                type="text"
                value={meta.seo.metaTitle}
                onChange={(e) => updateMeta({ seo: { ...meta.seo, metaTitle: e.target.value } })}
                className={inputClass}
              />
            </Field>
            <Field label="Meta description" htmlFor="meta-description" hint={`${meta.seo.metaDescription.length} chars — aim for 120–160.`}>
              <textarea
                id="meta-description"
                value={meta.seo.metaDescription}
                onChange={(e) => updateMeta({ seo: { ...meta.seo, metaDescription: e.target.value } })}
                rows={3}
                placeholder="Overrides the excerpt in search results…"
                className={textareaClass}
              />
            </Field>
            <Field label="Canonical URL" htmlFor="canonical-url" hint="Leave empty to use the post URL.">
              <input
                id="canonical-url"
                type="url"
                value={meta.seo.canonicalUrl}
                onChange={(e) => updateMeta({ seo: { ...meta.seo, canonicalUrl: e.target.value } })}
                placeholder="https://…"
                className={inputClass}
              />
            </Field>
            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-line bg-paper px-3 py-2.5">
              <span className="text-sm font-medium text-ink">No-index this post</span>
              <input
                type="checkbox"
                checked={meta.seo.noIndex}
                onChange={(e) => updateMeta({ seo: { ...meta.seo, noIndex: e.target.checked } })}
                className="h-4 w-4 accent-brand"
              />
            </label>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              FAQ <span className="font-normal normal-case">(emits FAQPage schema — a strong AEO lever)</span>
            </h2>
            {faq.map((item, index) => (
              <div key={index} className="space-y-2 rounded-xl border border-line bg-paper p-3">
                <Field label={`Question ${index + 1}`} htmlFor={`faq-q-${index}`}>
                  <input
                    id={`faq-q-${index}`}
                    type="text"
                    value={item.question}
                    onChange={(e) => {
                      const next = [...faq];
                      next[index] = { ...item, question: e.target.value };
                      updateMeta({ faq: next });
                    }}
                    placeholder="What is…?"
                    className={inputClass}
                  />
                </Field>
                <Field label="Answer" htmlFor={`faq-a-${index}`}>
                  <textarea
                    id={`faq-a-${index}`}
                    value={item.answer}
                    onChange={(e) => {
                      const next = [...faq];
                      next[index] = { ...item, answer: e.target.value };
                      updateMeta({ faq: next });
                    }}
                    rows={2}
                    placeholder="A direct, quotable answer…"
                    className={textareaClass}
                  />
                </Field>
                <button
                  type="button"
                  onClick={() => updateMeta({ faq: faq.filter((_, i) => i !== index) })}
                  className="text-xs font-medium text-ink-muted transition-colors hover:text-brand"
                >
                  Remove question
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => updateMeta({ faq: [...faq, { question: "", answer: "" }] })}
              className="w-full rounded-lg border border-dashed border-line-strong px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:border-brand hover:text-brand"
            >
              + Add question
            </button>
          </section>
        </aside>
      </div>

      <ShortcutPanel open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <ImageDialog
        open={imageDialogOpen}
        onClose={() => setImageDialogOpen(false)}
        initialUrl={dialogPrefill.url}
        initialAlt={dialogPrefill.alt}
        focusKeyword={meta.focusKeyword}
        onInsert={insertImage}
      />
    </div>
  );
}
