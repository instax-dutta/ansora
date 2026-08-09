# src/lib/content — content storage adapters

## Purpose
The **ContentAdapter pattern** — the heart of Ansora. All content I/O goes through one interface with two implementations, selected at runtime by `DEPLOYMENT_MODE`.

## Ownership
- `index.ts` — `ContentAdapter` interface + `getAdapter()` (the **only** place that branches on `DEPLOYMENT_MODE`)
- `local-git.ts` — `LocalGitAdapter`: disk + `simple-git` commits (optional push via `GIT_AUTO_PUSH`)
- `github.ts` — `GitHubApiAdapter`: octokit Contents API, SHA-based updates, 60 s `TtlCache` reads
- `types.ts` — zod schemas: `postMetaSchema`, `siteConfigSchema`, `themeConfigSchema` + defaults
- `cache.ts` — `TtlCache` (in-memory, per-instance)

## Local Contracts
- Interface: `readonly mode`, `listPosts`, `getPost`, `savePost`, `deletePost`, `getSiteConfig`, `saveSiteConfig`.
- **No-op guard:** a byte-identical save must NOT create a commit — in both adapters. Preserve it.
- GitHub adapter: fetch the current file **SHA before every update**; treat 404s as "absent/empty" (a fresh repo is empty, not an error).
- New storage features must be implemented in **both** adapters or not added at all.

## Work Guidance
- Never call the GitHub API or read content files outside this folder.
- Keep reads cached with short TTLs — the GitHub REST API is rate-limited.
- Schema changes (`types.ts`) ripple to: both adapters' serialization, `DEFAULT_SITE_CONFIG`, `serializeFrontmatter`, and the admin `SettingsForm`.

## Verification
- `npx vitest run src/lib/content` (local-git.test.ts, github.test.ts, validate.test.ts).

## Child DOX Index
- No child AGENTS.md files needed.
