#!/bin/sh
# Register a host with the Keycloak client, so the app can be opened at that address.
#
#   ./scripts/allow-host.sh 192.168.1.109
#
# The realm JSON is only imported on Keycloak's first boot, so any host added later
# (a LAN address for a phone, say) has to be registered through the admin API.
# Idempotent — safe to re-run, and re-run it whenever your LAN IP changes.
set -e
HOST="${1:?usage: allow-host.sh <host-or-ip>}"
: "${FRONTEND_PORT:=4200}"
: "${KEYCLOAK_PORT:=8080}"
: "${KEYCLOAK_ADMIN:=admin}"
: "${KEYCLOAK_ADMIN_PASSWORD:=admin}"
KC="http://localhost:${KEYCLOAK_PORT}"
ORIGIN="http://${HOST}:${FRONTEND_PORT}"

TOKEN=$(curl -sf -X POST "$KC/realms/master/protocol/openid-connect/token" \
  -d grant_type=password -d client_id=admin-cli \
  -d "username=$KEYCLOAK_ADMIN" -d "password=$KEYCLOAK_ADMIN_PASSWORD" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')

ID=$(curl -sf -H "Authorization: Bearer $TOKEN" \
  "$KC/admin/realms/moss/clients?clientId=moss-frontend" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)[0]["id"])')

curl -sf -H "Authorization: Bearer $TOKEN" "$KC/admin/realms/moss/clients/$ID" \
  | ORIGIN="$ORIGIN" python3 -c '
import json, os, sys

client = json.load(sys.stdin)
origin = os.environ["ORIGIN"]
redirect = origin + "/*"

client["redirectUris"] = sorted({*client.get("redirectUris", []), redirect})
client["webOrigins"] = sorted({*client.get("webOrigins", []), origin})
logout = client.setdefault("attributes", {}).get("post.logout.redirect.uris", "")
parts = {p for p in logout.split("##") if p}
client["attributes"]["post.logout.redirect.uris"] = "##".join(sorted({*parts, redirect}))
json.dump(client, sys.stdout)
' > /tmp/moss-client.json

curl -sf -X PUT "$KC/admin/realms/moss/clients/$ID" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data @/tmp/moss-client.json
rm -f /tmp/moss-client.json

echo "registered $ORIGIN with the moss-frontend client"
