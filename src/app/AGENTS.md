# src/app — routes & API

## Purpose
App Router routes: the public site, the admin panel, and the admin API.

## Ownership
- `layout.tsx` — root layout: fonts, metadata, and the **theme injection** (server-rendered `<style>` from site config; falls back to `DEFAULT_SITE_CONFIG` on config errors)
- `globals.css` — Tailwind v4, live theme tokens, `prose-warm` article styles
- `(public)/` — `/`, `/blog/[slug]`, `/tags`, `/tags/[tag]`
- `admin/` — login + dashboard (posts list, editor, settings); guarded by `(dashboard)/layout.tsx` via `getSession()` → redirect to `/admin/login`
- `api/admin/` — `login`, `logout`, `posts`, `posts/[slug]`, `settings` (zod-validated, session-guarded)
- `rss.xml/`, `sitemap.ts`, `robots.ts`, `llms.txt`, `not-found.tsx`, `error.tsx`, `global-error.tsx`

## Local Contracts
- **Unpublished posts 404 on every public route** — check `post.meta.published` (pages, RSS, sitemap, llms.txt, JSON-LD).
- Blog post pages: `revalidate = 300` (ISR); `generateStaticParams()` returns `[]` when `DEPLOYMENT_MODE=serverless`.
- Admin API routes: 401 without a valid session; `safeParse` request bodies against zod schemas; never leak stack traces.
- Error/404 pages must not leak stack traces.
- The root-layout theme injection **must stay server-rendered** — do not move it client-side (breaks SSG and causes theme flash).

## Work Guidance
- Keep SEO metadata complete on new public routes (canonical, OG/Twitter, JSON-LD).
- API route integration tests are colocated: `api/admin/*.test.ts`.

## Verification
- `npx vitest run src/app/api/admin` (route tests); `npm run build` (routes compile + prerender).

## Child DOX Index
- No child AGENTS.md files needed.
