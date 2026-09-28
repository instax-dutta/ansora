# content — the blog's actual content

## Purpose
Posts (`content/posts/*.md`) and site configuration (`content/site.config.json`). This is the *product*: markdown files that become git commits on every save (locally or to GitHub) and are the only source of truth.

## Ownership
- `posts/` — one markdown file per post
- `site.config.json` — site-level settings: title, description, baseUrl, author, authorBio, authorRole, defaultOgImage, social links, theme

## Local Contracts
- Frontmatter is validated by zod (`postMetaSchema` in `src/lib/content/types.ts`); the admin editor writes it, hand-edits must match the schema.
- Required to publish: `title`, `slug` (unique, kebab-case), `date`, `excerpt`. `published: false` = draft (never served publicly).
- `coverImage` must be an **external URL** — there is deliberately no upload feature.
- **Every field after v0.1 is optional and defaulted.** Old files load unchanged, and re-saving an old post must not add empty keys to it (`serializeFrontmatter` omits empty values; `src/lib/content/backward-compat.test.ts` enforces this). When adding a frontmatter field, add the serialization test too.
- `seo.noIndex: true` means "do not advertise this post to search engines, the sitemap, RSS, the JSON feed, or llms.txt" — it stays visible on the site.
- `site.config.json` keys: `title`, `description`, `baseUrl`, `author`, `authorBio`, `authorRole`, `defaultOgImage`, `social{twitter,github,linkedin}`, `theme{preset,accent,radius,headingFont}`. Older files without `theme` or the `author*` fields get schema defaults.
- In `serverless` mode the in-repo `content/` is a template; live content lives in the configured GitHub content repo.

## Optional frontmatter fields (all additive)
| Field | Purpose |
|---|---|
| `answer` | 40-60 word direct answer; rendered as a callout, targeted by `speakable` |
| `takeaways` | 3-5 bullets rendered as "Key takeaways" |
| `sources` | `[{title, url, author, year}]` rendered as attributed citations |
| `updatedReason` | Shown next to the Updated date |
| `coverImageAlt` | Alt text for the cover image (falls back to the post title) |
| `focusKeyword` | Powers the SEO scorer; optional for citability |

## Work Guidance
- Prefer editing through the admin panel (`/admin`) so saves commit correctly. Humans may hand-edit files in self-hosted mode (the app reads disk directly); app code itself must still go through `getAdapter()` (see root rules).
- Keep slugs stable after publication — renaming breaks URLs, RSS history, and canonical links.
- **Tags are stored verbatim** and only normalized for URLs. Never rewrite a tag to its slug form; `tagSlug()` in `src/lib/utils.ts` exists so that legacy raw-tag URLs keep resolving.
- Theme/Appearance changes are stored here too (Settings → Appearance in the admin).

## Verification
- `npm test` — schema + adapter tests validate the content model.
- `npx vitest run src/lib/content/backward-compat.test.ts` — after any frontmatter change.

## Child DOX Index
- No child AGENTS.md files needed.
