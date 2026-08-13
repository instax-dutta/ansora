# src/lib — domain logic

## Purpose
All non-UI logic: content adapters, auth, markdown pipeline, SEO scoring, theming, site config, shared utils.

## Ownership
- `content/` — ContentAdapter pattern → see `content/AGENTS.md`
- `markdown/` — shared pipeline + SEO/AEO scorer → see `markdown/AGENTS.md`
- `auth/session.ts` — JWT (jose) + bcrypt credentials + login rate limiting (single file)
- `theme.ts` — theme presets (warm/ocean/forest/midnight + opencode/claude/minimax and their -dark variants) + `buildThemeCss`
- `site-config.ts` — `getSiteConfig()` with 30 s TTL; `SITE_URL` seeds `baseUrl` until changed in admin
- `seo/jsonld.ts` — BlogPosting + FAQPage structured data builders
- `utils.ts` — slugify, dates, word counts, escapeXml, stripMarkdown (pure, imported by client code)

## Local Contracts
- `auth/session.ts`: env credentials only; `verifyCredentials` **throws** on misconfiguration; rate limit 5 failed attempts / 15 min per IP (in-memory, per-instance — soft in serverless).
- `theme.ts`: palette hex lives here and in the `globals.css` fallbacks; accent derivation is WCAG-aware (`textOn`/`contrast`); `buildThemeCss` emits `html:root`/`html.dark` custom properties.
- Caches (site-config 30 s, GitHub adapter 60 s) are **per-instance** — never rely on cross-instance invalidation.

## Work Guidance
- Keep `utils.ts` side-effect-free and node-import-free (client code imports it).
- Schema changes in `content/types.ts` must be mirrored in both adapters, the defaults, and the admin `SettingsForm`.

## Verification
- `npx vitest run src/lib` (adapters, theme, seo-score, validate tests).

## Child DOX Index
| Path | Scope |
|---|---|
| `content/AGENTS.md` | adapter interface + LocalGit + GitHub adapters |
| `markdown/AGENTS.md` | shared pipeline, renderer, SEO/AEO scorer |
