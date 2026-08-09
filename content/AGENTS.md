# content — the blog's actual content

## Purpose
Posts (`content/posts/*.md`) and site configuration (`content/site.config.json`). This is the *product*: markdown files that become git commits on every save (locally or to GitHub) and are the only source of truth.

## Ownership
- `posts/` — one markdown file per post
- `site.config.json` — site-level settings: title, description, baseUrl, author, defaultOgImage, social links, theme

## Local Contracts
- Frontmatter is validated by zod (`postMetaSchema` in `src/lib/content/types.ts`); the admin editor writes it, hand-edits must match the schema.
- Required to publish: `title`, `slug` (unique, kebab-case), `date`, `excerpt`. `published: false` = draft (never served publicly).
- `coverImage` must be an **external URL** — there is deliberately no upload feature.
- `site.config.json` keys: `title`, `description`, `baseUrl`, `author`, `defaultOgImage`, `social{twitter,github,linkedin}`, `theme{preset,accent,radius,headingFont}`. Older files without `theme` get schema defaults.
- In `serverless` mode the in-repo `content/` is a template; live content lives in the configured GitHub content repo.

## Work Guidance
- Prefer editing through the admin panel (`/admin`) so saves commit correctly. Humans may hand-edit files in self-hosted mode (the app reads disk directly); app code itself must still go through `getAdapter()` (see root rules).
- Keep slugs stable after publication — renaming breaks URLs, RSS history, and canonical links.
- Theme/Appearance changes are stored here too (Settings → Appearance in the admin).

## Verification
- `npm test` — schema + adapter tests validate the content model.

## Child DOX Index
- No child AGENTS.md files needed.
