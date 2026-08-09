# Ansora — Foundation & Agent Guide

> **Entry point:** the root `AGENTS.md` (DOX) is the first doc an agent reads;
> this file is the deep-dive reference for architecture and conventions.
>
> This file is the canonical source of truth for working on Ansora. Read it
> before reading code, and keep it updated whenever the architecture changes.
> It replaces the original build spec (`ansora-specs.md`), which was removed
> from history — it was an internal prompt, not project documentation.

---

## 1. What Ansora is

A **self-hostable, serverless-deployable blogging platform** where:

- **Every post is a Markdown file** (`content/posts/<slug>.md` with YAML frontmatter).
- **Every save is a git commit** (locally via `simple-git`, or to GitHub via the REST API).
- **There is no database, no SaaS CMS, no user table, no lock-in.**
- The same codebase deploys to **Vercel, Netlify, Docker/VPS, or Render** with zero code changes.

Positioning: powerful enough for professionals, simple enough for non-technical
writers — a real CMS feel (live split-pane editor, on-page SEO/AEO scoring,
admin panel) without enterprise weight. There is **one admin per deployment**;
credentials come from environment variables.

## 2. Non-negotiables (hard constraints)

1. **No database.** All state lives in markdown files + git. Never introduce a DB.
2. **No multi-user auth.** Single admin per deployment. Never add a user table or a third-party auth provider.
3. **No branching on deployment mode** outside `src/lib/content/index.ts`. Features must behave identically in `self-hosted` and `serverless` modes; only the storage adapter differs.
4. **Every save must be a commit**, but **no-op saves must not create commits** (both adapters guard this — preserve it).
5. **Drafts must never be served publicly** — unpublished posts 404 on every public route.
6. **No plaintext passwords ever** — only `ADMIN_PASSWORD_HASH` (bcrypt) in env vars; never log credentials.
7. **No broken SEO/AEO defaults.** Metadata, JSON-LD, RSS, sitemap, robots.txt, `llms.txt` are non-negotiable output.
8. **Components use the theme tokens** (`bg-paper`, `text-ink`, `bg-brand`, …). All palette hex values live in exactly two places: the presets in `src/lib/theme.ts` and the warm fallback defaults in `globals.css` — don't add hex anywhere else (see §6.4).

## 3. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16.3 (App Router, Turbopack)** | `output: "standalone"` in `next.config.ts` (required by Docker) |
| Language | TypeScript, strict | `npm run typecheck` must pass |
| UI | React 19, Tailwind CSS v4 | CSS-variable theming, class-based dark mode |
| Markdown | `unified` + remark/rehype | one shared pipeline for public render AND editor preview |
| Syntax highlighting | `rehype-pretty-code` (Shiki, `everforest-dark`) | |
| Auth | `jose` (JWT) + `bcryptjs` | httpOnly cookie, HS256, 7-day TTL |
| Git on disk | `simple-git` | self-hosted mode |
| GitHub API | `octokit` | serverless mode |
| Validation | `zod` v4 | frontmatter + site config schemas in `src/lib/content/types.ts` |
| Tests | `vitest` 4 + Testing Library | colocated `*.test.ts(x)`, node by default |

## 4. Architecture at a glance

### 4.1 Content adapter pattern (the core idea)

```ts
interface ContentAdapter {
  readonly mode: "self-hosted" | "serverless";
  listPosts(): Promise<PostMeta[]>;
  getPost(slug: string): Promise<Post | null>;
  savePost(slug: string, content: string, frontmatter: object): Promise<void>;
  deletePost(slug: string): Promise<void>;
  getSiteConfig(): Promise<SiteConfig>;
  saveSiteConfig(config: SiteConfig): Promise<void>;
}
```

- **`getAdapter()`** (`src/lib/content/index.ts`) picks the implementation once from `DEPLOYMENT_MODE` and caches it. All content I/O in the app goes through this — never read files/GitHub directly elsewhere.
- **`LocalGitAdapter`** (`src/lib/content/local-git.ts`): reads/writes disk under `CONTENT_DIR` (default `./content`), commits with `simple-git`, optional push via `GIT_AUTO_PUSH=true`. Lazy `git init` on first write.
- **`GitHubApiAdapter`** (`src/lib/content/github.ts`): octokit Contents API. Updating a file requires its current **SHA** (fetch first). Reads hit the API directly with a 60 s `TtlCache`. Treats a fresh/empty repo as empty (404 → `[]`).
- **No-op guard:** if the serialized file is byte-identical to what's stored, skip the commit — in *both* adapters. Keep this when editing them.
- **Site config** lives in `content/site.config.json` (path configurable in serverless mode) and is read/written through the same adapter.

### 4.2 Auth & sessions (`src/lib/auth/session.ts`)

- Credentials: `ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH` (bcrypt, starts with `$2`). `verifyCredentials` **throws** when unset/malformed — misconfiguration must fail loudly, not look like a wrong password.
- Session: JWT (HS256, `sub: "admin"`) in the `ansora_session` httpOnly cookie, 7 days, `sameSite: lax`.
- Login endpoint is rate-limited: **5 failed attempts / 15 min per IP**, in-memory (`loginAttempts` map). Serverless caveat: per-instance, so it's a *soft* throttle — by design.
- Admin route guard: `src/app/admin/(dashboard)/layout.tsx` calls `getSession()` and redirects to `/admin/login` when unauthenticated.

### 4.3 Markdown pipeline (`src/lib/markdown/`)

- **One shared plugin chain** (`pipeline.ts`) powers both the public server renderer (`render.ts`, unified → `rehype-stringify`) and the editor's client preview (react-markdown). **Never let the two drift.**
- Plugins: `remark-gfm`, `rehype-slug`, `rehype-pretty-code`, `rehype-autolink-headings`.
- `render.ts` adds a hast post-pass mirroring react-markdown's `<a>`/`<img>` behavior: external links open in new tabs, images lazy-load, and **URL sanitization** (`SAFE_URL`) neutralizes `javascript:`/`data:` schemes. `rehype-stringify` does not sanitize — this pass is the safety net.
- `extractToc` builds h2/h3 TOC with the same ids rehype-slug generates; shown for posts > 800 words with ≥ 2 headings.
- `scanHeadings` is a cheap regex scan for the SEO scorer (code fences stripped first).

### 4.4 SEO / AEO surface (`src/lib/seo/`, app routes)

- `BlogPosting` JSON-LD on every post (+ `FAQPage` when `faq` frontmatter exists) via `src/lib/seo/jsonld.ts`.
- Generated routes: `/rss.xml`, `/sitemap.xml`, `/robots.txt`, `/llms.txt`, canonical URLs, Open Graph + Twitter cards.
- **On-page SEO/AEO scorer** in the editor (`src/lib/markdown/seo-score.ts`): 0–100 weighted composite with a real checklist (title/meta length, focus keyword placement, heading hierarchy, thin content, readability, links, image alt, FAQ presence). It's the differentiator — keep it honest, no stubs.

### 4.5 Theme system (added later — do not regress)

- **Four curated presets** — `warm`, `ocean`, `forest`, `midnight` — each with a full light + dark palette, defined in **`src/lib/theme.ts`** (`THEME_PRESETS`). The Midnight preset uses navy backgrounds with a warm gold accent.
- Admins can override **accent color** (derived `brandStrong`/`brandSoft`/`onBrand` computed with WCAG-aware `textOn`/`contrast`), **corner radius** (`RADIUS_SCALES` mapped onto Tailwind `--radius-*`), and **heading font** (`--font-serif` swap). A curated set of **accent swatches** (`ACCENT_SWATCHES`) appears as clickable color chips in the Appearance form.
- `buildThemeCss(theme)` emits the palette as CSS custom properties with `html:root` / `html.dark` selectors (higher specificity than `globals.css` defaults).
- The **root layout** (`src/app/layout.tsx`) renders the `<style>` block; `getSiteConfig().catch(() => DEFAULT_SITE_CONFIG)` so a style block never fails a build.
- The `theme` object is persisted per site in `content/site.config.json` via **Admin → Settings → Appearance**. All changes are fully backwards compatible — existing configs with 3 presets continue to work (the schema default is `"warm"`).

## 5. Directory map

```
content/                  real content: posts/*.md + site.config.json
foundation.md             this document
render.yaml               Render one-click blueprint (Docker path)
scripts/
  hash-password.mjs       bcrypt hash generator (npm run hash-password)
  github-repo.mjs         content-repo helper for scripts/verify-serverless.sh
  verify-serverless.sh    end-to-end serverless harness (snapshots + restores repo)
src/
  app/
    layout.tsx            root layout: fonts, metadata, THEME INJECTION
    globals.css           Tailwind v4, live theme tokens, prose-warm styles
    (public)/             public site: /, /blog/[slug], /tags, /tags/[tag]
    admin/                admin: login + (dashboard)/{posts,new,edit,settings}
    api/admin/            API routes: login, logout, posts, posts/[slug], settings
    rss.xml, sitemap.ts, robots.ts, llms.txt, not-found, error, global-error
  components/             shared + admin components (Header, PostCard, PostEditor, …)
  lib/
    content/              adapter pattern: index, local-git, github, types, cache
    auth/session.ts       JWT + bcrypt + rate limiting
    markdown/             pipeline, render, seo-score (+ fixtures)
    seo/jsonld.ts         structured data builders
    site-config.ts        getSiteConfig() — 30 s TTL cache, SITE_URL seeds baseUrl
    theme.ts              presets + buildThemeCss (THEME ENGINE)
    utils.ts              slugify, dates, word counts, escapeXml, stripMarkdown
  test/setup.ts           vitest setup: RTL cleanup + rAF polyfill
```

## 6. Content model

### 6.1 Post frontmatter (`content/posts/<slug>.md`) — validated by `postMetaSchema` (zod)

```yaml
---
title: string            # required
slug: string             # required, unique, lower-kebab-case (SLUG_PATTERN)
date: ISO-date           # required
updated: ISO-date        # optional; stamped when a published post is edited
excerpt: string          # required to publish (meta description + cards)
coverImage: url          # optional, external URL (no uploads!)
tags: [string]           # optional
published: boolean       # default false
focusKeyword: string     # optional; powers the SEO scorer
seo:
  metaTitle: string      # optional, falls back to title
  metaDescription: string# optional, falls back to excerpt
  canonicalUrl: string   # optional
  noIndex: boolean       # default false
faq:                     # optional; emits FAQPage JSON-LD
  - question: string
    answer: string
---
```

- Reads are lenient (defaults applied); writes are normalized via `serializeFrontmatter` (canonical key order). `cleanUndefined` strips `undefined` before dumping (js-yaml refuses them).
- **Cover images are external URLs only.** There is deliberately no upload feature.

### 6.2 Site config (`content/site.config.json`) — validated by `siteConfigSchema`

`title`, `description`, `baseUrl`, `author`, `defaultOgImage`, `social{twitter,github,linkedin}`, `theme{preset,accent,radius,headingFont}`.
`SITE_URL` env seeds `baseUrl` only while it's still the localhost default; an explicit admin value always wins.

## 7. Environment variables

| Variable | Required | Mode | Purpose |
|---|---|---|---|
| `DEPLOYMENT_MODE` | no (`self-hosted`) | all | selects the content adapter |
| `ADMIN_USERNAME` | yes | all | admin login |
| `ADMIN_PASSWORD_HASH` | yes | all | bcrypt hash (`npm run hash-password`) |
| `JWT_SECRET` | yes | all | ≥ 32 chars, signs sessions |
| `SITE_URL` | no | all | seeds baseUrl for canonical/RSS/OG |
| `CONTENT_DIR` | no | self-hosted | content dir (default `./content`) |
| `GIT_AUTO_PUSH` | no | self-hosted | push after every save |
| `GIT_USER_NAME` / `GIT_USER_EMAIL` | no | self-hosted | identity if repo has none |
| `GITHUB_REPO` | yes | serverless | `owner/repo` holding content |
| `GITHUB_TOKEN` | yes | serverless | fine-grained PAT, **Contents: read+write** |
| `GITHUB_BRANCH` | no | serverless | default `main` |
| `GITHUB_CONTENT_PATH` | no | serverless | default `content/posts` |
| `GITHUB_SITE_CONFIG_PATH` | no | serverless | default `content/site.config.json` |
| `CONTENT_REPO_MODE` | no | info only | `same-repo` / `external-repo` — documented for the backup mental-model; **no code reads it** |
| `ADMIN_PASSWORD` | no | dev only | plaintext password for `scripts/verify-serverless.sh` (`.env.local` only — never in production envs) |

Never commit `.env*`. `.env.local` exists locally for serverless verification (fill in `GITHUB_REPO`/`GITHUB_TOKEN`).

## 8. Conventions — DO

- **Read `README.md` and this file first**, then look at existing code before writing.
- **Route all content I/O through `getAdapter()`.** Extend the `ContentAdapter` interface when new storage needs appear; implement it in *both* adapters.
- **Keep the shared markdown pipeline in sync** — editor preview must equal the public render.
- **Validate with zod** at the boundaries (frontmatter, site config, API bodies). The settings/posts API routes `safeParse` before saving.
- **Use the live theme tokens** in components: `bg-paper`, `bg-surface`, `text-ink`, `text-ink-muted`, `border-line`, `bg-brand`, `text-on-brand`, `bg-brand-soft`, `text-brand-strong`. Prefer `brand/15`-style alpha modifiers over fixed scales.
- **When adding a new theme preset**: add it to `THEME_PRESETS` in `src/lib/theme.ts`, to the `z.enum()` in `src/lib/content/types.ts`, and add a corresponding render test in `route.appearance.test.ts`. Optionally add a related `AccentSwatch`.
- **When adding a new accent swatch**: add it to the `ACCENT_SWATCHES` array in `src/lib/theme.ts`. The form renders them automatically.
- **Guard no-op writes** (identical content ⇒ no commit) in any new write path.
- **Drafts stay private**: check `meta.published` before any public exposure (page, RSS, sitemap, JSON-LD, llms.txt).
- **Keep accessibility**: labeled form fields, accessible names, WCAG AA contrast, `prefers-reduced-motion` respect (existing `animate-*` utilities already gate on it).
- **Colocate tests** next to the code, run `npm run typecheck && npm run lint && npm test` before finishing.
- **Preserve the SEO/AEO surface** — new routes should still emit canonical URLs, metadata, and keep sitemap/robots/llms current.

## 9. Conventions — DON'T

- ❌ **Don't add a database, ORM, or external CMS.** Markdown files are the source of truth.
- ❌ **Don't add multi-user accounts or third-party auth.** Env-var single admin only.
- ❌ **Don't branch on `DEPLOYMENT_MODE`** outside `getAdapter()`; features must work in both modes.
- ❌ **Don't hardcode hex colors** in components/styles — use theme tokens. The static `brand-50…950` scale was removed; don't reintroduce it.
- ❌ **Don't skip the no-op guard or make autosave commit on every keystroke** (it's debounced ~3 s by design).
- ❌ **Don't serve unpublished posts** anywhere — not even via draft URLs.
- ❌ **Don't log or store plaintext passwords/tokens**, and don't leak stack traces from error/404 pages.
- ❌ **Don't change the root-layout theme injection** to a client-only mechanism — it must be server-rendered to avoid flash of wrong theme and to keep SSG working.
- ❌ **Don't use `next start`** for production (standalone output warns); use the standalone server or Docker.
- ❌ **Don't bloat deps** — every package must be used (the project is strict about this).
- ❌ **Don't overwrite the editor's single pipeline** — a second rendering path for the preview is a regression waiting to happen.

## 10. Testing

- `vitest`; default environment **node**; UI component tests opt into jsdom with a `// @vitest-environment jsdom` docblock (Vitest 4 dropped `environmentMatchGlobs`).
- `src/test/setup.ts` does RTL `cleanup()` after each test and polyfills rAF if missing — keep it.
- Admin API routes are integration-tested end-to-end (real handlers, real JWT/validation; only the adapter + cookie store are mocked).
- SEO scorer has fixtures in `seo-score.fixtures.ts`. Theme engine has `src/lib/theme.test.ts`.
- **Known flake:** the login rate-limit test can time out (5 s) under parallel load because bcrypt is slow (~3.7 s in isolation). Passes alone; don't "fix" it by weakening the throttle.

## 11. Build & deployment

- `npm run build` → Next standalone output. `next.config.ts` externalizes `simple-git` and `octokit` (`serverExternalPackages`).
- **Serverless mode** (Vercel/Netlify): `DEPLOYMENT_MODE=serverless` + GitHub env vars. Blog pages use ISR (`revalidate = 300`) and `generateStaticParams()` returns `[]` in serverless mode (no build-time SSG of posts). A GitHub webhook → Netlify/Vercel **build hook** triggers a rebuild on every content commit; ISR is the 5-minute fallback.
- **Self-hosted**: Docker (`Dockerfile` + `docker-compose.yml`, content volume at `/app/content`) or any VPS; Render one-click via `render.yaml` (persistent disk, `sync: false` secrets).
- One-click deploy buttons (Netlify/Vercel/Render) live at the top of the README, pointing at `github.com/instax-dutta/ansora`.

## 12. Development commands

```bash
npm run dev            # local dev (turbopack)
npm run build          # production build
npm run lint           # eslint
npm run typecheck      # tsc --noEmit
npm test               # vitest
npm run hash-password  # generate ADMIN_PASSWORD_HASH
npm run verify-serverless  # end-to-end harness against a scratch GitHub repo
```

## 13. Known edges & gotchas

- **Serverless build needs creds**: `generateMetadata` in the root layout calls `getSiteConfig()` at prerender; without `GITHUB_REPO`/`GITHUB_TOKEN` a serverless build fails (`/_not-found` is prerendered). The layout *body* falls back to the default theme, but metadata does not — keep env vars set before building.
- **Caches are per-instance**: `getSiteConfig()` (30 s TTL) and the GitHub adapter's 60 s TTL caches live in module memory. In serverless, instances can briefly disagree; admin writes invalidate only the local instance.
- **Login throttle is per-instance** in serverless — a soft rate limit by design, documented in `session.ts`.
- **Fresh content repos**: the GitHub adapter warns and treats a branch with no commits as empty — a brand-new repo before the first save will look empty (expected).
- **`verify-serverless.sh`** snapshots and restores the content repo, but don't run it while anything else commits to that repo.
- **Apex domains can't use CNAME** — use subdomains (e.g. `blogs.example.com`) or Netlify DNS.
