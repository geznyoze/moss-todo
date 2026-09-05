# Moss Todo

Monorepo for a todo app: Angular frontend, FastAPI backend, PostgreSQL, Keycloak auth,
all wired together with Docker Compose.

## Layout

The UI is a port of the `Moss Todo` Claude Design project
(`claude.ai/design/p/44df71e3-6c30-4883-b29d-e9beda5783d6`) — a dark moss palette,
Newsreader headings over Instrument Sans body, three views and a task drawer.

```
backend/     FastAPI + SQLAlchemy 2.0 + Alembic
frontend/    Angular 22 (standalone, zoneless, signals) + keycloak-js
keycloak/    realm-moss.json — imported on first Keycloak boot
db/          Postgres init SQL (creates the separate `keycloak` database)
e2e/         browser smoke test against the running stack
docker-compose.yml
```

## Run it

```bash
cp .env.example .env      # once
docker compose up --build
```

| Service            | URL                                             |
| ------------------ | ----------------------------------------------- |
| Frontend           | http://localhost:4200                           |
| API + Swagger docs | http://localhost:8000 · /docs                   |
| Keycloak admin     | http://localhost:8080 (admin / admin)           |
| Postgres           | localhost:5432 (moss / moss)                    |

Demo login: `demo` / `demo`. Self-registration is enabled on the realm.

## Conventions

- **Every task lives in Postgres.** The frontend never keeps authoritative state:
  mutations write through the API and the store replaces its local copy with the
  server's response. No localStorage persistence.
- **Ownership is by Keycloak subject.** Every row carries `user_id` = the token's `sub`,
  and every query filters on it. There is no cross-user read path.
- **The design is the spec.** Colours, spacing and type come from the design source;
  `src/styles.css` holds them as tokens. Change a token, not a hard-coded hex.
- **Schema changes go through Alembic.** Edit `backend/app/models.py`, then
  `alembic revision --autogenerate -m "..."`. Never edit an applied migration; add a new
  one. `entrypoint.sh` runs `alembic upgrade head` on every backend boot.
- **Two Keycloak URLs.** `KEYCLOAK_ISSUER` is the browser-facing realm URL and must equal
  the token's `iss` claim. `KEYCLOAK_INTERNAL_ISSUER` is only used to fetch the JWKS from
  inside the compose network, where `localhost` would point at the backend container.
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
app/models.py     TaskList, Task
app/schemas.py    request/response models
app/auth.py       RS256 bearer validation against the realm JWKS
app/routers/      tasks.py, lists.py
```

`GET /api/tasks` returns the user's whole set; scopes, views, grouping and search are
computed client-side, because all three views need the same rows anyway.

**Subtasks are a JSONB array** on `tasks`, not their own table, marked with a
`ponytail:` comment. They are only ever read and written with their parent; split them
out if they ever need to be queried.

`AUTH_ENABLED=false` bypasses token validation and pins every request to a
`dev-user` subject. Local debugging only — never set it in a deployed environment.

## Frontend

```
src/app/core/       auth.ts (keycloak-js), auth-interceptor.ts, api.ts, models.ts,
                    dates.ts, task-store.ts — every piece of screen state
src/app/features/   tasks/ — tasks-page (shell, sidebar, list/board/dates), task-drawer
src/environments/   apiUrl + keycloak config; production.ts swapped in at build time
```

Drag and drop is native HTML5 `draggable` — no CDK. The colour wheel is a
`conic-gradient` plus a little pointer maths; it previews locally while dragging and
writes once on pointer-up, so a drag is one request, not a hundred.

Drawer fields write on the native `change` event (fires on blur, or on release for the
lightness slider) rather than on every keystroke.

Bootstrap blocks on `provideAppInitializer(() => inject(Auth).init())` with
`onLoad: 'login-required'`, so no request can leave before there is a session.

## Local development without Docker

```bash
# backend
cd backend && pip install -e ".[dev]" && alembic upgrade head
uvicorn app.main:app --reload

# frontend
cd frontend && npm install && npm start
```

Both still need Postgres and Keycloak; `docker compose up db keycloak` is the easy way.

## Checks

```bash
cd frontend && npm test    # store logic: scoping, section building, due ordering
./e2e/run.sh               # real browser against a running stack — needs docker compose up
./e2e/run.sh mobile.mjs    # same stack at phone size; read-only, fails on any overflow
```

`e2e/smoke.mjs` logs in through Keycloak, builds a list, a group and three tasks,
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

There are no backend unit tests. The API is covered end to end by the smoke test; add
pytest if the routers ever grow logic worth isolating.

## Environment notes

Docker works on this machine and the whole stack has been verified running. Python
tooling has not been installed on the host (`sudo apt install python3-venv python3-pip`),
so the backend can only be run through Docker here — which is the normal path anyway.

Two Keycloak facts worth remembering, both hit during setup:

- Keycloak 26's declarative user profile makes email, first name and last name required.
  A user created through the admin API without them cannot get a token
  (`invalid_grant: Account is not fully set up`). The registration form collects them,
  so self-service signup is unaffected.
- `KC_HOSTNAME` fixes the issuer in tokens. It must stay `http://localhost:8080` so the
  browser's token matches `KEYCLOAK_ISSUER`; the backend reaches the JWKS separately
  through `KEYCLOAK_INTERNAL_ISSUER`.
