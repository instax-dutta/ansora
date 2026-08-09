# Ansora

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![CI](https://github.com/instax-dutta/ansora/actions/workflows/ci.yml/badge.svg)](https://github.com/instax-dutta/ansora/actions/workflows/ci.yml)
[![Docker](https://img.shields.io/badge/docker-ghcr.io/instax--dutta/ansora-blue?logo=docker)](https://github.com/instax-dutta/ansora/pkgs/container/ansora)
[![Deploy on Railway](https://railway.com/button.svg)](https://railway.app/new/template?template=https%3A%2F%2Fgithub.com%2Finstax-dutta%2Fansora)

**Own your words. Publish anywhere. Keep them forever.**

Ansora is a self-hostable, serverless-deployable blogging platform where every
post is a markdown file and every save is a git commit. No database. No SaaS
bill. No lock-in.

---

## Why Ansora

Blogging software forces an uncomfortable choice:

| | **Professional** | **Free** |
|---|---|---|
| The promise | Powerful, polished, full-featured | Simple, approachable, zero cost |
| The catch | Per-seat pricing, complexity to run, and your content often lives behind an export button | You don't own your design, your domain, or your traffic — and the platform can change the rules |

Ansora sits deliberately in between. It **feels** like professional software —
a split-pane editor, a real-time SEO/AEO scorer, curated themes — yet it stays
simple enough for a non-technical person to run. And it's free, open source,
and yours.

**Your words outlive the platform.** Markdown has outlived every blogging
platform ever made. In Ansora, posts are plain `.md` files inside a git
repository — no proprietary format, no export button required. Read them, edit
them, back them up with any tool on Earth. If a platform ever dies, your blog
doesn't: you already own the files.

---

## What makes it different

- **Looks like you hired a designer.** Four curated visual styles — Warm,
  Ocean, Forest, Midnight — plus a tunable accent color, corner radius, and
  heading font. Re-skin the entire site from Settings → Appearance. No code,
  no rebuild.
- **Ranks like you hired an SEO.** JSON-LD `BlogPosting` + `FAQPage` schema,
  RSS, sitemap, `robots.txt`, `llms.txt` (the AI-crawler index), canonical
  URLs, Open Graph/Twitter cards — and a live 0–100 SEO/AEO scorer that grades
  your post as you write.
- **Feels like a real CMS.** Split-pane Markdown editor with live preview,
  autosave, FAQ builder, tags, and a publish toggle. Every save is a real git
  commit — versioned, backed up, reversible.
- **Simple enough for non-techies.** One admin login. A settings page. A big
  "Publish" switch. No database, no user tables, no command line required
  after setup.
- **Runs anywhere, lock-in nowhere.** One codebase deploys to Vercel, Netlify,
  Render, Railway, Docker, or your own VPS — the only thing that differs is
  where your content is stored.

---

## Try it in 5 minutes

Prereqs: Node.js 22.22+ and git.

```bash
# 1. Install
npm install

# 2. Configure the admin account
npm run hash-password        # creates a bcrypt hash for ADMIN_PASSWORD_HASH
cp .env.example .env.local   # then fill in ADMIN_USERNAME, ADMIN_PASSWORD_HASH, JWT_SECRET
# JWT_SECRET: openssl rand -base64 48

# 3. Run
npm run dev                  # http://localhost:3000
```

Log in at **http://localhost:3000/admin** and you're live. Three example posts
ship with the repo — write in the editor and watch the SEO score tick up as
you type.

---

## Deploy in one click

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/instax-dutta/ansora)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository=https://github.com/instax-dutta/ansora)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/instax-dutta/ansora)
[![Deploy on Railway](https://railway.com/button.svg)](https://railway.app/new/template?template=https%3A%2F%2Fgithub.com%2Finstax-dutta%2Fansora)

Pick a platform, click, and fill in the three required env vars
(`ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `JWT_SECRET`) during setup. Netlify
and Vercel store your content in a GitHub repo; Render and Railway run the
Docker image. Full instructions and the env-var table are below.

---

## One decision: self-hosted or serverless

Everything else in Ansora is identical between modes — only *where* content is
stored changes.

| | **Self-hosted** (`DEPLOYMENT_MODE=self-hosted`) | **Serverless** (`DEPLOYMENT_MODE=serverless`) |
|---|---|---|
| Where content lives | Local disk (`content/`) + its own git repo | A GitHub repository (any repo, even the app's) |
| Publish latency | **Instant** — the site reads disk directly | **~1–2 min** — a commit triggers a deploy-hook rebuild |
| What you need | A VPS or always-on machine | Vercel/Netlify free tier + a GitHub token with repo write |
| Backup story | `git push` whenever you like | Built-in (every save is a GitHub commit) |

**Choose self-hosted** if you want instant updates, don't want to hand a token
to a host, and have a VPS or a spare machine.

**Choose serverless** if you want free/cheap hosting with zero servers to
maintain and can tolerate a short delay between publishing and the public site
updating.

---

## Deployment

### 1. Vercel

1. Push this repo to GitHub and import it in Vercel (or use the [one-click deploy button](#deploy-in-one-click)).
2. Set the environment variables (below), including `DEPLOYMENT_MODE=serverless`.
3. Set up a **deploy hook**:
   - Vercel → Project → **Settings → Git → Deploy Hooks** → create one (e.g. named `content`).
   - In your content repo: **Settings → Webhooks** → add the deploy-hook URL, content type `application/json`, event **Just the push event**.
   - Now every save in the Ansora editor (a GitHub commit) triggers a rebuild.
4. Deploy. The public pages use ISR (`revalidate = 300s`), so even between rebuilds the site refreshes itself within 5 minutes.

Environment variables for Vercel: all of those below.

### 2. Netlify

1. Push the repo to GitHub and import it in Netlify (or use the [one-click deploy button](#deploy-in-one-click)).
2. Set the environment variables, including `DEPLOYMENT_MODE=serverless`.
3. Netlify → **Site configuration → Build & deploy → Continuous deployment → Build hooks** → create a hook.
4. Add the hook URL as a GitHub webhook on the content repo (push event), same as Vercel above.
5. Point a custom domain (or subdomain) at the site and let Netlify issue the SSL certificate.

### 3. Self-hosted with Docker

A pre-built image is published to GitHub Container Registry on every push to
`main`:

```bash
docker pull ghcr.io/instax-dutta/ansora:latest
```

#### Run with Docker Compose (pre-built image)

Point a `docker-compose.yml` at the published image instead of building from
source — no clone needed. The image's standalone server reads `PORT`/`HOSTNAME`
from the environment, so the compose file only supplies env vars and the
content volume:

```yaml
services:
  ansora:
    image: ghcr.io/instax-dutta/ansora:latest
    ports:
      - "3000:3000"
    environment:
      DEPLOYMENT_MODE: self-hosted
      # Generate with `npm run hash-password`
      ADMIN_USERNAME: ${ADMIN_USERNAME:-admin}
      ADMIN_PASSWORD_HASH: ${ADMIN_PASSWORD_HASH:?Set ADMIN_PASSWORD_HASH in your .env}
      # Long random string, e.g. `openssl rand -base64 48`
      JWT_SECRET: ${JWT_SECRET:?Set JWT_SECRET in your .env}
      SITE_URL: ${SITE_URL:-http://localhost:3000}
      CONTENT_DIR: /app/content
      GIT_AUTO_PUSH: ${GIT_AUTO_PUSH:-false}
    volumes:
      - ./content:/app/content
    restart: unless-stopped
```

```bash
cp .env.example .env   # set ADMIN_PASSWORD_HASH and JWT_SECRET
docker compose up -d    # pulls the image on first run
```

#### Build from source

```bash
# 1. Prepare a .env next to docker-compose.yml
cp .env.example .env
#    set ADMIN_PASSWORD_HASH (npm run hash-password) and JWT_SECRET

# 2. Build and start
docker compose up -d --build

# 3. Open http://your-server:3000
```

- `./content` is mounted into the container. On first save, Ansora `git init`s
  it as its own repository, so every autosave is a commit on the host.
- Want off-box backups? Point the mounted repo at a remote and set `GIT_AUTO_PUSH=true`.
- The Docker image uses Next.js standalone output — the runtime is a single
  small `server.js`, no Node modules bloat in the final layer.
- All published image tags are available on [GitHub Packages](https://github.com/instax-dutta/ansora/pkgs/container/ansora).

### 4. Render (one-click Docker)

Use the [Deploy to Render button](#deploy-in-one-click) — the `render.yaml` blueprint
builds the same Dockerfile with a persistent 1 GB disk mounted at `/app/content`.
After the first deploy, set `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `JWT_SECRET`
and `SITE_URL` in the Render dashboard (they're intentionally not baked in).

### 5. Railway (one-click Docker)

Use the [Deploy on Railway button](#deploy-in-one-click) — the `railway.json` config
builds the same Dockerfile with zero configuration. Railway detects the three
required env vars (`ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `JWT_SECRET`) from
the `.env.example` file and prompts you to fill them in during setup.

> Railway's free tier includes $5 of monthly credits (~$0.02/hr for the
> cheapest plan), enough to run this app continuously for ~250 hours per month.
> No credit card is required to sign up.

---

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DEPLOYMENT_MODE` | no | `self-hosted` | `self-hosted` \| `serverless` — selects the content adapter |
| `ADMIN_USERNAME` | **yes** | — | Admin login username |
| `ADMIN_PASSWORD_HASH` | **yes** | — | bcrypt hash (never plaintext); generate with `npm run hash-password` |
| `JWT_SECRET` | **yes** | — | ≥32 random chars; signs the admin session cookie |
| `SITE_URL` | no | `http://localhost:3000` | Public base URL for canonical links, sitemap, RSS, OG tags |
| `CONTENT_DIR` | no | `./content` | Content directory (self-hosted) |
| `GIT_AUTO_PUSH` | no | `false` | Push content commits to a remote after every save |
| `GIT_USER_NAME` / `GIT_USER_EMAIL` | no | `Ansora` / `ansora@localhost` | Git identity used when the content repo has none |
| `GITHUB_REPO` | serverless | — | `owner/repo` that stores content |
| `GITHUB_TOKEN` | serverless | — | Personal access token with repo write scope |
| `GITHUB_BRANCH` | no | `main` | Branch to read/write |
| `GITHUB_CONTENT_PATH` | no | `content/posts` | Posts folder inside the repo |
| `GITHUB_SITE_CONFIG_PATH` | no | `content/site.config.json` | Site config file inside the repo |
| `CONTENT_REPO_MODE` | no | `same-repo` | `same-repo` (content in the app repo) or `external-repo` (separate content repo) — mostly affects how you back up |

> **Never commit real secrets.** `.env*` is gitignored (`.env.example` is kept).
> In serverless mode the GitHub token needs write access: a fine-grained PAT
> with **Contents: Read and write** on the content repo, or a classic token
> with the `repo` scope.

---

## Verify serverless mode against a real repo

A harness is included that drives the whole flow against a real GitHub repo —
login, create/publish/rename/delete a scratch post, settings, and it verifies
that every write landed as a commit. It snapshots the repo first and restores
it afterwards, so your content is untouched.

```bash
# 1. Point .env.local at a repo you own (a fresh empty repo is ideal):
#      DEPLOYMENT_MODE=serverless
#      GITHUB_REPO=you/your-content-repo
#      GITHUB_TOKEN=<fine-grained PAT: Contents read+write>

# 2. Run the harness (builds the app in serverless mode first)
bash scripts/verify-serverless.sh
```

It exits 0 only if every check passed. The checks include: drafts stay 404 on
the public site, a no-op re-save creates no commit (for drafts *and* published
posts), publishing updates the public pages, renaming a slug moves the file,
settings persist to `site.config.json`, and the commit history for the scratch
post is verified through the GitHub API.

> The harness snapshots and then restores the repo, but **don't run it while
> anything else is committing to that repo** — restore is a full-state
> round-trip and would delete files that appeared during the run.

---

## The content model

A post is a markdown file in `content/posts/<slug>.md`:

```markdown
---
title: string            # required
slug: string             # required, unique, lower-kebab-case
date: ISO-date           # required
updated: ISO-date        # optional, stamped on edits to published posts
excerpt: string          # required to publish — used for meta description & cards
coverImage: url          # optional, external URL
tags: [string]           # optional
published: boolean       # default false
focusKeyword: string     # optional — powers the SEO/AEO scorer
seo:
  metaTitle: string      # optional, falls back to title
  metaDescription: string# optional, falls back to excerpt
  canonicalUrl: string   # optional
  noIndex: boolean       # default false
faq:                     # optional — emits FAQPage JSON-LD
  - question: string
    answer: string
---
```

Frontmatter is validated with zod; the admin editor writes it for you.

## What ships automatically (SEO/AEO)

- `BlogPosting` JSON-LD on every post (author, dates, headline, image).
- `FAQPage` JSON-LD when `faq` frontmatter is present.
- `rss.xml` (RSS 2.0), `sitemap.xml`, `robots.txt`, and `llms.txt` (the plain-text AI-crawler index) — all generated.
- Canonical URLs, Open Graph + Twitter cards, reading time, and an auto table of contents on posts over ~800 words.
- A **real SEO/AEO scorer** in the editor: title length, meta length, focus-keyword placement (title/first 100 words/headings/slug), heading hierarchy, thin-content warnings, readability heuristics, link and image-alt checks, FAQ-presence advice, and an excerpt-style check — weighted to a 0–100 score with a per-check checklist.

## Admin

All under `/admin` (redirects to `/admin/login` when unauthenticated; the login
endpoint is rate-limited with a basic in-memory throttle):

- **Dashboard** — post counts, recent activity, storage-mode info.
- **Posts** — searchable/filterable table with publish toggle and delete.
- **Editor** — split-pane Markdown editor with toolbar shortcuts, live preview
  through the *same* render pipeline as the public site, frontmatter sidebar,
  FAQ repeater, and autosave (debounced ~3s — every save is a git commit).
- **Settings** — site title/description/base URL/social links, plus **Appearance** (visual style preset, accent color, corner radius, heading font) — all stored in `content/site.config.json`.

## Project structure

```
content/            posts + site.config.json (your actual content)
scripts/            hash-password.mjs, github-repo.mjs, verify-serverless.sh
src/
  app/              public site + /admin + API routes (App Router)
  components/       shared + admin components (Markdown renderer, editor, …)
  lib/
    content/        ContentAdapter interface + LocalGit & GitHub adapters
    auth/           JWT session + login throttling
    markdown/       render pipeline config, TOC extractor, SEO scorer
    seo/            JSON-LD builders

tests/              colocated *.test.ts(x) next to the code they cover (vitest)
                    UI component tests run in jsdom via a `// @vitest-environment jsdom` docblock
                    Admin API routes are integration-tested end-to-end (real handlers,
                    real JWT/validation; only the adapter + cookie store are mocked)
```

## Development

```bash
npm run dev            # local dev (turbopack)
npm run build          # production build
npm run lint           # eslint
npm run typecheck      # tsc --noEmit
npm test               # vitest — unit tests (SEO scorer + both adapters)
npm run test:watch     # vitest in watch mode
npm run hash-password  # generate ADMIN_PASSWORD_HASH

# Serve the production build locally (standalone output):
cp -r .next/static .next/standalone/.next/static && cp -r public .next/standalone/public
CONTENT_DIR=$PWD/content node .next/standalone/server.js
```

> The project uses Next.js `output: "standalone"` (that's what the Docker image
> runs). For that reason `next start` prints a warning and should not be used
> in production — the standalone server above is the supported path, and the
> Dockerfile does exactly this.

The public blog reads content through the same adapter the admin writes with,
so you can edit `content/posts/*.md` by hand and see it live immediately in
self-hosted mode.

## License

[MIT](./LICENSE) — do whatever you like, and if you ship something with it,
we'd love to know.
