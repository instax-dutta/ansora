#!/bin/bash
#
# verify-serverless.sh — end-to-end verification of Ansora's serverless mode
# against a REAL GitHub content repo.
#
# Requires GITHUB_REPO and GITHUB_TOKEN in .env.local (fine-grained PAT with
# "Contents: Read and write" on that repo, or a classic token with `repo`
# scope). Everything else is read from .env.local too.
#
# What it does (all against the real repo):
#   1. Snapshots the repo state (so cleanup is a true round-trip).
#   2. Builds the app in serverless mode (sitemap/robots read the live repo).
#   3. Starts the standalone server and drives the admin API:
#        login → create draft → draft is 404 publicly → identical re-save is a
#        no-op commit-wise → publish → public 200 + RSS/llms.txt/home list it →
#        rename slug → old file gone from repo, old slug 404s → save site
#        settings (persisted to the repo) → delete post → commits verified.
#   4. Restores the repo to its snapshot state and stops the server.
#
# Exit code is 0 only if every check passed.
set -u

cd "$(dirname "$0")/.."
ROOT="$PWD"
ENV_FILE=".env.local"
PORT="${PORT:-3120}"

SLUG="scratch-post"
SLUG2="scratch-post-renamed"
TITLE="Scratch Post E2E"
TITLE2="Scratch Post E2E (renamed)"
POSTS_PATH="content/posts"
CONFIG_PATH="content/site.config.json"

PASS=0
FAIL=0
SERVER_PID=""
SERVER_LOG="/tmp/ansora-serverless-server.log"
RESP="/tmp/ansora-serverless-resp.json"
JAR="/tmp/ansora-serverless-cookies.txt"

log()  { printf '%s\n' "$*"; }
ok()   { PASS=$((PASS + 1)); log "  ✓ $*"; }
bad()  { FAIL=$((FAIL + 1)); log "  ✗ $*"; }
check_eq() { if [ "$1" = "$2" ]; then ok "$3"; else bad "$3 (expected '$2', got '$1')"; fi; }
contains_title() { case "$1" in *"$2"*) return 0 ;; *) return 1 ;; esac; }

get_env() {
  local line
  line="$(grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -1)"
  [ -n "$line" ] || { echo ""; return; }
  echo "${line#*=}" | sed -e 's/^"//' -e 's/"$//'
}

GH() { node --env-file="$ENV_FILE" scripts/github-repo.mjs "$@"; }

# ----------------------------- Environment --------------------------------

if [ ! -f "$ENV_FILE" ]; then
  log "ERROR: $ENV_FILE not found. Copy .env.example to .env.local and set"
  log "  DEPLOYMENT_MODE=serverless, GITHUB_REPO, GITHUB_TOKEN, ADMIN_PASSWORD_HASH, JWT_SECRET."
  exit 1
fi

export DEPLOYMENT_MODE=serverless
export ADMIN_USERNAME="$(get_env ADMIN_USERNAME)"
export ADMIN_PASSWORD="$(get_env ADMIN_PASSWORD)"
export ADMIN_PASSWORD_HASH="$(get_env ADMIN_PASSWORD_HASH)"
export JWT_SECRET="$(get_env JWT_SECRET)"
export SITE_URL="$(get_env SITE_URL)"
export GITHUB_REPO="$(get_env GITHUB_REPO)"
export GITHUB_TOKEN="$(get_env GITHUB_TOKEN)"
export GITHUB_BRANCH="$(get_env GITHUB_BRANCH)"
export GITHUB_CONTENT_PATH="$(get_env GITHUB_CONTENT_PATH)"
export GITHUB_SITE_CONFIG_PATH="$(get_env GITHUB_SITE_CONFIG_PATH)"
export NEXT_TELEMETRY_DISABLED=1

if [ -z "$GITHUB_REPO" ] || [ -z "$GITHUB_TOKEN" ]; then
  log "ERROR: GITHUB_REPO and GITHUB_TOKEN must be set in $ENV_FILE."
  log "  GITHUB_REPO=owner/name   (the fresh content repo you created)"
  log "  GITHUB_TOKEN=<fine-grained PAT with Contents: Read and write>"
  exit 1
fi
if [ -z "$ADMIN_PASSWORD_HASH" ] || [ -z "$JWT_SECRET" ] || [ -z "$ADMIN_PASSWORD" ]; then
  log "ERROR: ADMIN_PASSWORD_HASH, ADMIN_PASSWORD and JWT_SECRET must be set in $ENV_FILE."
  exit 1
fi

log "==> Verifying serverless mode against ${GITHUB_REPO}#${GITHUB_BRANCH}"

# ---------------------------- Repo snapshot -------------------------------

SNAPSHOT="/tmp/ansora-gh-snapshot-$$.json"
log "==> Snapshotting repo state (for guaranteed cleanup)"
if ! GH snapshot "$SNAPSHOT" >/tmp/ansora-snapshot.log 2>&1; then
  log "ERROR: could not snapshot the repo:"
  cat /tmp/ansora-snapshot.log
  exit 1
fi
cat /tmp/ansora-snapshot.log

cleanup() {
  log ""
  log "==> Cleanup: restoring repo + stopping server"
  stop_server
  if GH restore "$SNAPSHOT" >/tmp/ansora-restore.log 2>&1; then
    log "  ✓ repo restored to its pre-test state"
  else
    log "  ✗ repo restore failed:"
    cat /tmp/ansora-restore.log
  fi
  rm -f "$SNAPSHOT"
  rm -rf .next/cache
}
trap cleanup EXIT

# -------------------------------- Build -----------------------------------

log ""
log "==> Build (serverless mode — sitemap/robots read the live repo)"
if ! npm run build >/tmp/ansora-build.log 2>&1; then
  log "  ✗ serverless build failed — see /tmp/ansora-build.log (tail below):"
  tail -30 /tmp/ansora-build.log
  exit 1
fi
ok "serverless build"

mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

# ---------------------------- Server helpers -------------------------------

start_server() {
  PORT="$PORT" node .next/standalone/server.js >"$SERVER_LOG" 2>&1 &
  SERVER_PID=$!
  for _ in $(seq 1 30); do
    curl -sf "http://localhost:$PORT/" >/dev/null 2>&1 && return 0
    sleep 2
  done
  return 1
}

stop_server() {
  [ -n "$SERVER_PID" ] || return 0
  kill "$SERVER_PID" 2>/dev/null
  for _ in $(seq 1 15); do
    kill -0 "$SERVER_PID" 2>/dev/null || break
    sleep 1
  done
  SERVER_PID=""
}

# Restart with a cold ISR cache so public-page checks are deterministic
# (ISR caches a published page for up to 300s otherwise).
reset_public_cache() {
  stop_server
  rm -rf .next/cache
  if ! start_server; then
    log "  ✗ server failed to start — see $SERVER_LOG (tail below):"
    tail -20 "$SERVER_LOG"
    exit 1
  fi
  log "  (server restarted with a cold cache)"
}

api() { # method path [json-body]
  local m="$1" p="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -s -b "$JAR" -c "$JAR" -o "$RESP" -w "%{http_code}" -X "$m" \
      "http://localhost:$PORT$p" -H "Content-Type: application/json" -d "$body"
  else
    curl -s -b "$JAR" -c "$JAR" -o "$RESP" -w "%{http_code}" -X "$m" \
      "http://localhost:$PORT$p"
  fi
}

pub() { # path -> status code only
  curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT$1"
}

# Make sure no orphaned server from a previous (killed) run is holding the
# port — otherwise the readiness probe would silently test stale code.
kill_port() {
  local pids
  pids="$(lsof -ti "tcp:$PORT" 2>/dev/null || true)"
  [ -n "$pids" ] && for pid in $pids; do kill "$pid" 2>/dev/null || true; done
  sleep 1
}
kill_port

if ! start_server; then
  log "ERROR: server failed to start — see $SERVER_LOG (tail below):"
  tail -20 "$SERVER_LOG"
  exit 1
fi

# ---------------------- Phase A: draft + no-op + publish -------------------

log ""
log "==> Phase A: create draft, draft-404, no-op re-save, publish"

CODE="$(curl -s -c "$JAR" -o "$RESP" -w "%{http_code}" -X POST \
  "http://localhost:$PORT/api/admin/login" -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"$ADMIN_PASSWORD\"}")"
check_eq "$CODE" "200" "login as admin"

DRAFT="{\"meta\":{\"title\":\"$TITLE\",\"slug\":\"$SLUG\",\"excerpt\":\"A scratch post to verify serverless mode.\",\"date\":\"2026-08-06\",\"published\":false,\"tags\":[\"e2e\"]},\"body\":\"# $TITLE\n\nSome **markdown** with a [link](https://example.com).\"}"

CODE="$(api POST /api/admin/posts "$DRAFT")"
check_eq "$CODE" "200" "create scratch post (draft)"
grep -q "\"slug\":\"$SLUG\"" "$RESP" 2>/dev/null \
  && ok "create returned the expected slug" \
  || bad "unexpected create response: $(cat "$RESP" 2>/dev/null)"

GH ls "$POSTS_PATH" | grep -qx "$POSTS_PATH/$SLUG.md" \
  && ok "draft file landed in the GitHub repo" \
  || bad "draft file missing from the repo (GH ls)"

check_eq "$(pub /blog/$SLUG)" "404" "draft is 404 on the public site"

C1="$(GH commits "$POSTS_PATH/$SLUG.md" 20 | wc -l | tr -d ' ')"
CODE="$(api PUT /api/admin/posts/$SLUG "$DRAFT")"
check_eq "$CODE" "200" "identical draft re-save succeeds"
C2="$(GH commits "$POSTS_PATH/$SLUG.md" 20 | wc -l | tr -d ' ')"
if [ "$C1" = "$C2" ]; then
  ok "no-op re-save created no new commit ($C1 -> $C2)"
else
  bad "no-op re-save created a commit ($C1 -> $C2)"
fi

PUBLISHED="{\"meta\":{\"title\":\"$TITLE\",\"slug\":\"$SLUG\",\"excerpt\":\"A scratch post to verify serverless mode.\",\"date\":\"2026-08-06\",\"published\":true,\"tags\":[\"e2e\"]},\"body\":\"# $TITLE\n\nSome **markdown** with a [link](https://example.com).\"}"
CODE="$(api PUT /api/admin/posts/$SLUG "$PUBLISHED")"
check_eq "$CODE" "200" "publish the draft"

C3="$(GH commits "$POSTS_PATH/$SLUG.md" 20 | wc -l | tr -d ' ')"
CODE="$(api PUT /api/admin/posts/$SLUG "$PUBLISHED")"
check_eq "$CODE" "200" "identical re-save of a published post succeeds"
C4="$(GH commits "$POSTS_PATH/$SLUG.md" 20 | wc -l | tr -d ' ')"
if [ "$C3" = "$C4" ]; then
  ok "published no-op re-save created no new commit ($C3 -> $C4)"
else
  bad "published no-op re-save created a commit ($C3 -> $C4)"
fi

# ------------------ Phase B: public site reflects the post -----------------

log ""
log "==> Phase B: public site serves the published post"
reset_public_cache

CODE="$(pub /blog/$SLUG)"
check_eq "$CODE" "200" "published post is 200 on the public site"
if contains_title "$(curl -s "http://localhost:$PORT/blog/$SLUG")" "$TITLE"; then
  ok "post page renders the title"
else
  bad "post page is missing the title"
fi

if contains_title "$(curl -s "http://localhost:$PORT/rss.xml")" "$TITLE"; then
  ok "rss.xml lists the post"
else
  bad "rss.xml is missing the post"
fi

if contains_title "$(curl -s "http://localhost:$PORT/llms.txt")" "$TITLE"; then
  ok "llms.txt lists the post"
else
  bad "llms.txt is missing the post"
fi

if contains_title "$(curl -s "http://localhost:$PORT/")" "$TITLE"; then
  ok "home page shows the post"
else
  bad "home page is missing the post"
fi

check_eq "$(curl -s -b "$JAR" -o /dev/null -w "%{http_code}" "http://localhost:$PORT/admin")" \
  "200" "admin dashboard renders (reads the repo)"

# --------------------------- Phase C: rename -------------------------------

log ""
log "==> Phase C: rename the slug"

RENAMED="{\"meta\":{\"title\":\"$TITLE2\",\"slug\":\"$SLUG2\",\"excerpt\":\"A scratch post to verify serverless mode (renamed).\",\"date\":\"2026-08-06\",\"published\":true,\"tags\":[\"e2e\"]},\"body\":\"# $TITLE2\n\nRenamed content.\"}"
CODE="$(api PUT /api/admin/posts/$SLUG "$RENAMED")"
check_eq "$CODE" "200" "rename the post's slug"

GH ls "$POSTS_PATH" >/tmp/ansora-ls.txt
grep -qx "$POSTS_PATH/$SLUG2.md" /tmp/ansora-ls.txt \
  && ok "renamed file is in the repo" \
  || bad "renamed file missing from the repo"
grep -qx "$POSTS_PATH/$SLUG.md" /tmp/ansora-ls.txt \
  && bad "old file still in the repo" \
  || ok "old file removed from the repo"

reset_public_cache
check_eq "$(pub /blog/$SLUG2)" "200" "renamed slug is 200 on the public site"
check_eq "$(pub /blog/$SLUG)" "404" "old slug 404s after the rename"

# ------------------- Phase D: settings + delete + commits ------------------

log ""
log "==> Phase D: site settings, delete, commit verification"

SCONF="{\"title\":\"Ansora E2E\",\"description\":\"Serverless verification.\",\"baseUrl\":\"http://localhost:3000\",\"author\":\"E2E Runner\",\"defaultOgImage\":\"\",\"social\":{\"twitter\":\"\",\"github\":\"\",\"linkedin\":\"\"}}"
CODE="$(api PUT /api/admin/settings "$SCONF")"
check_eq "$CODE" "200" "save site settings"
if GH get "$CONFIG_PATH" | grep -q "Ansora E2E"; then
  ok "settings persisted to the GitHub repo"
else
  bad "settings not found in the repo"
fi

CODE="$(api DELETE /api/admin/posts/$SLUG2)"
check_eq "$CODE" "200" "delete the scratch post"
if GH ls "$POSTS_PATH" | grep -q "$SLUG2.md"; then
  bad "deleted post is still in the repo"
else
  ok "post file removed from the repo"
fi

C="$(GH commits "$POSTS_PATH/$SLUG.md" 20 | wc -l | tr -d ' ')"
if [ "$C" -ge 3 ]; then
  ok "old path has >= 3 commits (create + publish + delete): $C"
else
  bad "old path has only $C commit(s)"
fi

C="$(GH commits "$POSTS_PATH/$SLUG2.md" 20 | wc -l | tr -d ' ')"
if [ "$C" -ge 2 ]; then
  ok "renamed path has >= 2 commits (create + delete): $C"
else
  bad "renamed path has only $C commit(s)"
fi

log ""
log "==> Commit history on the scratch post (evidence):"
GH commits "$POSTS_PATH/$SLUG.md" 10 | sed 's/^/    /'

# ------------------------------- Summary ----------------------------------

log ""
log "================================================================"
log "  RESULT: $PASS passed, $FAIL failed"
log "================================================================"
log "  The repo has been restored to its pre-test state (the commit"
log "  history remains — that's the point of the exercise)."
[ "$FAIL" -eq 0 ]
