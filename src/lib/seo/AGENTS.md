# src/lib/seo — the AI-search layer

## Purpose
Everything that decides how the site reads to a machine: the entity graph, the indexability policy, the machine-readable endpoints, the editor previews, and the metadata helpers.

## Ownership
- `jsonld.ts` — entity ids (`#website`, `#organization`, `#author`, `#blog`) + `siteEntityNodes()` + `buildPostGraph` / `buildListingGraph` / `buildTagGraph` / `buildTagsIndexGraph` / `buildAboutGraph` + `serializeJsonLd()`
- `publish.ts` — `isIndexable()` / `indexableSorted()` / `collectTags()`: the shared indexability policy
- `markdown-doc.ts` — markdown documents served by `/md/*` (pure, testable)
- `metadata.ts` — `withFeeds()` / `feedAlternateTypes()`: canonical + feed autodiscovery
- `preview.ts` — `truncate`, `resolveSerp`, `resolveSocial` for the editor previews
- `jsonld.test.ts` — escaping hardening; `jsonld.graph.test.ts` — graph shape and entity resolution

## Local Contracts
- **One self-contained `@graph` per page.** Every page emits the four site entities *plus* its own page entity, cross-referenced by `@id`. Do not emit a node that references an `@id` the page does not also define: a dangling reference is weaker than no reference at all, and a post author must resolve to the same `Person` every time.
- **Post JSON-LD must mirror visible content.** `BreadcrumbList` is only legal alongside a rendered breadcrumb; `speakable` cssSelectors (`.post-answer`, `.post-faq`) only exist when those blocks render. Add the element when you add the selector.
- **`serializeJsonLd()` for every embed** — always go through `<JsonLd>` or `serializeJsonLd()`, never raw `JSON.stringify`. It escapes `<`, `>`, `&`, U+2028/29.
- **`isIndexable()` is the only indexability gate.** A post is indexable when `published && !seo.noIndex`. Every machine-discovery surface (sitemap, RSS, JSON feed, llms.txt, llms-full.txt, related/neighbour links) must use it. Missing it on one surface is a real bug: a noIndex post that is advertised in a feed is still being advertised.
- **Draft privacy is separate and stricter.** Drafts are excluded from HTML pages, `/md/*`, and every feed. `published` gates visibility; `noIndex` gates indexing. Never collapse them.
- **A route that sets `alternates` must use `withFeeds()`.** Next.js 16 *replaces* `alternates` rather than deep-merging it, so returning a bare `{ canonical }` silently drops the feed autodiscovery links. This is the single easiest regression to reintroduce in this folder.
- **Page titles that must not be re-templated use `title.absolute`.** The root layout applies a `%s · <site title>` template, so a plain string title on the home page renders as "Ansora · Ansora".
- `SITE_LANGUAGE` is the single place the site locale is declared; the root layout's `<html lang>` is the other.

## Work Guidance
- Prefer a pure, exported function over inline JSX for anything a route or the editor computes, so it can be unit tested without rendering.
- Feed/sitemap output must stay correct on degraded input: escape XML, escape CDATA terminators, and never throw when the content adapter is unreachable.
- Tag URLs are normalized on output only. Store tags verbatim (`tagSlug` lives in `utils.ts`).

## Verification
- `npx vitest run src/lib/seo`
- `npx vitest run src/app/api/seo-routes.test.ts` (sitemap, robots, RSS, llms.txt, llms-full.txt, feed.json end to end with a mocked adapter)
