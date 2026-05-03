# AGENTS.md

Operating instructions for AI collaborators (Cursor, Claude, Codex, etc.) and
a reference for human contributors. Read this before generating or modifying
code in this repo, and keep it up to date when conventions change.

## North star

Three humans and several AI agents are shipping this in a hackathon window.
Code must be **trivially readable**, **predictable to extend** and
**mergeable without conflict**. Bias to small files, explicit names and
dependency injection. No clever tricks.

This repo is a **demo**: no real authentication and no SQL database. Data
lives in a JSON file under `backend/data/` (see `JsonDocumentStore`). The UI
switches between C2 and Field with `DemoViewSwitcher`, not a login flow.

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
api/v1/routes        thin HTTP handlers, validate + delegate
schemas              Pydantic I/O DTOs (request/response only)
domain/models        plain dataclasses, no I/O
services             orchestration, one class per use-case area
sensors              SensorBase + SensorFactory (ghost_murmur, satellite, drone)
classifiers          ClassifierBase + ClassifierFactory (rule_based, ml)
repositories         data access, one class per aggregate (backed by JSON for demo)
storage              JsonDocumentStore: single-file JSON persistence
core                 cross-cutting: logging, exceptions
utils                pure helpers (geo, time)
```

Dependency direction (no cycles): `api -> services -> {sensors, classifiers,
repositories} -> domain`. `schemas` are leaf types referenced by `api` and
`services`. `domain` depends on nothing.

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

### A new sensor type
1. Subclass `SensorBase` in `backend/app/sensors/<name>.py`.
2. Register it in `SensorFactory` (do not modify call sites).
3. Add Pydantic config schema in `backend/app/schemas/sensor.py`.
4. Add a row to the sensors table in `frontend/src/views/c2/components/SensorStatusPanel.tsx` if user-visible.

### A new API endpoint
1. Add Pydantic request/response schemas in `backend/app/schemas/<area>.py`.
2. Add a service method in `backend/app/services/<area>_service.py`.
3. Add a route in `backend/app/api/v1/routes/<area>.py` that just validates,
   calls the service and returns the response model.
4. Add a TS endpoint module in `frontend/src/api/endpoints/<area>.ts`.
5. Add a hook in `frontend/src/hooks/use<Area>.ts` if components need it.

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
