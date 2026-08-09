# scripts — CLI helpers

## Purpose
Dev/admin helpers: password hashing, GitHub content-repo utilities, and the end-to-end serverless verification harness.

## Ownership
- `hash-password.mjs` — generates bcrypt hashes for `ADMIN_PASSWORD_HASH` (`npm run hash-password`)
- `github-repo.mjs` — `ls | get | snapshot | restore | commits` against a content repo (needs `GITHUB_REPO` + `GITHUB_TOKEN`)
- `verify-serverless.sh` — full serverless-mode harness (login, post CRUD, settings, commit verification; snapshots + restores the repo)

## Local Contracts
- `github-repo.mjs` needs env vars: run `node --env-file=.env.local scripts/github-repo.mjs <command>`.
- `snapshot`/`restore` is a full-state round-trip — never run while anything else commits to that repo.
- `verify-serverless.sh` uses a dev-only plaintext `ADMIN_PASSWORD` from `.env.local` — never present in production envs.

## Work Guidance
- New helpers must be dependency-light (node built-ins + octokit) and must only touch the repo/env pointed at by the current env vars — never hardcode repos.
- Keep `verify-serverless.sh` exit-code based (0 = all checks passed).

## Verification
- `bash scripts/verify-serverless.sh` (against a scratch content repo).

## Child DOX Index
- No child AGENTS.md files needed.
