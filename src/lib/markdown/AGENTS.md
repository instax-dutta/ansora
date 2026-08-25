# src/lib/markdown — pipeline & SEO scorer

## Purpose
The **single** markdown rendering pipeline shared by the public site and the editor preview, plus the on-page SEO/AEO scorer.

## Ownership
- `pipeline.ts` — shared remark/rehype plugin chain (`remark-gfm`, `rehype-slug`, `rehype-pretty-code`, `rehype-autolink-headings`) + `extractToc` + `scanHeadings`
- `render.ts` — server-side `unified` → `rehype-stringify` + a link/image sanitization pass (`SAFE_URL` neutralizes `javascript:`/`data:` URLs)
- `seo-score.ts` — 0–100 weighted SEO/AEO scorer with a per-check checklist (+ `seo-score.fixtures.ts`)

## Local Contracts
- **One pipeline for both renderers** — the editor preview renders through `render.ts` via `POST /api/admin/preview` (`src/components/admin/MarkdownPreview.tsx` debounces calls), so preview equals public render **by construction**. Never create a second rendering path.
- **Do not reintroduce react-markdown for the preview.** It executes its unified pipeline synchronously (`runSync`), which is incompatible with async plugins — `rehype-pretty-code`/Shiki always finishes async, which 500'd every edit page (SSR and browser alike). Any client-side markdown rendering must go through the server pipeline.
- `rehype-stringify` does not sanitize — `render.ts`'s post-pass is the safety net for links/images. Keep it.
- Shiki theme for code blocks: `everforest-dark` (reads well in both site themes).

## Work Guidance
- Add plugins to `pipeline.ts`; they automatically apply to both the public site and the editor preview (both go through `renderMarkdown`).
- The SEO scorer checks are real, not stubs — weighted to 0–100 with a checklist. Keep the weightings sane when adding checks.

## Verification
- `npx vitest run src/lib/markdown` (seo-score.test.ts).

## Child DOX Index
- No child AGENTS.md files needed.
