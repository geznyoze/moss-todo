#!/bin/sh
# Drives the running stack in a real browser: Keycloak login, the whole task
# lifecycle, then a reload to prove everything came back from Postgres.
#
# WARNING: deletes every task and list on the `demo` account before it starts.
#
# Needs `docker compose up` first. Browsers come from the Playwright image, so
# nothing has to be installed on the host beyond the npm package. Screenshots
# land next to this script.
set -e
cd "$(dirname "$0")"
echo "! clearing all tasks and lists on the demo account" >&2
[ -d node_modules ] || npm install --silent
exec docker run --rm --network host \
  -v "$PWD:/work" -w /work -u "$(id -u):$(id -g)" -e HOME=/tmp \
  mcr.microsoft.com/playwright:v1.63.0-noble node smoke.mjs
