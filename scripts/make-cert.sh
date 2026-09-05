#!/bin/sh
# Self-signed certificate for the reverse proxy.
#
#   ./scripts/make-cert.sh            # localhost only
#   ./scripts/make-cert.sh 192.168.1.109
#
# HTTPS is not about secrecy here — browsers only expose crypto.subtle, which the
# PKCE login flow needs, on a secure context, and plain http:// on a LAN address is
# not one. A self-signed cert is enough to qualify once the device trusts it.
# Re-run it whenever your LAN IP changes; the certs directory is gitignored.
set -e
cd "$(dirname "$0")/.."
HOST="${1:-}"
mkdir -p certs

SAN="DNS:localhost,IP:127.0.0.1"
[ -n "$HOST" ] && SAN="$SAN,IP:$HOST"

openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
  -keyout certs/key.pem -out certs/cert.pem \
  -subj "/CN=Moss Todo" -addext "subjectAltName=$SAN" 2>/dev/null

chmod 644 certs/cert.pem certs/key.pem
echo "wrote certs/cert.pem and certs/key.pem for $SAN"
