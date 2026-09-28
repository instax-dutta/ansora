# src/components — UI components

## Purpose
Shared public components and admin-panel components (editor, score panel, image dialog, settings form, posts table, …).

## Ownership
- Public site: `Header.tsx`, `Footer.tsx`, `PostCard.tsx`, `Pagination.tsx`, `ProseHtml.tsx`, `Toc.tsx`, `ThemeToggle.tsx`, `JsonLd.tsx`, `TagLinks.tsx`
- Admin panel: `admin/` — `PostEditor.tsx`, `MarkdownPreview.tsx`, `SettingsForm.tsx`, `ScorePanel.tsx`, `ShortcutPanel.tsx`, `ImageDialog.tsx`, `PostsTable.tsx`, `LoginForm.tsx`, `AdminHeader.tsx`
- `admin/MarkdownPreview.tsx` renders through `POST /api/admin/preview` (the shared server pipeline) — do NOT replace it with react-markdown; its synchronous `runSync` cannot host the async Shiki plugin chain (see `lib/markdown/AGENTS.md`).

## Local Contracts
- Use theme tokens (`bg-paper`, `text-ink`, `bg-brand`, `border-line`, `bg-brand-soft`, `text-brand-strong`, …) — **never hardcoded hex colors**. The only exceptions are the two score-ring colors in `ScorePanel.tsx` / `aeoToneFor()`, which are data-driven status indicators matching the pre-existing score palette, not theme surface.
- `"use client"` only where interactivity requires it; prefer server components.
- Accessibility: labeled inputs, accessible names, WCAG AA contrast, visible focus, `prefers-reduced-motion` respected (existing `animate-*` utilities gate on it).
- **All JSON-LD goes through `<JsonLd>`** (`components/JsonLd.tsx`), never a hand-rolled `<script dangerouslySetInnerHTML>` with raw `JSON.stringify`.
- **All tag links go through `<TagLinks>` or `tagSlug()`** so URLs stay normalized while display text stays verbatim. `PostCard.tsx` must not interpolate a raw tag into a href.
- `Pagination.tsx` emits `<link rel="prev">` / `<link rel="next">` as part of its fragment. Do not move that into a page — the pagination graph belongs to the component that knows the page count.
- `PostEditor.tsx` requires a `config: SiteConfig` prop (for the SERP/social previews). `PostEditor`'s `BLANK_META` must stay in sync with `postMetaSchema` — a missing field is a type error, which is the intended guard.
- The two score rings in `ScorePanel.tsx` are **intentionally separate**. Do not average them into one number: a high traditional SEO score does not imply a citable post.

## Work Guidance
- Editor changes must keep the preview rendering through the same pipeline as the public site — no second rendering path.
- Component tests: add a `// @vitest-environment jsdom` docblock (RTL + user-event).

## Verification
- `npx vitest run src/components` (component tests).

## Child DOX Index
- No child AGENTS.md files needed.
