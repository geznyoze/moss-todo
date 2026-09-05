#!/bin/sh
# Drives the running stack in a real browser: Keycloak login, the whole task
# lifecycle, then a reload to prove everything came back from Postgres.
#
# Usage: ./run.sh [smoke.mjs|mobile.mjs]   (default: smoke.mjs)
#
# Talks to https://localhost with certificate checks off — the cert is the self-signed
# one from scripts/make-cert.sh, the same one a phone accepts once.
#
# WARNING: smoke.mjs deletes every task and list on the `demo` account before it
# starts. mobile.mjs is read-only — it renders the current account at phone size.
#
# Needs `docker compose up` first. Browsers come from the Playwright image, so
# nothing has to be installed on the host beyond the npm package. Screenshots
# land next to this script.
set -e
cd "$(dirname "$0")"
SCRIPT="${1:-smoke.mjs}"
[ "$SCRIPT" = "smoke.mjs" ] && echo "! clearing all tasks and lists on the demo account" >&2
[ -d node_modules ] || npm install --silent
exec docker run --rm --network host \
  -v "$PWD:/work" -w /work -u "$(id -u):$(id -g)" -e HOME=/tmp \
  -e NODE_TLS_REJECT_UNAUTHORIZED=0 \
  mcr.microsoft.com/playwright:v1.63.0-noble node "$SCRIPT"
