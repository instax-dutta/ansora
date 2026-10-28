# src/lib/analytics — content performance reporting

## Purpose
Determines what is read: a provider-neutral report contract, one adapter (Umami), bounded query validation, path→published-post mapping, cached aggregate reads, CSV export, explainable content opportunities, and the tracker/policy rules that decide what may be measured at all.

Analytics is **optional and opt-in**. An unconfigured deployment must behave exactly as it did before this folder existed.

## Ownership
- `types.ts` — provider-neutral shapes (`AnalyticsQuery`, `AnalyticsOverview`, `AnalyticsPageRow`, capabilities, failures). Non-negotiable rule: **an unsupported metric is `null`, never `0`.**
- `query.ts` — date/range validation: presets, custom ranges, IANA timezone checks, `previousPeriod()` (equal-length), `sanitisePathParam()`, `RANGE_PRESETS`, `DEFAULT_RANGE_DAYS` (30), `MAX_RANGE_DAYS` (366)
- `paths.ts` — `normalisePath()`, `classifyPath()`, `mapPageRowsToPosts()`, `withPageChange()`: the only place a provider path becomes a post
- `normalise.ts` — tolerant payload normalisation + `percentChange()` / `changeKind()`
- `resolve.ts` — `resolveAnalyticsConfig()` (config + env), `apiBaseFor()`, `siteTimezone()`, `trackerOriginOf()`, `cspAllowsTracker()`
- `provider.ts` — the `AnalyticsProvider` interface + factory (`null` is the normal "not configured" answer)
- `providers/umami.ts` — the Umami adapter (Bearer auth, hard timeout, one retry on 429/5xx, never on 401/403)
- `cache.ts` — per-instance TTL cache with single-flight de-duplication
- `csv.ts` — export with formula-injection and row-forgery protection
- `opportunities.ts` — `buildOpportunities()` / `buildOpportunitiesForPost()`, thresholded and explainable
- `privacy.ts` — `isTrackablePath()`, `TRACKING_EXCLUDED_*`, `trackerConfigFor()`
- `reports.ts` — the HTTP response shapes shared with the admin UI
- `errors.ts` — `AnalyticsError` + classification codes

## Local Contracts
- **No database, no event storage.** Pageviews are never written to markdown, never committed to git, and never counted in process memory. Reports are read from the configured provider and cached briefly; that is the whole design.
- **The content model is the source of truth for URLs.** `paths.ts` adapts provider paths to stored slugs and *never* rewrites a slug. Trailing slashes, percent-encoding and origins are normalised; nothing else is.
- **Only a `published` post may be named.** An unpublished slug resolves to `post: null`, so the dashboard cannot leak a draft's existence or title. Drafts also 404 on the per-post route.
- **`seo.noIndex` is displayed, not hidden.** Such a post keeps its traffic and is flagged; recommendations must never tell an author to "fix SEO" on a post they deliberately opted out.
- **Every provider failure is classified and renderable** (`unauthorized`, `rate_limited`, `timeout`, `unreachable`, `server_error`, `bad_response`, `unconfigured`). Messages never contain a credential, a header or a raw upstream body. A failure degrades the panel; it never throws through a page, and never affects rendering, publishing, feeds or SEO.
- **Credentials live only in `ANALYTICS_API_KEY`** (server-side, never `NEXT_PUBLIC_`). Public settings — provider, website ID, tracker URL — live in `site.config.json`. `resolveAnalyticsConfig` reports key *presence*, never the value.
- **`tracking` and `reporting` are separate questions.** A deployment can collect pageviews without a reporting key; conflating the two produces an empty dashboard and the wrong advice.
- **Every request is bounded**: max 366 days, path filters validated, limits capped, provider calls cached with a key that includes provider, site, range, timezone, granularity, report kind and filter.
- **Trend data is never only a chart.** Every chart ships the same numbers as a table, and metrics carry their definition in the UI.
- **Tracker exclusions are a privacy contract**: `/admin`, `/api`, `/md`, `/_next`, `/.well-known`, feeds and machine-readable endpoints are never tracked. The tracker is mounted in `(public)/layout.tsx` only, and disabled means no request at all.
- **The CSP analytics allowlist is a *build-time* input.** `next.config.ts` compiles the Content-Security-Policy into the routes manifest, so `ANALYTICS_SCRIPT_ORIGIN` must be set when the site is built. `ANSORA_ANALYTICS_CSP_ORIGINS` carries the baked list so the setup panel reports what the browser will actually enforce.

## Work Guidance
- New provider: implement `AnalyticsProvider` in `providers/`, add it to `provider.ts` **and** to the `provider` enum in `content/types.ts`, and declare capabilities honestly — the UI hides what a provider cannot report.
- New metric: add it to `types.ts` as nullable, normalise it in `normalise.ts`, and mark it "not reported" in the UI when null. Do not default it to `0`.
- Opportunity rules belong in `opportunities.ts` only; the table and the drilldown must never disagree about the same post.
- Keep `AnalyticsScript` dependency-free and mount it in the public layout, not the root layout.
- Provider HTTP calls belong in `providers/`; never call a provider from a page or component.

## Verification
- `npx vitest run src/lib/analytics` (query, paths, normalise, cache, csv, opportunities, privacy, resolve, provider)
- `npx vitest run src/app/api/admin/analytics` (route auth, CSRF, validation, degradation, CSV, draft 404)
- `npx vitest run src/components/admin/analytics src/components/AnalyticsScript.test.tsx` (UI states, tracker)
- `npx vitest run src/lib/content/backward-compat.test.ts` (existing configs stay byte-stable)

## Child DOX Index
- No child AGENTS.md files needed.
