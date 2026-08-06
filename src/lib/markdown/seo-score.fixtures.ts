import type { SeoInput } from "./seo-score";

/**
 * A deliberately well-optimized post: keyword everywhere it counts, 30–60 char
 * title, 120–160 char declarative excerpt, 300+ words, sequential h2/h3 (no
 * h1, no skips), short sentences, one link, one image with alt text, an FAQ
 * block. Every one of the 18 checks should pass → score 100.
 */
export const PERFECT: SeoInput = {
  title: "Self Hosting Your Blog on a Budget VPS in 2026",
  excerpt:
    "Self hosting a blog on a budget VPS is cheap, reliable, and entirely under your control. No lock-in, no per-user fees, just a server you own.",
  focusKeyword: "self hosting",
  slug: "self-hosting-a-blog-on-a-vps",
  metaDescription: "",
  faqCount: 1,
  content: [
    "Self hosting a blog on your own VPS keeps full control over your content. It costs less than managed platforms for serious traffic. You own the server and everything on it. That is the core appeal for many writers.",
    "",
    "## Why self hosting matters",
    "",
    "Self hosting removes the risk of a platform shutting down. It also removes surprise pricing changes. You can move hosts whenever you want. Your markdown files stay portable forever.",
    "",
    "### The real cost",
    "",
    "A small VPS costs a few dollars per month. A managed platform can charge far more as you grow. Self hosting pays off quickly for most blogs. You also keep unlimited custom domains. There is no per-seat licensing at all.",
    "",
    "## Getting started",
    "",
    "Pick any provider that offers a small Linux VPS. Install Docker and run the provided compose file. Point your domain at the server IP. Enable HTTPS with a free certificate. The whole setup takes about an hour.",
    "",
    "### Backups and portability",
    "",
    "Every post is a markdown file in git. Backups are simple clones of the repository. Restoring on a new server takes minutes. You never depend on a proprietary export tool. This is the strongest lock-in protection available.",
    "",
    "## Common questions",
    "",
    "Self hosting is not as hard as it sounds. Most tutorials assume prior server experience. You only need basic command line skills. The community has excellent guides for beginners.",
    "",
    "### When to avoid it",
    "",
    "Avoid self hosting if you want zero maintenance. Avoid it if uptime is absolutely critical. Managed platforms handle scaling for you. Choose the tradeoff that fits your situation.",
    "",
    "## Migrating later",
    "",
    "Switching hosts later is straightforward. Export your git repository and clone it elsewhere. Rebuild the container on the new machine. Update your DNS records and wait for propagation. Your site is back within the hour. There is no database to migrate at all.",
    "",
    "### Keeping it fast",
    "",
    "Static output keeps response times low. The site serves from memory with ISR caching. Images load from a CDN when configured. A simple blog rarely needs more than one small server. Performance stays excellent for years.",
    "",
    "### When self hosting wins",
    "",
    "Self hosting wins for personal blogs with steady traffic. It wins when you want full ownership of your content. It wins when cost matters over time. Choose it when you enjoy operating your own stack.",
    "",
    "[Example](https://example.com) is a useful reference.",
    "",
    "![Architecture diagram](https://example.com/arch.png)",
  ].join("\n"),
};

/** An empty post — only the negative checks can pass → score 23. */
export const EMPTY: SeoInput = {
  title: "",
  excerpt: "",
  focusKeyword: "",
  slug: "",
  content: "",
  metaDescription: "",
  faqCount: 0,
};
