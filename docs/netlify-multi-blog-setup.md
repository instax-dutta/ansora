# Netlify Multi-Blog Setup Guide

> Run multiple blogs from the same Ansora codebase — one per Netlify site, each with its own content repo, domain, admin login, and visual style.

---

## How Ansora makes this possible

Ansora is **one codebase that can be deployed N times.** It has no database — every post is a Markdown file, and every save in the admin panel is a git commit to a GitHub repository. The single thing that differs between your blogs is:

| Layer | What it is | Per blog? |
|---|---|---|
| **App code** | The Next.js app (this repo) | Same code, deployed N times |
| **Content** | A GitHub repo holding `content/posts/*.md` + `content/site.config.json` | **Separate repo per blog** |
| **Hosting** | Netlify site that builds the app and reads the content repo | **Separate site per blog** |
| **Admin login** | Env vars `ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH` | **Different credentials per site** |
| **Theme** | Visual style preset + accent/radius/font, stored in `site.config.json` | **Different look per site** |

The adapter (`DEPLOYMENT_MODE=serverless`) reads/writes the content repo over the GitHub API, so a save in the admin panel = a real commit on GitHub = your family's posts are version-controlled, backed up, and reversible for free.

---

## Example: the 3-blog plan

| Blog | Domain | Owner | Content repo | Visual style |
|---|---|---|---|---|
| **Personal** | `blogs.sdad.pro` | You | `you/personal-content` | Your preferred theme + accent |
| **Brother-in-law** | `blogs.numbervibes.in` | Him | `you/numbervibes-content` | His preferred theme + accent |
| **Sister** | `note.sdad.pro` (any subdomain) | Her | `you/sister-content` | Her preferred theme + accent |

Each content repo gets its own **fine-grained GitHub token** and its own **Netlify build hook**, so each person's edits can *only* touch their own repo — never anyone else's.

---

## Step-by-step setup

### Step 1 — Fork or clone Ansora

You need your own copy of Ansora on GitHub:

```bash
# If you haven't already, fork the repo or push your copy
# to your GitHub account. Each Netlify site will import from
# this same repository (no need to fork per blog).
```

> All three Netlify sites will point to the **same** Ansora repo for the app code. Each uses different env vars to talk to a different content repo.

---

### Step 2 — Create 3 content repos

On GitHub, create three **empty** repositories (no README, no .gitignore, no license):

- `personal-content`
- `numbervibes-content`
- `sister-content`

In each one, create the following folder structure with an example post:

```
content/
  posts/
    hello-world.md
  site.config.json
```

A minimal `content/posts/hello-world.md`:

```markdown
---
title: Welcome
slug: welcome
date: 2026-01-01
excerpt: Getting started with your new blog.
published: true
---

Welcome to your blog!
```

A minimal `content/site.config.json`:

```json
{
  "title": "My Blog",
  "description": "My corner of the web.",
  "baseUrl": "https://blogs.yourdomain.com",
  "author": "Your Name",
  "theme": {
    "preset": "warm",
    "accent": "",
    "radius": "soft",
    "headingFont": "serif"
  }
}
```

> **Tip:** For your sister's single-post blog, just create one post. She only needs `content/posts/` with a single `.md` file.

---

### Step 3 — Create 3 fine-grained GitHub tokens (security)

For each content repo, you need a **separate** GitHub token scoped to only that repo.

GitHub → Settings → **Developer settings** → **Fine-grained tokens** → **Generate new token**:

| Field | Value |
|---|---|
| **Token name** | e.g. `ansora-personal-content` |
| **Repository access** | **Only select repositories** → pick ONE content repo |
| **Permissions → Contents** | **Read and write** (Metadata: read comes automatically) |

Generate one token per content repo. Do not reuse tokens across repos.

Save the token values somewhere safe — you'll need them in Step 4 (one per Netlify site).

---

### Step 4 — Create 3 Netlify sites

For each blog, create a separate Netlify site:

1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project**
2. Connect your Git provider and select the **Ansora app repo** (the main codebase — **not** the content repos)
3. Configure the build:

| Setting | Value |
|---|---|
| **Base directory** | (leave empty) |
| **Build command** | `npm run build` |
| **Publish directory** | Leave the default (Netlify detects Next.js automatically) |

4. **Show advanced** → **Environment variables** — add these for **each** site:

| Variable | Your site | BIL's site | Sister's site |
|---|---|---|---|
| `DEPLOYMENT_MODE` | `serverless` | `serverless` | `serverless` |
| `ADMIN_USERNAME` | `you` | `bil-username` | `sister-username` |
| `ADMIN_PASSWORD_HASH` | *(your bcrypt hash)* | *(his bcrypt hash)* | *(her bcrypt hash)* |
| `JWT_SECRET` | *(≥32 char random)* | *(different ≥32 char random)* | *(different ≥32 char random)* |
| `SITE_URL` | `https://blogs.sdad.pro` | `https://blogs.numbervibes.in` | `https://note.sdad.pro` |
| `GITHUB_REPO` | `you/personal-content` | `you/numbervibes-content` | `you/sister-content` |
| `GITHUB_TOKEN` | *(token for personal)* | *(token for numbervibes)* | *(token for sister)* |
| `GITHUB_BRANCH` | `main` | `main` | `main` |
| `NEXT_TELEMETRY_DISABLED` | `1` | `1` | `1` |

> **Generate credentials:**
> - `ADMIN_PASSWORD_HASH`: Run `npm run hash-password` locally and enter the desired password. Give each person their own password.
> - `JWT_SECRET`: Run `openssl rand -base64 48` for each site (different secret per site).

5. Deploy the site.

---

### Step 5 — Set up build hooks (auto-publish)

When someone saves a post in the admin editor, it commits to their content repo on GitHub. A **build hook** tells Netlify to rebuild so the public site updates.

**Per site, in Netlify:**

1. Go to **Site configuration** → **Build & deploy** → **Continuous deployment** → **Build hooks**
2. Click **Add build hook** — name it e.g. `content-update`, pick any branch (`main`)
3. Copy the hook URL (it looks like `https://api.netlify.com/build_hooks/...`)

**Per content repo, on GitHub:**

1. Go to the content repo → **Settings** → **Webhooks** → **Add webhook**
2. Paste the Netlify build hook URL into **Payload URL**
3. Content type: `application/json`
4. **Which events?** → **Just the push event**
5. Click **Add webhook**

Repeat for all three site/repo pairs. Now every edit triggers a rebuild (~1–2 minutes).

> **Fallback:** Even without the webhook, the public pages use ISR with `revalidate = 300` seconds, so the site refreshes every 5 minutes automatically.

---

### Step 6 — Point domains

For each Netlify site:

1. Go to **Site configuration** → **Domain management** → **Add custom domain**
2. Enter the subdomain (e.g. `blogs.sdad.pro`, `blogs.numbervibes.in`, `note.sdad.pro`)
3. Netlify will prompt you to add a DNS record:
   - For subdomains (`blogs.sdad.pro`): create a **CNAME** record pointing `blogs` → `your-site.netlify.app`
   - For apex domains (e.g. `numbervibes.in` without subdomain): use a Netlify-managed DNS or an ALIAS/ANAME record
4. Netlify provisions an SSL certificate automatically (Let's Encrypt)

**DNS records summary:**

| Domain | Type | Name | Value |
|---|---|---|---|
| `sdad.pro` | CNAME | `blogs` | `personal-site.netlify.app` |
| `sdad.pro` | CNAME | `note` | `sister-site.netlify.app` |
| `numbervibes.in` | CNAME | `blogs` | `bil-site.netlify.app` |

Make sure `SITE_URL` in each site's env vars matches the custom domain exactly (with `https://`).

---

### Step 7 — Give each person their admin panel

Once deployed, each blog's admin panel is at `https://<their-domain>/admin`.

| Blog | Admin URL | Login |
|---|---|---|
| Personal | `https://blogs.sdad.pro/admin` | Your username + password |
| Brother-in-law | `https://blogs.numbervibes.in/admin` | His username + password |
| Sister | `https://note.sdad.pro/admin` | Her username + password |

**Walkthrough for each person:**

1. Visit `/admin` — you'll be redirected to `/admin/login`
2. Enter the credentials you set in the env vars
3. You'll land on the **Dashboard** — post counts, recent activity, storage mode
4. Click **Posts** to see the post table (filterable, searchable)
5. Click **New Post** to open the split-pane editor — write in Markdown on the left, see the live preview on the right
   - The SEO/AEO scorer on the right shows a 0–100 score with a real checklist (title length, keyword placement, headings, readability, images, FAQ)
6. Toggle **Published** to make a post visible on the public site
7. Click **Settings** → **Appearance** to customize the look:
   - Pick a **Style preset** (Warm, Ocean, Forest, Midnight)
   - Set a custom **Accent color** (via the color picker, hex input, or clickable swatch chips)
   - Choose **Corner radius** (Sharp, Soft, Rounded)
   - Choose **Heading font** (Serif or Sans)
8. **Save settings** — the change is committed to the content repo and the public site restyles within ~2 minutes

---

### Step 8 — Customize each blog's look

Each blog has its own `site.config.json` in its content repo, so each can look completely different. Go to **Settings → Appearance** per blog and pick:

| Blog | Suggested theme |
|---|---|
| **Personal** | Warm (terracotta + cream paper) or your own brand colors |
| **Brother-in-law** | Forest (earthy greens) or a custom accent matching his brand |
| **Sister** | Midnight (navy + warm gold) or Ocean (cool slate + teal) |

Each blog's theme is independent — changing one never affects the others.

---

### Step 9 — Test the flow

1. Log into each admin panel and confirm the Dashboard loads
2. Create a test post, publish it, and verify:
   - The post appears on the public blog within ~2 minutes (or 5 minutes via ISR)
   - The GitHub repo shows the new commit
   - The Netlify deploy log shows a triggered build
3. Change the appearance in Settings, save, and verify the CSS variables update on the public site
4. Draft a post and confirm it **does not** appear on the public site (404 or missing from index)

---

## Architecture recap

```
                    ┌─────────────────────┐
                    │  Ansora app repo     │  ← same code, deployed 3×
                    │  (github.com/you/    │
                    │   ansora)            │
                    └──────┬──────┬──────┬┘
                           │      │      │
              ┌────────────┘      │      └────────────┐
              ▼                   ▼                   ▼
     ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
     │ Netlify:         │ │ Netlify:         │ │ Netlify:         │
     │ blogs.sdad.pro   │ │ blogs.number     │ │ note.sdad.pro    │
     │                  │ │ vibes.in         │ │                  │
     │ Env:             │ │ Env:             │ │ Env:             │
     │  GITHUB_REPO=    │ │  GITHUB_REPO=    │ │  GITHUB_REPO=    │
     │  you/personal    │ │  you/numbervibes │ │  you/sister      │
     │  SITE_URL=...    │ │  SITE_URL=...    │ │  SITE_URL=...    │
     └────────┬─────────┘ └────────┬─────────┘ └────────┬─────────┘
              │                    │                    │
              ▼                    ▼                    ▼
     ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
     │ GitHub content   │ │ GitHub content   │ │ GitHub content   │
     │ repo: personal   │ │ repo: numbervibes│ │ repo: sister     │
     │ -content         │ │ -content         │ │ -content         │
     │                  │ │                  │ │                  │
     │ Token: scoped    │ │ Token: scoped    │ │ Token: scoped    │
     │ to this repo     │ │ to this repo     │ │ to this repo     │
     └─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## Maintenance checklist

| Task | Frequency | How |
|---|---|---|
| Update Ansora codebase | Occasionally | Pull latest from upstream, rebuild on Netlify (deploy) |
| Backup content repos | Never needed | Git already backs them up. Clone locally for a local copy. |
| Rotate GitHub tokens | Every 6–12 months | Generate new tokens, update Netlify env vars |
| Renew SSL | Never needed | Netlify manages Let's Encrypt automatically |
| Check build logs | If site doesn't update | Netlify → Site → Deploys — look for failed builds |

---

## FAQ

**Q: Do I need to fork Ansora per blog?**
No. All three Netlify sites import from the **same** app repo. The content repos and env vars are what make each blog unique.

**Q: Can each person have different admin credentials?**
Yes. Each Netlify site has its own `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH` env vars. Set them differently per site.

**Q: Can each blog look different?**
Absolutely. The theme (preset, accent color, radius, heading font) is stored in each content repo's `site.config.json`, so each blog can have a completely independent visual style.

**Q: What if my sister only wants a single post?**
Create one `.md` file in her content repo. The blog will render it as a single post. The homepage shows one post card, the post page shows the full article, and the archive/tags will be minimal. Perfect for a simple "about me" or announcement page.

**Q: Can I add more blogs later?**
Yes. Repeat Steps 2–6 for each new blog. Each gets its own content repo, token, Netlify site, and subdomain.

**Q: What about Netlify free tier limits?**
Netlify's free tier includes:
- **100 GB** bandwidth per site per month
- **300 build minutes** per site per month
- Each build takes ~1–2 minutes, so you get ~150–300 rebuilds per site per month
- Adding a new post triggers one build. Editing existing content also triggers one.
- For low-volume personal/family blogs, this is plenty. If you post daily, you'll well within the limit.

---

## Related

- [README.md](../README.md) — general deployment docs (all platforms)
- [Environment variables](../README.md#environment-variables) — full env var reference
- [Content model](../README.md#the-content-model) — post frontmatter schema
- [Appearance customization](../README.md#admin) — visual theme settings