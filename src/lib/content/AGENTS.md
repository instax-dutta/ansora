# src/lib/content — content storage adapters

## Purpose
The **ContentAdapter pattern** — the heart of Ansora. All content I/O goes through one interface with two implementations, selected at runtime by `DEPLOYMENT_MODE`.

## Ownership
- `index.ts` — `ContentAdapter` interface + `getAdapter()` (the **only** place that branches on `DEPLOYMENT_MODE`) + `safeListPosts()`
- `local-git.ts` — `LocalGitAdapter`: disk + `simple-git` commits (optional push via `GIT_AUTO_PUSH`)
- `github.ts` — `GitHubApiAdapter`: octokit Contents API, SHA-based updates, and tree-SHA-aware parsed-list caching
- `types.ts` — zod schemas: `postMetaSchema`, `siteConfigSchema`, `themeConfigSchema` + defaults; **strict vs tolerant parsing** (see below) (`accent` must be hex or empty; `baseUrl` must be an absolute http(s) URL)
- `slug.ts` — `isSafeSlug()` slug safety gate: both adapters call it before any slug touches a file path / repo path (path-traversal defense)
- `cache.ts` — `TtlCache` (in-memory, per-instance)
- `bodies.ts` — `loadRecentBodies` / `loadPublishedPost` / `loadPublishedBodies` for surfaces that need post *content*; bounded by a count cap **and** a wall-clock budget
- `concurrency.ts` — `mapWithConcurrency`, order-preserving bounded-parallelism helper
- `related.ts` — `relatedPosts()` / `postNeighbours()`: the crawl-graph rules (pure)

## Local Contracts
- Interface: `readonly mode`, `listPosts`, `getPost`, `savePost`, `deletePost`, `getSiteConfig`, `saveSiteConfig`.
- **Slug gate (security):** every adapter method that takes a slug validates it with `isSafeSlug()` first — invalid slugs read as absent (`getPost` → null, `deletePost` → no-op) and refuse writes (`savePost` throws). Never bypass this when adding adapter methods.
- **No-op guard:** a byte-identical save must NOT create a commit — in both adapters. Preserve it.
- GitHub adapter: fetch the current file **SHA before every update**; treat 404s as "absent/empty" (a fresh repo is empty, not an error).
- New storage features must be implemented in **both** adapters or not added at all.
- **Reads must never be taken down by bad data in one post.** This is the single most important rule in this folder, learned the hard way: a live blog went fully offline because one post had `answer: 2026` (YAML types that as a number, the schema wanted a string), `postMetaSchema.parse` threw inside `listPosts()`, and `safeListPosts()` degraded the whole site to an empty listing.
  - `normalizeFrontmatter()` — **strict, throws.** Use on the write path (`savePost`), where rejecting bad input is the point.
  - `normalizeFrontmatterLoose()` — **tolerant, cannot throw.** Use on every read path (`listPosts`, `getPost`). Validates field by field, falls back to that field's default, and returns the `problems` it found. Pass the slug/file name as `label` so the warning names the offender.
  - Both adapters must use the loose variant for reads. A read that can throw can take down every listing page on the site.
  - Unknown keys are ignored, so a field written by a newer Ansora version cannot break an older deploy.
- **A failure must never look like an empty blog.** `listStatus()` records a degraded listing and `ContentUnavailable` renders it. `safeListPosts()` still returns `[]` — that is correct for uptime — but no page may render that as "Nothing published yet". An author reads that as losing every post; a crawler reads it as a site with no content, which is how a working site gets deindexed.
  - The reason string is rendered publicly, so it goes through `describeAdapterError()`, which scrubs tokens, auth headers and stack traces, truncates, and maps 403/429 to a plain-language rate-limit message. Never interpolate a raw error into a page.
- **Transient failures get exactly one retry.** 403/429/5xx retry once after a short backoff on both `getTree` and `getFileRaw`. 404 is not an error — it means absent and must still translate to `null` on both the first attempt and the retry. Never loop: genuine quota exhaustion should still fail.
- **Forward concurrency changes: run a hostile test.** Put N posts in a content dir, make one field the wrong type, and confirm all N still render. A schema change that only gets the happy path tested is untested.
- **Backward compatibility is a hard contract.** Every frontmatter field added after v0.1 must be `.default()`-ed and omitted by `serializeFrontmatter` when empty, so opening and re-saving a pre-existing post does not rewrite the author's content repo. `backward-compat.test.ts` locks this in; extend it when you add a field.
- **`listPosts()` returns frontmatter only** — bodies are not cached with it. In the GitHub adapter `listPosts()` already fetches every post file and discards the body, so any surface needing bodies pays a second round of per-post requests. Route all of that through `bodies.ts` and keep the cap explicit.
- `relatedPosts` / `postNeighbours` must filter with the shared `isIndexable()` policy (drafts and noIndex posts are not link targets).
- **`listPosts()` must use `mapWithConcurrency(files, 16, …)`**, never a sequential loop. It already fetches every post file to parse frontmatter, so N posts means N content reads; serially that dominated the latency of every uncached page. **Width is 8, not 16:** concurrency does not change the number of calls, only how fast they arrive, and a burst is what trips a secondary rate limit — which blanks the whole site, not one post. The ~20% latency win was never worth that. This is *not* a freshness trade-off: the tree-SHA cache from `3fab213` is untouched, so a content commit still shows up immediately. Never add a persistent cache layer in front of `listPosts()` — that is precisely the regression `3fab213` fixed.
- `bodies.ts` loads sequentially on purpose: a parallel burst cannot be abandoned part-way, which would defeat the deadline.

## Work Guidance
- Never call the GitHub API or read content files outside this folder.
- Keep reads cached with short TTLs — the GitHub REST API is rate-limited.
- Schema changes (`types.ts`) ripple to: both adapters' serialization, `DEFAULT_SITE_CONFIG`, `serializeFrontmatter`, the admin `SettingsForm`, `PostEditor`'s `BLANK_META`, and the test fixtures in `validate.test.ts` / `backward-compat.test.ts`.

## Verification
- `npx vitest run src/lib/content` (local-git, github, validate, related, backward-compat).

## Child DOX Index
- No child AGENTS.md files needed.
