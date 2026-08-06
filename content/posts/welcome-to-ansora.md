---
title: Welcome to Ansora — a blogging platform that lives in git
slug: welcome-to-ansora
date: 2026-07-01T09:00:00.000Z
updated: 2026-07-12T14:30:00.000Z
excerpt: Ansora is a self-hostable blogging platform where every post is a markdown file and every save is a git commit — no database, no SaaS fees, no lock-in.
coverImage: https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1600&q=80
tags:
  - ansora
  - blogging
  - meta
published: true
focusKeyword: self-hosted blogging platform
seo:
  metaTitle: Welcome to Ansora — Markdown Blogging That Lives in Git
  metaDescription: Ansora is a self-hostable blogging platform where every post is a markdown file and every save is a git commit. No database, no SaaS fees, no lock-in.
  noIndex: false
faq:
  - question: Does Ansora use a database?
    answer: No. Every post is a plain markdown file with YAML frontmatter inside a git repository. Your content is portable by definition — clone it, grep it, or move it anywhere.
  - question: Can I run Ansora for free?
    answer: Yes. Deploy it to Vercel or Netlify with a free tier and store content in a GitHub repository, or run it on any small VPS with Docker. There is no hosted service to pay for.
  - question: How is publishing on a serverless host different from self-hosting?
    answer: On a VPS the public site reflects a save instantly. On serverless hosts a save commits to GitHub first, and the deploy hook you configure rebuilds the site — usually within a minute or two.
---

If you are reading this, you are probably standing on the porch of a brand-new blog. Welcome.

Ansora is a blogging platform with a deliberately unfashionable idea at its center: **your content should be plain markdown files in a git repository.** No database, no proprietary export format, no monthly invoice from a SaaS CMS. You own every byte, and every change you make in the admin editor becomes a real git commit.

## Why markdown, why git

Markdown is the closest thing the web has to a universal writing format. It is readable in any text editor, diffable, greppable, and it never goes out of style. Pair it with git and you get version history, rollbacks, and a complete audit trail of your writing — for free.

The platform you are looking at now was built around that idea:

- **Content is the source of truth.** The public site and the admin panel read the same files.
- **Saves are commits.** Autosave in the editor writes a markdown file and commits it.
- **Themes are code.** The whole site is a Next.js app you can style however you like.

## What you can do next

1. Open the [admin panel](/admin) — the default credentials come from `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH`.
2. Write a post in the split-pane editor and watch the live preview render it through the same pipeline as the public site.
3. Publish it, then check out the on-page SEO score — real checks for title, meta description, focus keyword, heading structure, and FAQ schema, not a placebo meter.

## Hosting choices

Ansora runs identically in two modes. On your own VPS, `DEPLOYMENT_MODE=self-hosted` reads and writes files on disk, so published posts appear instantly. On serverless hosts, `DEPLOYMENT_MODE=serverless` writes through the GitHub API and a deploy hook rebuilds the site shortly after.

Both modes share every feature. Only the storage adapter differs.

This blog is yours now. Make it loud, make it quiet, or keep it as empty as a well-kept notebook — it is all just markdown, after all.
