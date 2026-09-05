#!/bin/sh
# Nightly dump of both databases. Free hosting backs up nothing, and Oracle reclaims
# idle Always Free instances — a dump you can restore anywhere is what makes that
# survivable. pg_dumpall covers the keycloak database too: without its users, every
# task row is orphaned, since ownership is by Keycloak subject.
#
#   crontab -e:  0 3 * * * cd /srv/moss-todo && ./scripts/backup-db.sh
#
# Restore with:  gunzip -c backups/moss-<date>.sql.gz | docker compose exec -T db psql -U moss postgres
set -e
cd "$(dirname "$0")/.."
[ -f .env ] && . ./.env
mkdir -p backups

OUT="backups/moss-$(date +%F).sql.gz"
docker compose exec -T db pg_dumpall -U "${POSTGRES_USER:-moss}" | gzip > "$OUT"

# Keep a month. The VM's disk is a working copy, not an archive — copy these off-box.
find backups -name 'moss-*.sql.gz' -mtime +30 -delete
echo "wrote $OUT"
