# src/lib — domain logic

## Purpose
All non-UI logic: content adapters, auth, markdown pipeline, SEO/AEO scoring, entity graph, machine-readable output, theming, site config, shared utils.

## Ownership
- `content/` — ContentAdapter pattern → see `content/AGENTS.md`
- `markdown/` — shared pipeline + SEO/AEO scorers + cross-post overlap → see `markdown/AGENTS.md`
- `auth/session.ts` — JWT (jose) + bcrypt credentials + login rate limiting (single file)
- `theme.ts` — theme presets (warm/ocean/forest/midnight + opencode/claude/minimax and their -dark variants) + `buildThemeCss`
- `site-config.ts` — `getSiteConfig()` with 30 s TTL; `SITE_URL` seeds `baseUrl` until changed in admin
- `seo/` — the AI-search layer → see `seo/AGENTS.md`
- `utils.ts` — slugify, `tagSlug`/`resolveTagFromSlug`, dates, word counts, escapeXml, stripMarkdown, truncate (pure, imported by client code)
- `content/concurrency.ts` — `mapWithConcurrency`, the bounded-parallelism helper used by the GitHub adapter

## Local Contracts
- `auth/session.ts`: env credentials only; `verifyCredentials` **throws** on misconfiguration and runs a dummy bcrypt compare on username mismatch (no timing oracle); rate limit 5 failed attempts / 15 min per IP (in-memory, per-instance — soft in serverless) with a hard 10k-IP map cap; `isCrossOrigin(request)` is the CSRF guard used by every mutating admin API route.
- `theme.ts`: palette hex lives here and in the `globals.css` fallbacks; accent derivation is WCAG-aware (`textOn`/`contrast`); `buildThemeCss` emits `html:root`/`html.dark` custom properties.
- `utils.ts` `tagSlug`/`resolveTagFromSlug`: tags are stored and displayed verbatim, and these are pure URL helpers. Resolution is slug-based and case/encoding-insensitive so **legacy raw-tag URLs keep working**; every tag link must go through `tagSlug()`. Never rewrite a stored tag to its slug form.
- Caches (site-config 30 s, GitHub adapter 60 s) are **per-instance** — never rely on cross-instance invalidation.

## Work Guidance
- Keep `utils.ts` side-effect-free and node-import-free (client code imports it).
- Schema changes in `content/types.ts` must be mirrored in both adapters, the defaults, and the admin `SettingsForm`.
- Any new bulk surface that needs post *bodies* must go through `content/bodies.ts`, never `adapter.getPost()` in a loop — the cap and the wall-clock budget are a rate-limit and timeout guard, not a style choice.
- **`listPosts()` must fetch file contents with `mapWithConcurrency`, never a sequential `for … await`.** Frontmatter needs the file body, so listing N posts costs N content reads; doing them serially made every uncached page pay N round-trip latencies.

## Verification
- `npx vitest run src/lib` (adapters, theme, seo-score, aeo-score, validate, backward-compat, utils tests).

## Child DOX Index
| Path | Scope |
|---|---|
| `content/AGENTS.md` | adapter interface + LocalGit + GitHub adapters, body loading, related-post rules |
| `markdown/AGENTS.md` | shared pipeline, renderer, SEO + AEO scorers |
| `seo/AGENTS.md` | entity graph, publish policy, markdown docs, previews, metadata helpers |
