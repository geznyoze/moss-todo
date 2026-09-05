# Moss Todo

Monorepo for a todo app: Angular frontend, FastAPI backend, PostgreSQL, Keycloak auth,
all wired together with Docker Compose.

## Layout

```
backend/     FastAPI + SQLAlchemy 2.0 + Alembic
frontend/    Angular 22 (standalone, zoneless, signals) + keycloak-js
keycloak/    realm-moss.json — imported on first Keycloak boot
db/          Postgres init SQL (creates the separate `keycloak` database)
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
- **Schema changes go through Alembic.** Edit `backend/app/models.py`, then
  `alembic revision --autogenerate -m "..."`. Never edit an applied migration; add a new
  one. `entrypoint.sh` runs `alembic upgrade head` on every backend boot.
- **Two Keycloak URLs.** `KEYCLOAK_ISSUER` is the browser-facing realm URL and must equal
  the token's `iss` claim. `KEYCLOAK_INTERNAL_ISSUER` is only used to fetch the JWKS from
  inside the compose network, where `localhost` would point at the backend container.
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

`AUTH_ENABLED=false` bypasses token validation and pins every request to a
`dev-user` subject. Local debugging only — never set it in a deployed environment.

## Frontend

```
src/app/core/       auth.ts (keycloak-js), auth-interceptor.ts, api.ts, models.ts
src/app/features/   tasks/ — task-store.ts holds all screen state
src/environments/   apiUrl + keycloak config; production.ts swapped in at build time
```

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

## Environment notes

This machine currently cannot run the stack end to end: the user is not in the `docker`
group (`sudo usermod -aG docker $USER`, then re-login) and `python3-venv` / `pip` are not
installed (`sudo apt install python3-venv python3-pip`). The Angular build runs fine.
