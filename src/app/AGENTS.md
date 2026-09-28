# src/app — routes & API

## Purpose
App Router routes: the public site, the admin panel, the admin API, and the machine-readable endpoints.

## Ownership
- `layout.tsx` — root layout: fonts, metadata, feed autodiscovery default, and the **theme injection** (server-rendered `<style>` from site config; falls back to `DEFAULT_SITE_CONFIG` on config errors)
- `globals.css` — Tailwind v4, live theme tokens, `prose-warm` article styles
- `(public)/` — `/`, `/blog`, `/blog/[slug]`, `/tags`, `/tags/[tag]`, `/about`
- `admin/` — login + dashboard (posts list, editor, settings); guarded by `(dashboard)/layout.tsx` via `getSession()` → redirect to `/admin/login`
- `api/admin/` — `login`, `logout`, `posts`, `posts/[slug]`, `settings`, `preview` (zod-validated, session-guarded; `preview` renders editor markdown through the shared server pipeline)
- `rss.xml/`, `feed.json`, `sitemap.ts`, `robots.ts`, `llms.txt/`, `llms-full.txt/`, `md/` (markdown mirror)
- `api/seo-routes.test.ts` — integration tests for every machine-discovery surface
- `not-found.tsx`, `error.tsx`, `global-error.tsx`

## Local Contracts
- **Drafts 404 on every public surface** — check `post.meta.published` (pages, RSS, feeds, sitemap, llms.txt, llms-full.txt, `/md/*`, JSON-LD).
- **`seo.noIndex` is enforced by `isIndexable()`** (`src/lib/seo/publish.ts`), not by a bare `published` check. Every route in `rss.xml`, `feed.json`, `llms.txt`, `llms-full.txt` and `sitemap.ts` must use it. A noIndex post that still appears in a feed is a bug, not a style choice.
- Blog post pages: `revalidate = 300` (ISR); `generateStaticParams()` returns `[]` when `DEPLOYMENT_MODE=serverless`. `/blog`, `/about` and `/tags` are ISR at 300s. `/` is explicitly `force-dynamic` because it reads `searchParams` for pagination and therefore cannot also be an ISR route — that is deliberate, and changing it would mean `/page/2` paths and invalidating already-indexed `?page=N` URLs.
- **Any route returning `alternates` must use `withFeeds(config, canonical)`** from `src/lib/seo/metadata.ts`. Next 16 replaces `alternates` instead of merging, so a bare `{ canonical }` silently drops feed autodiscovery. Also use `title.absolute` where the root layout's `%s · <site>` template would otherwise double-apply.
- **`/tags/[tag]` resolves the URL param through `resolveTagFromSlug`**, not a raw string match, so legacy raw-tag URLs keep working; it then canonicalizes to the normalized slug and sets `robots: noindex` when the tag has no published posts. A slug matching no tag at all is a 404.
- **`/md/*` is a markdown mirror** reached by the header-gated rewrite in `next.config.ts`. It sends `X-Robots-Tag: noindex, follow`, and it must never expose a draft. The rewrite is `beforeFiles` and enumerated per public route so it can never intercept `/admin` or `/api`.
- Admin API routes: 401 without a valid session; 403 via `isCrossOrigin()` when an Origin header claims a foreign host (CSRF defense-in-depth); `safeParse` request bodies against zod schemas; URL-path slugs validated with `isSafeSlug()` → 400 before adapter calls; never leak stack traces.
- Security headers (CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) are defined once in `next.config.ts` — don't add per-route header overrides that weaken them; a nonce-based CSP would break SSG/ISR, so script/style keep `'unsafe-inline'`.
- Error/404 pages must not leak stack traces.
- The root-layout theme injection **must stay server-rendered** — do not move it client-side (breaks SSG and causes theme flash).

## Work Guidance
- Keep SEO metadata complete on new public routes: canonical via `withFeeds`, OG/Twitter, and a JSON-LD graph via `<JsonLd>`.
- `robots.ts` keeps a single permissive `*` group on purpose: blocking GPTBot / PerplexityBot / ClaudeBot / Google-Extended / Bingbot would make those engines unable to cite the site. Only `/admin`, `/api` and `/md` are disallowed. Read the comment there before changing it.
- API route integration tests are colocated: `api/admin/*.test.ts`. Machine-surface tests live at `api/seo-routes.test.ts`; mock `@/lib/content` with `vi.hoisted` and replace `safeListPosts` rather than spreading the real module (the real one closes over the real `getAdapter` and would read from disk).

## Verification
- `npx vitest run src/app/api` (route tests)
- `npm run build` — also proves every public route compiles and prerenders.
