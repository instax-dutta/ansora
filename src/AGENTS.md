# src — Next.js app source

## Purpose
The Ansora application: App Router routes, components, and library code. Everything under here is strict TypeScript.

## Ownership
- `app/` — routes (public site, admin, API, machine-readable endpoints) → see `app/AGENTS.md`
- `components/` — shared + admin UI → see `components/AGENTS.md`
- `lib/` — domain logic (content, markdown, auth, theme, seo) → see `lib/AGENTS.md`
- `test/setup.ts` — vitest setup: RTL `cleanup()` + rAF polyfill

## Local Contracts
- TypeScript strict — `npm run typecheck` must pass.
- Import alias `@/` → `src/`.
- No branching on `DEPLOYMENT_MODE` outside `lib/content/index.ts`.
- No DB, no multi-user auth (see root `AGENTS.md` rules).
- **Backwards compatibility is a product requirement, not a nicety.** Ansora runs live blogs, and their content is markdown files in git that this app may never be able to migrate. Before changing a schema, a URL or a route, check `lib/AGENTS.md` and the backward-compat rules in `lib/content/AGENTS.md`.

## Work Guidance
- Colocate `*.test.ts(x)` next to the code (vitest; node env by default, `// @vitest-environment jsdom` docblock for UI tests).
- Run `npm run typecheck && npm run lint && npm test` before finishing, plus `npm run build` when routes changed.

## Verification
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## Child DOX Index
| Path | Scope |
|---|---|
| `app/AGENTS.md` | routes: (public)/, admin/, api/, machine-readable endpoints |
| `components/AGENTS.md` | shared + admin UI components |
| `lib/AGENTS.md` | domain logic: content, markdown, auth, theme, seo |
