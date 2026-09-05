# Moss Todo

Monorepo for a todo app: Angular frontend, FastAPI backend, PostgreSQL, and its own
username/password auth, all wired together with Docker Compose.

## Layout

The UI is a port of a Claude Design project — a dark moss palette, Newsreader
headings over Instrument Sans body, three views and a task drawer.

```
backend/     FastAPI + SQLAlchemy 2.0 + Alembic
frontend/    Angular 22 (standalone, zoneless, signals)
e2e/         browser smoke test against the running stack
docker-compose.yml
```

## Run it

```bash
cp .env.example .env          # once
./scripts/make-cert.sh        # once — self-signed cert for the proxy
docker compose up --build
```

Everything is served through **one HTTPS origin**. nginx holds the certificate and
proxies `/api/*` to the backend, so there is no CORS, no mixed content, one certificate
to trust and one port to expose.

| Service            | URL                                        |
| ------------------ | ------------------------------------------ |
| App                | https://localhost                          |
| API + Swagger docs | https://localhost/api · http://localhost:8000/docs |
| Postgres           | localhost:5432                             |

The certificate is self-signed, so every browser warns once. No account is seeded —
the first visit lands on `/login`, where "Create one" registers you. Local credentials
come from `.env`; see `.env.example` for the development defaults.

### Opening it from a phone

```bash
./scripts/make-cert.sh 192.168.1.109     # your LAN IP, into the cert's SAN list
docker compose up -d --force-recreate frontend
```

Then, in Windows PowerShell, `scripts/wsl-port-forward.ps1` (it elevates itself) to
forward ports 80 and 443 into the WSL VM, which NAT mode otherwise hides from the LAN.
Re-run it after `wsl --shutdown`, since WSL's address can change.

**HTTPS is no longer strictly required.** It was, while keycloak-js needed
`crypto.subtle` for its PKCE challenge — a plain-http LAN address is not a secure
context, so the login failed before it started. Our own login form only posts a
password, so it works over http. It should still not: that password would cross the
LAN in the clear, and the single TLS origin costs one `make-cert.sh` run.

### Opening it from another device

The browser derives the API URL from the address it was opened at (`environment.ts`
reads `location.origin`), so one build serves both `localhost` and a LAN address with no
rebuild. What has to know about the extra host:

1. `PUBLIC_HOST` in `.env` — feeds `CORS_ORIGINS`. Then `docker compose up -d backend`.
   Same-origin requests go through the proxy and never consult it, so this only matters
   for calling the API directly.
2. On WSL2 in NAT mode, Windows must forward the ports into the VM:
   `scripts/wsl-port-forward.ps1`, from an elevated PowerShell. WSL's IP changes on most
   restarts, so re-run it after `wsl --shutdown` or a reboot.

Re-do step 1 whenever the LAN IP changes.

## Deploying it

Free, reachable from anywhere, one command to update. The target is an **Oracle Cloud
Always Free** ARM VM (2 OCPU / 12 GB as of mid-2026 — the whole stack fits several
times over) with a free **DuckDNS** subdomain and **Caddy** for a real Let's Encrypt
certificate. The PaaS free tiers still do not fit: Render's free Postgres is deleted 30
days after it is created, and its web services sleep after 15 idle minutes.

`docker-compose.prod.yml` layers over the base file and changes two things: the frontend
is served by the Caddy stage of `frontend/Dockerfile` instead of the nginx one, and
`JWT_SECRET` becomes required.

```bash
# on the server, once
cp .env.example .env            # then set PUBLIC_HOST, JWT_SECRET and real passwords

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Updating later is `git pull` and that same `up -d --build`.

- **Open 80 and 443 twice.** The OCI security list *and* the VM's own iptables, whose
  default chain drops everything. Forgetting the second is the usual "it is running
  but nothing connects".
- **`JWT_SECRET` must be a real one.** The prod overlay has no default and will not
  start without it, because the development value is public in `.env.example` and
  anyone holding it can mint a token for any account. `openssl rand -hex 32`. Changing
  it later signs everyone out, which is the only revocation this app has.
- **Registration is open.** Anyone who finds the address can create an account; their
  tasks are invisible to you and yours to them, but they are in your database. Close it
  by deleting the `/register` route from `app/routers/auth.py` once your account exists.
- **Only the proxy is published.** Postgres and the API bind to `127.0.0.1` in the base
  compose file, so a public IP exposes 80 and 443 and nothing else.
- **Certificates live in the `caddy_data` volume.** Deleting it makes Caddy re-request
  every certificate on the next boot, which Let's Encrypt rate-limits.
- **Nothing backs this up but you.** `scripts/backup-db.sh` from cron. Accounts and
  tasks are one database now, so one dump holds both. Copy them off the box now and
  then — Oracle reclaims idle Always Free instances.

Local development is untouched: `docker compose up` still builds the nginx stage with
the self-signed cert, and the LAN/phone workflow above still works.

### Without a server: Tailscale Funnel

`docker-compose.funnel.yml` layers on top of the prod overlay and publishes the stack
straight from this machine — no VPS, no DNS record, no certificate, and no port
forwarding, since Funnel dials out rather than being connected to. Tailscale answers
on the public internet at `<TS_HOSTNAME>.<tailnet>.ts.net` with a real certificate and
proxies inward to Caddy, which serves plain http on the compose network. The trade is
uptime: the app is reachable only while this machine is running.

In the Tailscale admin console, once:

1. **DNS → HTTPS Certificates → Enable.** Funnel will not start without it.
2. **Access controls** must grant the node the funnel attribute:
   `"nodeAttrs": [{"target": ["autogroup:member"], "attr": ["funnel"]}]`
3. **Settings → Keys →** generate a *reusable* auth key.

Then here:

```bash
# .env: PUBLIC_HOST (the funnel address — hostname plus the tailnet name from the
# DNS page), TS_HOSTNAME, TS_AUTHKEY, JWT_SECRET, and real passwords

docker compose -f docker-compose.yml -f docker-compose.prod.yml \
               -f docker-compose.funnel.yml up -d --build
docker compose logs tailscale     # prints the public URL once it is serving
```

- **Turn off key expiry on the node** in the admin console. The auth key only matters
  for the first boot — the state lives in the `ts_state` volume — but the node key
  itself expires on the default schedule and takes the site down with it.
- **`TS_USERSPACE` is on**, so the container needs neither `/dev/net/tun` nor
  `NET_ADMIN`; it only proxies inward. That is also what makes it work under WSL.
- **This replaces the LAN workflow, it does not extend it.** `wsl-port-forward.ps1`,
  `make-cert.sh` and the self-signed certificate are all unnecessary while the funnel
  is up — the phone reaches the same public URL as everything else.

## Conventions

- **Every task lives in Postgres.** The frontend never keeps authoritative state:
  mutations write through the API and the store replaces its local copy with the
  server's response. The one thing localStorage holds is the session token, which is a
  cached credential rather than state — losing it signs you out, it loses no data.
- **Ownership is by user id.** Every row carries `user_id` = the token's `sub`, which is
  a `users.id`, and every query filters on it. There is no cross-user read path. No
  foreign key: rows predating local auth point at Keycloak subjects that no longer
  exist, and a constraint would fail on any database still holding them.
- **The design is the spec.** Colours, spacing and type come from the design source;
  `src/styles.css` holds them as tokens (the accent is purple; the surfaces stay moss). Change a token, not a hard-coded hex.
- **Schema changes go through Alembic.** Edit `backend/app/models.py`, then
  `alembic revision --autogenerate -m "..."`. Never edit an applied migration; add a new
  one. `entrypoint.sh` runs `alembic upgrade head` on every backend boot.
- **Tasks list by due date, then creation time.** Undated tasks sort last; a task due on
  a date with no time sorts ahead of one with a time that day. The API orders this way and
  the store sorts again in `scoped`, so a task added locally lands in the right place
  without waiting for a refetch. There is no manual ordering — dragging a row moves it
  between groups, lists, board columns and date buckets, but never reorders within one.
- **`due` is a date; `due_time` is a separate nullable time.** A NULL time means "sometime
  that day", which one timestamp column could not express. Scopes and date buckets compare
  whole days via `dueDayMs`; sorting and labels use the exact moment via `dueMs`.
- **Angular is zoneless and standalone.** State goes in signals; prefer `computed` over
  manual recalculation, and the new `@if` / `@for` control flow over `*ngIf` / `*ngFor`.
- Commit in small, working increments with a message that says what changed and why.

## Backend

```
app/config.py     pydantic-settings; every value overridable by env var
app/db.py         engine, SessionLocal, Base, get_db dependency
app/models.py     User, TaskList, Task
app/schemas.py    request/response models
app/auth.py       HS256 bearer validation against JWT_SECRET
app/routers/      auth.py, tasks.py, lists.py
```

`GET /api/tasks` returns the user's whole set; scopes, views, grouping and search are
computed client-side, because all three views need the same rows anyway.

**Subtasks are a JSONB array** on `tasks`, not their own table, marked with a
`ponytail:` comment. They are only ever read and written with their parent; split them
out if they ever need to be queried.

**Auth is ours and it is small.** `/api/auth/register` and `/api/auth/login` return an
HS256 token signed with `JWT_SECRET`; `app/auth.py` verifies it locally, with no network
call and nothing to cache. Passwords are argon2 through passlib — argon2 rather than
bcrypt because passlib misreads bcrypt 4.x's version and logs a spurious error on every
hash. Tokens live 30 days (`JWT_DAYS`) and there is no refresh and no revocation list:
signing out drops the token, and changing `JWT_SECRET` invalidates every token there is.

`AUTH_ENABLED=false` bypasses token validation and pins every request to a
`dev-user` subject. Local debugging only — never set it in a deployed environment.

## Frontend

```
src/app/core/       auth.ts, auth-interceptor.ts, api.ts, models.ts,
                    dates.ts, task-store.ts — every piece of screen state
src/app/features/   auth/ — login-page (sign in and register, one form)
                    tasks/ — tasks-page (shell, sidebar, list/board/dates), task-drawer
src/environments/   apiUrl, derived from location.origin
```

Drag and drop is native HTML5 `draggable` — no CDK. The colour wheel is a
`conic-gradient` plus a little pointer maths; it previews locally while dragging and
writes once on pointer-up, so a drag is one request, not a hundred.

Drawer fields write on the native `change` event (fires on blur, or on release for the
lightness slider) rather than on every keystroke.

Nothing blocks bootstrap. `app.routes.ts` guards `''` with a `CanActivateFn` that sends
signed-out visitors to `/login`; the interceptor signs you out on any 401, which is what
a 30-day token with no refresh eventually produces. `Auth.login()` and `Auth.register()`
use `fetch` rather than `HttpClient` on purpose — the interceptor injects `Auth`, so
injecting `HttpClient` there would close a cycle.

## Local development without Docker

```bash
# backend
cd backend && pip install -e ".[dev]" && alembic upgrade head
uvicorn app.main:app --reload

# frontend
cd frontend && npm install && npm start
```

Both still need Postgres; `docker compose up db` is the easy way.

## Checks

```bash
cd frontend && npm test    # store logic: scoping, section building, due ordering
./e2e/run.sh               # real browser against a running stack — needs docker compose up
./e2e/run.sh mobile.mjs    # same stack at phone size; read-only, fails on any overflow
```

`e2e/smoke.mjs` registers its `demo` account (a second run just gets a 409), checks that
a wrong password is a 401 and that a signed-out visit lands on `/login`, then logs in and
builds a list, a group and three tasks,
completes one, edits another in the drawer, then **reloads** and asserts the state came
back — that reload is the point, since it is what proves nothing lives only in memory.
**It deletes every task and list on the `demo` account before it starts**, so it is
repeatable — do not run it against a stack holding work you care about. Browsers come
from the Playwright image; the host only needs the npm package, which `run.sh` installs.
Screenshots are written next to the script and are gitignored.

`e2e/mobile.mjs` renders the app as an iPhone 13 and fails if the document scrolls
horizontally. That check earns its place: a top bar that could not wrap made the page
445px wide, and a mobile browser widens its layout viewport to fit overflow — which
pulled the `position: fixed` drawer out to 445px too. Anything `position: fixed` looks
correct right up until something else overflows.

There are no backend unit tests. The API is covered end to end by the smoke test, which
is also where the password path is checked — registration, a good login and a rejected
one. Add pytest if the routers ever grow logic worth isolating.

## Environment notes

Docker works on this machine and the whole stack has been verified running. Python
tooling has not been installed on the host (`sudo apt install python3-venv python3-pip`),
so the backend can only be run through Docker here — which is the normal path anyway.

This stack replaced Keycloak, which cost ~700MB of RAM, a second Postgres database, a
container, a realm JSON that only imported on a first boot, and two scripts that existed
only to work around that — in exchange for a password path we now own in about 70 lines.
What was given up with it: MFA, social login, and an account-recovery flow. Password
reset needs an SMTP server, which the realm never had either.
