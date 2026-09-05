# Moss Todo

A todo app that takes its own persistence seriously: Angular front end, FastAPI
back end, PostgreSQL, and Keycloak for authentication, wired together with Docker
Compose and served through a single HTTPS origin.

Three views over one set of tasks — a list, a board, and a date view — with a
drawer for editing, native drag and drop between groups, and a colour wheel for
list colours. Nothing lives only in the browser: every mutation writes through the
API, and a reload is the test that proves it.

## Run it

```bash
cp .env.example .env          # once
./scripts/make-cert.sh        # once — self-signed cert for the proxy
docker compose up --build
```

Then open <https://localhost>. The certificate is self-signed, so the browser warns
once. Self-registration is on, so you can sign up; a demo account is seeded too.

## How it fits together

```
backend/     FastAPI + SQLAlchemy 2.0 + Alembic
frontend/    Angular 22 (standalone, zoneless, signals) + keycloak-js
keycloak/    realm-moss.json — imported on Keycloak's first boot
db/          Postgres init SQL (creates the separate `keycloak` database)
e2e/         browser smoke test against the running stack
```

Everything is served from **one origin**. The proxy holds the certificate and passes
`/api/*` to the back end and `/realms/*` to Keycloak, so there is no CORS, no mixed
content, one certificate to trust and one port to expose. That is also what lets the
same build work at `https://localhost` and at a public address with no rebuild — the
front end derives every URL from wherever the page was loaded.

Two decisions worth knowing about:

- **Ownership is by Keycloak subject.** Every row carries the token's `sub`, and every
  query filters on it. There is no cross-user read path.
- **A due date and a due time are separate columns.** A task can be due *on Thursday*
  without being due *at a time on Thursday*, which one timestamp column cannot say.

## Deploying it

Two supported paths, both free, sharing one `docker-compose.prod.yml`:

- **Tailscale Funnel** — publishes the stack from a machine you already own. No server,
  no port forwarding, no certificate to manage; Tailscale answers publicly with a real
  certificate and proxies inward. The app is up while that machine is.
- **A small VM** — any always-free tier works. Caddy obtains and renews a Let's Encrypt
  certificate, and a free subdomain points at the box.

Either way the deployment closes what local development leaves open: Keycloak moves out
of dev mode, only the proxy is published, and `scripts/prep-realm.sh` regenerates the
realm with the real origin, TLS required, and the seeded demo account removed.

Full instructions, including the failure modes that look like something else, are in
[CLAUDE.md](CLAUDE.md).

## Checks

```bash
cd frontend && npm test    # store logic: scoping, section building, due ordering
./e2e/run.sh               # real browser against a running stack
./e2e/run.sh mobile.mjs    # same stack at phone size; fails on any horizontal overflow
```

The smoke test logs in through Keycloak, builds a list and tasks, edits one, then
**reloads** and asserts the state came back. It wipes the account it uses first, so
don't point it at a stack holding anything you care about.
