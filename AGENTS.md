# DOX framework
- DOX is a highly performant AGENTS.md hierarchy installed in this repository
- Agent must follow DOX instructions across any edits

## Core Contract
- AGENTS.md files are binding work contracts for their subtrees
- Work products, source materials, instructions, records, assets, and durable docs must stay understandable from the nearest applicable AGENTS.md plus every parent AGENTS.md above it

## Read Before Editing
1. Read the root AGENTS.md
2. Identify every file or folder you expect to touch
3. Walk from the repository root to each target path
4. Read every AGENTS.md found along each route
5. If a parent AGENTS.md lists a child AGENTS.md whose scope contains the path, read that child and continue from there
6. Use the nearest AGENTS.md as the local contract and parent docs for repo-wide rules
7. If docs conflict, the closer doc controls local work details, but no child doc may weaken DOX
Do not rely on memory. Re-read the applicable DOX chain in the current session before editing.

## Update After Editing
Every meaningful change requires a DOX pass before the task is done.
Update the closest owning AGENTS.md when a change affects:
- purpose, scope, ownership, or responsibilities
- durable structure, contracts, workflows, or operating rules
- required inputs, outputs, permissions, constraints, side effects, or artifacts
- user preferences about behavior, communication, process, organization, or quality
- AGENTS.md creation, deletion, move, rename, or index contents
Update parent docs when parent-level structure, ownership, workflow, or child index changes. Update child docs when parent changes alter local rules. Remove stale or contradictory text immediately. Small edits that do not change behavior or contracts may leave docs unchanged, but the DOX pass still must happen.

## Hierarchy
- Root AGENTS.md is the DOX rail: project-wide instructions, global preferences, durable workflow rules, and the top-level Child DOX Index
- Child AGENTS.md files own domain-specific instructions and their own Child DOX Index
- Each parent explains what its direct children cover and what stays owned by the parent
- The closer a doc is to the work, the more specific and practical it must be

## Child Doc Shape
- Create a child AGENTS.md when a folder becomes a durable boundary with its own purpose, rules, responsibilities, workflow, materials, or quality standards
- Work Guidance must reflect the current standards of the project or user instructions; if there are no specific standards or instructions yet, leave it empty
- Verification must reflect an existing check; if no verification framework exists yet, leave it empty and update it when one exists
Default section order:
- Purpose
- Ownership
- Local Contracts
- Work Guidance
- Verification
- Child DOX Index

## Style
- Keep docs concise, current, and operational
- Document stable contracts, not diary entries
- Put broad rules in parent docs and concrete details in child docs
- Prefer direct bullets with explicit names
- Do not duplicate rules across many files unless each scope needs a local version
- Delete stale notes instead of explaining history
- Trim obvious statements, repeated rules, misplaced detail, and warnings for risks that no longer exist

## Closeout
1. Re-check changed paths against the DOX chain
2. Update nearest owning docs and any affected parents or children
3. Refresh every affected Child DOX Index
4. Remove stale or contradictory text
5. Run existing verification when relevant
6. Report any docs intentionally left unchanged and why

## User Preferences
- **Positioning (user-stated):** Ansora should sit between "professional and crappy" — powerful enough for professionals, yet simple enough for **non-technical writers** to run and publish without help. Never let the product drift toward either extreme: no enterprise complexity, and no amateur-quality output.
- When the user requests further durable behavior changes, record them here or in the relevant child AGENTS.md

## Ansora project rules (do not weaken these)
- **No database, no external CMS.** Markdown files + git are the only state. Never introduce a DB/ORM.
- **Single admin per deployment.** Env-var credentials only — never multi-user auth or third-party providers.
- **No deployment-mode branching** outside `src/lib/content/index.ts` (`getAdapter`). Features must work identically in `self-hosted` and `serverless` modes.
- **All content I/O goes through `getAdapter()`** — never read/write content files or the GitHub API directly elsewhere.
- **Every save is a commit; no-op saves never create commits** (both adapters guard this — preserve it).
- **Drafts are private** — unpublished posts must 404 on every public route (pages, RSS, sitemap, llms.txt, JSON-LD).
- **No plaintext secrets** — only the bcrypt `ADMIN_PASSWORD_HASH`; never log credentials or tokens.
- **Components use theme tokens, not hex colors.** Palette hex lives only in `src/lib/theme.ts` and the `globals.css` fallbacks.
- **SEO/AEO surface is non-negotiable** — canonical URLs, metadata, JSON-LD, RSS/sitemap/robots/llms.txt stay correct.
- **Deep reference:** `foundation.md` is the canonical codebase knowledge doc — read it before major work.

## Child DOX Index
| Path | Scope | Contract |
|---|---|---|
| `content/AGENTS.md` | posts + site.config.json (the actual content) | content model, frontmatter, drafts |
| `scripts/AGENTS.md` | hash-password, github-repo, verify-serverless | CLI helpers + harness |
| `src/AGENTS.md` | the Next.js app source | app-wide rules + routes/components/lib index |

Root-owned files: `README.md`, `foundation.md`, `LICENSE`, `Dockerfile`, `docker-compose.yml`, `render.yaml`, `package.json`, `next.config.ts`, `.env.example`, `vitest.config.mts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `.gitignore`, `.dockerignore`.
