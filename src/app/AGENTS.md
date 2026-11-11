# src/app — routes & API

## Purpose
App Router routes: the public site, the admin panel, the admin API, and the machine-readable endpoints.

## Ownership
- `layout.tsx` — root layout: fonts, metadata, feed autodiscovery default, and the **theme injection** (server-rendered `<style>` from site config; falls back to `DEFAULT_SITE_CONFIG` on config errors)
- `globals.css` — Tailwind v4, live theme tokens + voice utilities (`font-display`, `tracking-display`, `font-eyebrow`, `border-stroke`, `--face-density`), `prose-warm` article styles (drop caps via face tokens)
- `(public)/layout.tsx` — the public shell: Header + Footer + the **opt-in analytics tracker** (`<AnalyticsScript>`), which is why `/admin`, `/api` and `/md` can never load it
- `(public)/` — `/`, `/blog`, `/blog/[slug]`, `/tags`, `/tags/[tag]`, `/topics`, `/about`
- `admin/` — login + dashboard (posts list, editor, settings, analytics); guarded by `(dashboard)/layout.tsx` via `getSession()` → redirect to `/admin/login`
- `admin/(dashboard)/analytics/` — the Analytics page (`/admin/analytics`) and the per-post drilldown (`/admin/analytics/posts/[slug]`); the drilldown `notFound()`s for anything unpublished
- `api/admin/` — `login`, `logout`, `posts`, `posts/[slug]`, `settings`, `preview` (zod-validated, session-guarded; `preview` renders editor markdown through the shared server pipeline)
- `api/admin/analytics/` — `overview`, `pages` (JSON or `?format=csv`), `posts/[slug]`, `health` (GET) and `verify`, `config` (POST/PUT, origin-guarded). Shared plumbing lives in `_shared.ts` (not a route): origin+session guard, bounded query parsing, published-post listing, `siteTimezone()`. Reporting responses are always `Cache-Control: private, no-store`, and a provider failure is a **200 with `degraded` set**, never a 500
- `rss.xml/`, `feed.json`, `sitemap.ts`, `robots.ts`, `llms.txt/`, `llms-full.txt/`, `search-index.json/`, `md/` — all prerendered static (`force-static`, 1 h fallback). `md/[...slug]` is static too: an empty `generateStaticParams` + `force-static` means "generate whatever is asked for, then cache it", so arbitrary legacy tag URLs keep resolving without a per-request function
- `admin/(dashboard)/page.tsx` also renders the Search visibility + Content health panels
- `api/seo-routes.test.ts` — integration tests for every machine-discovery surface
- `not-found.tsx`, `error.tsx`, `global-error.tsx`

## Local Contracts
- **A failed listing must render as a failure, never as an empty blog.** Any page that renders a post list has to branch on `listStatus()` via `<ContentUnavailable />`. `safeListPosts()` returning `[]` is a degraded state, not an empty site, and conflating them is what took a production blog offline while looking like a successful empty response.
- **Drafts 404 on every public surface** — check `post.meta.published` (pages, RSS, feeds, sitemap, llms.txt, llms-full.txt, `/md/*`, JSON-LD).
- **`seo.noIndex` is enforced by `isIndexable()`** (`src/lib/seo/publish.ts`), not by a bare `published` check. Every route in `rss.xml`, `feed.json`, `llms.txt`, `llms-full.txt` and `sitemap.ts` must use it. A noIndex post that still appears in a feed is a bug, not a style choice.
- **Public routes are static-first — every one of them, including `/md/[...slug]`.** Public pages are prerendered (`revalidate = 3600` as a self-heal fallback) and every machine route is `force-static`. Freshness comes from `revalidatePublicSurfaces()` (see `src/lib/revalidate.ts`) called by the admin save routes, plus the deploy hook for direct git pushes. A visit to a public page must never invoke a server render. **Do not make a public route dynamic again to "fix" something** — the fix belongs in the cache or the invalidation, not in per-request rendering.
- `/` is **static**, not `force-dynamic`. Pagination is handled in the browser by `<HomePosts>`: page 1 is in the static HTML and `?page=N` still resolves. The canonical for every page is `/`, which consolidates the paginated duplicates. Do not reintroduce `searchParams` on this route — that would make it dynamic again and cost a full render per visit.
- Blog post pages keep `revalidate = 3600` and `dynamicParams = true`; `generateStaticParams()` returns `[]` when `DEPLOYMENT_MODE=serverless`, so a post renders on first request and is cached. `/blog`, `/about`, `/tags` and `/topics` are static at 3600s.
- **Any route returning `alternates` must use `withFeeds(config, canonical)`** from `src/lib/seo/metadata.ts`. Next 16 replaces `alternates` instead of merging, so a bare `{ canonical }` silently drops feed autodiscovery. Also use `title.absolute` where the root layout's `%s · <site>` template would otherwise double-apply.
- **`/tags/[tag]` resolves the URL param through `resolveTagFromSlug`**, not a raw string match, so legacy raw-tag URLs keep working; it then canonicalizes to the normalized slug and sets `robots: noindex` when the tag has fewer than `MIN_POSTS_FOR_TAG_INDEX` published posts. A slug matching no tag at all is a 404. `MIN_POSTS_FOR_TAG_INDEX` (in `lib/seo/publish.ts`) is the single knob shared by the page and the sitemap — change it in one place.
- `/topics` ranks topics by post count so the subjects with real depth surface first and the long tail collapses. It reads the same threshold, making the indexability decision legible rather than mysterious.
- `/search-index.json` is built from the same `isIndexable()` set as the sitemap, so it cannot drift from the published set or expose a draft. Exclude it from `robots.txt` disallow on purpose. It is capped (`INDEX_LIMIT`) because the browser downloads it on first focus; it reports `total` and `truncated` so the client can say so.
- **`sitemap.ts` and `robots.ts` must keep a `revalidate` (currently 3600).** Without it they are baked at build time and served from the CDN forever, so a build that runs without working content credentials silently freezes a valid-but-empty sitemap (or a `Host:` pointing at localhost) for the life of the deployment. They heal on the same cadence as the public pages, and admin saves invalidate them immediately. Check `npm run build` output for `1h` on both; if either loses it, this regressed.
- **A save must invalidate the public surfaces.** `POST /api/admin/posts`, `PUT/PATCH/DELETE /api/admin/posts/[slug]` and `PUT /api/admin/settings` call `revalidatePublicSurfaces()` after a successful write. It is best-effort and must never fail the save; the hourly `revalidate` is the fallback. Skipping it means a static page keeps serving stale HTML for up to an hour.
- The admin dashboard's Search visibility panel is the owner's only window into decisions the public routes make silently (noIndex opt-outs, untagged posts, thin tag pages). It is computed from `buildIndexabilityReport()`, never re-derived, so it cannot drift from crawler behaviour.
- **`/md/*` is a markdown mirror** reached by the header-gated rewrite in `next.config.ts`. It sends `X-Robots-Tag: noindex, follow`, and it must never expose a draft. The rewrite is `beforeFiles` and enumerated per public route so it can never intercept `/admin` or `/api`.
- Admin API routes: 401 without a valid session; 403 via `isCrossOrigin()` when an Origin header claims a foreign host (CSRF defense-in-depth); `safeParse` request bodies against zod schemas; URL-path slugs validated with `isSafeSlug()` → 400 before adapter calls; never leak stack traces.
- Security headers (CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) are defined once in `next.config.ts` — don't add per-route header overrides that weaken them; a nonce-based CSP would break SSG/ISR, so script/style keep `'unsafe-inline'`.
- Error/404 pages must not leak stack traces.
- **Analytics never touches the SEO surface.** The tracker is emitted by `(public)/layout.tsx` only (never `/admin`, `/api` or `/md`), no analytics setting may change a canonical URL, indexability, sitemap, feed or JSON-LD output, and no page may block rendering on a provider response. A degraded provider is reported in the panel and nowhere else.
- The root-layout theme injection **must stay server-rendered** — do not move it client-side (breaks SSG and causes theme flash).
- **Theme voices are materials, not palettes.** Public headings render through `font-display` + `tracking-display` (the face owns the weight — never re-add `font-semibold` next to it), label stamps through `font-eyebrow`, structural rules through `border-stroke`. Site config reads use the tolerant `themeConfigReadSchema` (`types.ts`) so a retired preset id degrades instead of resetting the author's config; the admin write path keeps the strict schema.

## Work Guidance
- Keep SEO metadata complete on new public routes: canonical via `withFeeds`, OG/Twitter, and a JSON-LD graph via `<JsonLd>`.
- `robots.ts` keeps a single permissive `*` group on purpose: blocking GPTBot / PerplexityBot / ClaudeBot / Google-Extended / Bingbot would make those engines unable to cite the site. Only `/admin`, `/api` and `/md` are disallowed. Read the comment there before changing it.
- API route integration tests are colocated: `api/admin/*.test.ts`. Machine-surface tests live at `api/seo-routes.test.ts`; mock `@/lib/content` with `vi.hoisted` and replace `safeListPosts` rather than spreading the real module (the real one closes over the real `getAdapter` and would read from disk).

## Verification
- `npx vitest run src/app/api` (route tests, including `api/admin/analytics/routes.test.ts` — 401/403, bounded ranges, degradation, safe CSV, draft 404, no secrets)
- `npm run build` — also proves every public route compiles and prerenders.
