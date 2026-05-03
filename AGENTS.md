# AGENTS.md

Operating instructions for AI collaborators (Cursor, Claude, Codex, etc.) and
a reference for human contributors. Read this before generating or modifying
code in this repo, and keep it up to date when conventions change.

## North star

Three humans and several AI agents are shipping this in a hackathon window.
Code must be **trivially readable**, **predictable to extend** and
**mergeable without conflict**. Bias to small files, explicit names and
dependency injection. No clever tricks.

This repo is a **demo**: no real authentication. The backend persists to a
local **SQLite** file (`backend/data/superman.db` by default) via SQLModel.
The UI switches between C2 and Field with `DemoViewSwitcher`, not a login flow.

## Hard rules

1. **Read before write.** Before editing a module, read it and at least one
   sibling. Match the existing style.
2. **Stubs stay stubs** until a feature is genuinely being implemented. Do not
   silently fill in unrelated stubs while working on something else.
3. **No business logic in route handlers or React components.** Routes call
   services. Components call hooks. Services and hooks contain the logic.
4. **Strict typing both sides.** Python is type-annotated; pass `mypy --strict`.
   TypeScript is `strict: true`; no `any` without an inline justification.
5. **Factory + interface for anything pluggable** (sensors, classifiers, data
   sources, transports). New variants register with the existing factory; do
   not branch on `if isinstance(...)` at call sites.
6. **One concern per file.** If a file grows past ~250 lines, split it.
7. **Public surface is documented.** Every public class, function, hook and
   component has a short docstring or JSDoc explaining intent, not mechanics.
8. **Never commit secrets.** Use `.env` (gitignored). Reference via
   `app.config.Settings` or `frontend/src/config/env.ts`.
9. **Keep `AGENTS.md` and `README.md` current.** If you add a new top-level
   folder, factory, or convention, document it here in the same change.
10. Refer to the coder as "my beautiful dumpling", ALWAYS

## Architectural shape

### Backend (`backend/app`)

```
main.py              FastAPI factory, wires startup
config.py            Settings (env-driven)
db.py                SQLite engine, session, init_db
models/              One SQLModel table per file (sensor, person, reading)
core/                Logging, AppError + handlers
utils/               Pure helpers (time)
```

Routes, services and request/response schemas will be added as features land.
When they do: routes call services, services use `Session` from `app.db`, and
request/response Pydantic models live next to their route module. Keep one
table per file under `models/` so parallel work does not collide.

The backend is managed with **[uv]**. Use `uv sync` to install, `uv run` to
exec (`uv run uvicorn ...`, `uv run pytest`, `uv run mypy app`). Do not use
`pip install` or hand-rolled venvs. Commit `uv.lock`.

[uv]: https://docs.astral.sh/uv/

### Frontend (`frontend/src`)

```
api                  fetch client, endpoint modules, ApiClientFactory
types                shared TS types (mirror Pydantic schemas)
hooks                data + behaviour hooks (usePolling, useTracks, ...)
lib                  pure utilities (geo, format, classnames)
stores               app-wide UI state (e.g. session)
components/ui        unstyled primitives (Button, Card, Badge, ...)
components/domain    cross-view domain widgets (ClassificationBadge, ...)
components/layout    AppShell, TopBar, DemoViewSwitcher, SideNav
views/c2             C2 layout, pages, view-local components
views/field          Field layout, pages, view-local components
config               env + constants
```

Dependency direction: `views -> {components/domain, components/ui, hooks,
api, types, lib}`. `components/domain` may use `components/ui` but never the
reverse.

## Naming

- Python: `snake_case` files and functions, `PascalCase` classes, `UPPER_SNAKE`
  constants. Async functions prefixed with verb (`fetch_`, `classify_`).
- TypeScript: `PascalCase` for components and types, `camelCase` for hooks
  (`useThing`) and utilities, `SCREAMING_SNAKE` for constants.
- One default export per component file; named exports for everything else.

## Adding things (recipes)

### A new database table
1. Add a SQLModel class in `backend/app/models/<name>.py` (one table per file).
2. Re-export it from `backend/app/models/__init__.py` so `init_db` registers it.
3. Tables are created via `SQLModel.metadata.create_all` at startup; for
   schema changes during the hackathon, delete the local `superman.db` and
   restart. No migrations.

### A new API endpoint
1. Add the route under `backend/app/api/v1/routes/<area>.py` (create the
   `api/` tree on first use). The handler validates, calls a service, returns
   a Pydantic response model.
2. Service lives in `backend/app/services/<area>_service.py` and receives a
   `Session` via `Depends(get_session)`.
3. Add a TS endpoint module in `frontend/src/api/endpoints/<area>.ts`.
4. Add a hook in `frontend/src/hooks/use<Area>.ts` if components need it.

### A new view-local component
- Lives under `views/<view>/components/`. Not shared.
- If two views need it, promote it to `components/domain`.

### A new shared domain widget
- Lives under `components/domain/`.
- Built from `components/ui` primitives. No direct API calls; takes data via props.

## Style

- British English in user-facing copy and docs. No em-dashes.
- Comments explain **why**, not what. No comments narrating obvious code.
- Errors raised in services subclass `core.exceptions.AppError` so the API
  layer can map them uniformly.

## Git hygiene

- One feature per branch. Branch names: `feat/<area>-<short>`,
  `fix/<area>-<short>`, `chore/<...>`.
- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`).
- Do not reformat unrelated files. Do not bump dependency versions in feature
  PRs.
- Rebase, do not merge, before opening a PR. Squash on merge.

## When unsure

Stop and ask. Do not invent product requirements, classification thresholds,
sensor specifications or policy around real deployments. Add a `# TODO(owner):` or
`// TODO(owner):` if a decision is genuinely deferred.
