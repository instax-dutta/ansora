# src/lib/content — content storage adapters

## Purpose
The **ContentAdapter pattern** — the heart of Ansora. All content I/O goes through one interface with two implementations, selected at runtime by `DEPLOYMENT_MODE`.

## Ownership
- `index.ts` — `ContentAdapter` interface + `getAdapter()` (the **only** place that branches on `DEPLOYMENT_MODE`) + `safeListPosts()`
- `local-git.ts` — `LocalGitAdapter`: disk + `simple-git` commits (optional push via `GIT_AUTO_PUSH`)
- `github.ts` — `GitHubApiAdapter`: octokit Contents API, SHA-based updates, and tree-SHA-aware parsed-list caching
- `types.ts` — zod schemas: `postMetaSchema`, `siteConfigSchema`, `themeConfigSchema` + defaults (`accent` must be hex or empty; `baseUrl` must be an absolute http(s) URL)
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
- **Backward compatibility is a hard contract.** Every frontmatter field added after v0.1 must be `.default()`-ed and omitted by `serializeFrontmatter` when empty, so opening and re-saving a pre-existing post does not rewrite the author's content repo. `backward-compat.test.ts` locks this in; extend it when you add a field.
- **`listPosts()` returns frontmatter only** — bodies are not cached with it. In the GitHub adapter `listPosts()` already fetches every post file and discards the body, so any surface needing bodies pays a second round of per-post requests. Route all of that through `bodies.ts` and keep the cap explicit.
- `relatedPosts` / `postNeighbours` must filter with the shared `isIndexable()` policy (drafts and noIndex posts are not link targets).
- **`listPosts()` must use `mapWithConcurrency(files, 8, …)`**, never a sequential loop. It already fetches every post file to parse frontmatter, so N posts means N content reads; serially that dominated the latency of every uncached page. This is *not* a freshness trade-off: the tree-SHA cache from `3fab213` is untouched, so a content commit still shows up immediately. Never add a persistent cache layer in front of `listPosts()` — that is precisely the regression `3fab213` fixed.
- `bodies.ts` loads sequentially on purpose: a parallel burst cannot be abandoned part-way, which would defeat the deadline.

## Work Guidance
- Never call the GitHub API or read content files outside this folder.
- Keep reads cached with short TTLs — the GitHub REST API is rate-limited.
- Schema changes (`types.ts`) ripple to: both adapters' serialization, `DEFAULT_SITE_CONFIG`, `serializeFrontmatter`, the admin `SettingsForm`, `PostEditor`'s `BLANK_META`, and the test fixtures in `validate.test.ts` / `backward-compat.test.ts`.

## Verification
- `npx vitest run src/lib/content` (local-git, github, validate, related, backward-compat).

## Child DOX Index
- No child AGENTS.md files needed.
