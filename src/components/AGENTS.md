# src/components — UI components

## Purpose
Shared public components and admin-panel components (editor, SEO panel, image dialog, settings form, posts table, …).

## Ownership
- Public site: `Header.tsx`, `Footer.tsx`, `PostCard.tsx`, `Pagination.tsx`, `Markdown.tsx`, `ProseHtml.tsx`, `Toc.tsx`, `ThemeToggle.tsx`
- Admin panel: `admin/` — `PostEditor.tsx`, `SettingsForm.tsx`, `SeoPanel.tsx`, `ShortcutPanel.tsx`, `ImageDialog.tsx`, `PostsTable.tsx`, `LoginForm.tsx`, `AdminHeader.tsx`
- `Markdown.tsx` (client preview) must stay in sync with the shared pipeline — see `lib/markdown/AGENTS.md` (canonical rule: editor preview equals the public render).

## Local Contracts
- Use theme tokens (`bg-paper`, `text-ink`, `bg-brand`, `border-line`, `bg-brand-soft`, `text-brand-strong`, …) — **never hardcoded hex colors**.
- `"use client"` only where interactivity requires it; prefer server components.
- Accessibility: labeled inputs, accessible names, WCAG AA contrast, visible focus, `prefers-reduced-motion` respected (existing `animate-*` utilities gate on it).

## Work Guidance
- Editor changes must keep the preview rendering through the same pipeline as the public site — no second rendering path.
- Component tests: add a `// @vitest-environment jsdom` docblock (RTL + user-event).

## Verification
- `npx vitest run src/components` (component tests).

## Child DOX Index
- No child AGENTS.md files needed.
