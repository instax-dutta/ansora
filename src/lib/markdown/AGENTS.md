# src/lib/markdown — pipeline & scorers

## Purpose
The **single** markdown rendering pipeline shared by the public site and the editor preview, plus the two scorers: traditional on-page SEO and AI citability.

## Ownership
- `pipeline.ts` — shared remark/rehype plugin chain (`remark-gfm`, `rehype-slug`, `rehype-pretty-code`, `rehype-autolink-headings`) + `extractToc` + `scanHeadings`
- `render.ts` — server-side `unified` → `rehype-stringify` + a link/image sanitization pass (`SAFE_URL` neutralizes `javascript:`/`data:` URLs)
- `seo-score.ts` — 0–100 traditional on-page SEO score with a per-check checklist (+ `seo-score.fixtures.ts`)
- `aeo-score.ts` — 0–100 AI **citability** score; the GEO instrument (+ `aeo-score.test.ts`)
- `overlap.ts` — cross-post checks: `findCannibalization` (shared focus keyword / title overlap), `findOrphanWarning` (published post with no tags can never appear in a peer's related list), `monthsSince` (freshness; silent under 30 days so the dashboard badge stays meaningful)

## Local Contracts
- **One pipeline for both renderers** — the editor preview renders through `render.ts` via `POST /api/admin/preview` (`src/components/admin/MarkdownPreview.tsx` debounces calls), so preview equals public render **by construction**. Never create a second rendering path.
- **Do not reintroduce react-markdown for the preview.** It executes its unified pipeline synchronously (`runSync`), which is incompatible with async plugins — `rehype-pretty-code`/Shiki always finishes async, which 500'd every edit page (SSR and browser alike). Any client-side markdown rendering must go through the server pipeline.
- `rehype-stringify` does not sanitize — `render.ts`'s post-pass is the safety net for links/images. Keep it.
- Shiki theme for code blocks: `everforest-dark` (reads well in both site themes).
- **The two scorers are deliberately different instruments and must not be merged.** `seo-score.ts` asks "will this rank in classic search?"; `aeo-score.ts` asks "will an answer engine quote this?". Keyword placement is worth little to a model and keyword stuffing actively *hurts* AI visibility, so a high SEO score does not imply a citable post. The editor shows both, side by side.
- **`aeo-score.ts` must stay pure, synchronous and dependency-free.** It runs on every keystroke in the browser; a network call or an LLM there would make the number untrustworthy. Regexes and counts only.
- **`aeo-score.ts` prose heuristics must read code-stripped text.** Dashes, filler phrasing and entity counts come from a `prose` copy with fenced blocks removed, so a shell snippet full of em dashes cannot fail a good post.
- The AEO scorer treats keyword density as a **liability** (a check that "passes" when density is healthy) rather than a ranking factor. Do not reframe it as a positive signal.
- `overlap.ts` is advisory, never blocking. Unlike a malformed `seo.canonicalUrl` (which is validated in `content/validate.ts` and *does* block, because a bad canonical can deindex a post), cannibalization and orphaning are judgement calls and must not stop a writer saving.

## Work Guidance
- Add plugins to `pipeline.ts`; they automatically apply to both the public site and the editor preview (both go through `renderMarkdown`).
- The scorers' checks are real, not stubs — weighted to 0–100 with a checklist. Keep the weightings sane when adding checks, and prefer pure functions that can be unit tested with fixtures.
- Reuse existing patterns before adding new regexes: `seo-score.ts` already exports `TEASER_STARTS` for teaser detection.

## Verification
- `npx vitest run src/lib/markdown` (seo-score + aeo-score tests).

## Child DOX Index
- No child AGENTS.md files needed.
