---
title: The Markdown & SEO Cheat Sheet That Ships With Ansora
slug: markdown-seo-cheat-sheet
date: 2026-07-18T10:00:00.000Z
excerpt: Everything Ansora renders out of the box — syntax-highlighted code, tables, FAQ schema, RSS, sitemaps, and llms.txt — plus the SEO habits that move the needle.
coverImage: https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1600&q=80
tags:
  - markdown
  - seo
  - guides
published: true
focusKeyword: markdown seo
seo:
  metaTitle: The Markdown & SEO Cheat Sheet
  metaDescription: Everything Ansora renders out of the box — highlighted code, tables, FAQ schema, RSS, sitemaps, llms.txt — plus the SEO habits that actually move the needle.
faq:
  - question: Does Ansora support syntax-highlighted code blocks?
    answer: Yes. Fenced code blocks are highlighted with Shiki through rehype-pretty-code. Just tag the fence with a language, like ```ts.
  - question: What structured data does Ansora emit automatically?
    answer: Every post gets BlogPosting JSON-LD. Posts with a FAQ block also get FAQPage schema, and the site ships RSS, sitemap.xml, robots.txt and llms.txt.
---

This post is a living demonstration: every rendering feature Ansora ships with is used somewhere on this page.

## Code blocks, highlighted

Fenced code blocks get Shiki syntax highlighting automatically. Pick a language and write:

```ts
import { getAdapter } from "@/lib/content";

// Every save is a real git commit.
const posts = await getAdapter().listPosts();
const published = posts.filter((post) => post.published);
console.log(`Publishing ${published.length} posts.`);
```

No language tag? No problem — the block still gets the nice theme:

```text
This is a plain text fence.
```

## Tables

GitHub-flavored markdown tables render as real tables:

| Feature            | Self-hosted  | Serverless |
| ------------------ | ------------ | ---------- |
| Publish latency    | Instant      | ~1–2 min   |
| Needs a VPS        | Yes          | No         |
| Needs GitHub token | No           | Yes        |

## Links and images

Links open externally in a new tab; images lazy-load with the alt text you provide. The editor's SEO panel will nag you if any image is missing alt text — it is not being petty, alt text is genuinely good for everyone.

## Headings structure the page

H2 and H3 headings feed the table of contents on posts longer than ~800 words, and the SEO scorer checks that you never skip a heading level. Keep it tidy: H1 is reserved for the title, then H2s, then H3s underneath them.

## SEO habits that pay rent

1. **Write the meta description yourself** — 120–160 characters, with the focus keyword in it.
2. **Use the focus keyword in the title, first 100 words, one heading, and the slug.**
3. **Add a FAQ block to posts over 500 words** — Ansora emits FAQPage schema, which is one of the strongest levers for appearing in AI-generated answers.
4. **Make your excerpt a direct answer**, not a teaser. "This post explains how to self-host a blog" beats "In this post we'll explore…".

## AEO: think like a question

Answer engines quote declarative sentences. If your excerpt reads like a short, quotable answer — and your FAQ entries are genuine Q&A pairs — you are far more likely to be cited than a blog that hedges.

That is the whole cheat sheet. The rest is writing well, which no framework can do for you.
