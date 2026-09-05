#!/bin/sh
# Generate the production realm from the development one.
#
#   PUBLIC_HOST=moss-todo.duckdns.org ./scripts/prep-realm.sh
#
# Keycloak imports a realm only on its very first boot, so these have to be right
# before the stack ever starts: the public origin instead of https://localhost, TLS
# required, and no demo/demo account sitting on an address the whole internet can
# reach. Generated rather than hand-edited, so keycloak/realm-moss.json stays the one
# source of truth and dev and prod cannot drift apart.
#
# Set ALLOW_REGISTRATION=false to close self-service signup.
set -e
cd "$(dirname "$0")/.."
: "${PUBLIC_HOST:?usage: PUBLIC_HOST=example.org ./scripts/prep-realm.sh}"

PUBLIC_HOST="$PUBLIC_HOST" ALLOW_REGISTRATION="${ALLOW_REGISTRATION:-true}" python3 - <<'PY'
import json, os

origin = "https://" + os.environ["PUBLIC_HOST"]
realm = json.load(open("keycloak/realm-moss.json"))

realm["sslRequired"] = "external"
realm["registrationAllowed"] = os.environ["ALLOW_REGISTRATION"] == "true"
# demo/demo is fine on localhost and indefensible on a public origin.
realm.pop("users", None)

for client in realm.get("clients", []):
    client["rootUrl"] = origin
    client["redirectUris"] = [origin + "/*"]
    client["webOrigins"] = [origin]
    if "post.logout.redirect.uris" in client.get("attributes", {}):
        client["attributes"]["post.logout.redirect.uris"] = origin + "/*"

with open("keycloak/realm-moss.prod.json", "w") as f:
    json.dump(realm, f, indent=2)
    f.write("\n")
print("wrote keycloak/realm-moss.prod.json for " + origin)
PY
