#!/bin/sh
# Migrations run on every boot; Alembic is a no-op when the DB is already current.
set -e
alembic upgrade head
exec "$@"
