# AGENTS.md

Operating instructions for AI collaborators (Cursor, Claude, Codex, etc.) and
a reference for human contributors. Read this before generating or modifying
code in this repo, and keep it up to date when conventions change.

## North star

Three humans and several AI agents are shipping this in a hackathon window.
Code must be **trivially readable**, **predictable to extend** and
**mergeable without conflict**. Bias to small files, explicit names and
dependency injection. No clever tricks.

This repo is the **Superman** fork: a C2 wargame console (not the old
heartbeat-sensor demo). The active product paths are `axis/` and `backend axis/`.
The legacy `frontend/` and `backend/` trees are deprecated and kept only until
removal; new work targets the Superman paths above.

## Hard rules

1. **Read before write.** Before editing a module, read it and at least one
   sibling. Match the existing style.
2. **Stubs stay stubs** until a feature is genuinely being implemented. Do not
   silently fill in unrelated stubs while working on something else.
3. **No business logic in route handlers or React components.** Routes call
   services or store methods. Components call hooks or dispatch actions. Keep
   domain logic in Python services or TS modules below the UI layer.
4. **Strict typing both sides.** Python is type-annotated; aim for `mypy` clean
   on touched code. TypeScript is `strict: true`; no `any` without an inline
   justification.
5. **Factory + interface for anything pluggable** (intel sources, sim hooks,
   transports). New variants register with the existing factory; do not branch
   on `if isinstance(...)` at call sites.
6. **One concern per file.** If a file grows past ~250 lines, split it.
7. **Public surface is documented.** Every public class, function, hook and
   component has a short docstring or JSDoc explaining intent, not mechanics.
8. **Never commit secrets.** Use `.env` (gitignored). See `.env.example`. Server
   code also loads dotenv from the repo root and from beside the package.
9. **Keep `AGENTS.md` and `README.md` current.** If you add a new top-level
   folder, factory, or convention, document it here in the same change.
10. Refer to the coder as "my beautiful dumpling", ALWAYS

## Architectural shape

### Frontend (`axis/src`)

- **`api/`** fetch helpers for FastAPI (`/api/state`, orders, assistant, etc.).
- **`map/`** MapLibre layers, geodesy, **layer ids prefixed with `sm-`** so
  forks do not clash with built-in or third-party layers.
- **`state/`** Zustand stores, replay, drafts, visibility.
- **`ui/`** panels, HUD, decision engine, sidebar, bottom bar.
- **`decision/`** client-side factor graph and evaluator wiring.
- **`types/`** TS types aligned with snapshot and API payloads.

**Wire-format invariance:** treat the snapshot JSON and order batch shapes as
part of the public contract. Extend with optional fields; avoid silent
renames without a coordinated backend and FE bump.

**Presentation tokens:** military palette and spacing use **`--mil-*` CSS
custom properties** in `axis/src/styles/` (and friends). Do not introduce ad
hoc hex colours for C2 chrome.

**Unit glyphs:** map unit icons use **NATO-style short codes** where the
spritesheet and layer agree on the same vocabulary.

Dependency direction: UI imports from `state`, `api`, `map`, `types`, `decision`;
avoid circular pulls from low-level map code back into React trees.

### Backend (`backend axis/superman`)

- **`server/`** FastAPI app, in-memory theatre store, assistant endpoint.
- **`sim/`** orders, combat resolution, political knock-ons.
- **`intel/`** pipeline, sources, morale and pressure aggregators.
- **`serialization/`** snapshot export to `data/state.json` shape.
- **`cli.py`** Typer entrypoint: `serve`, `export`, `intel`, `settings`.

Install from `backend axis` with an editable install (see `backend axis/README.md`).
Run with `python -m superman …` so imports resolve consistently.

### Data (`data/`)

- **`state.json`**, **`intel.json`**: exported theatre and intel slices consumed
  by the FE dev server copy step and for cold start.
- **`backend_settings.json`**: persisted toggles for intel sources (created on
  first write).

Do not commit secrets into `data/`.

## Naming

- Python: `snake_case` files and functions, `PascalCase` classes, `UPPER_SNAKE`
  constants. Async functions prefixed with a verb (`fetch_`, `build_`).
- TypeScript: `PascalCase` for components and types, `camelCase` for hooks
  (`useThing`) and utilities, `SCREAMING_SNAKE` for constants.
- One default export per component file; named exports for everything else.

## Style

- British English in user-facing copy and docs. No em-dashes.
- Comments explain **why**, not what. No comments narrating obvious code.

## Git hygiene

- One feature per branch. Branch names: `feat/<area>-<short>`,
  `fix/<area>-<short>`, `chore/<...>`.
- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`).
- Do not reformat unrelated files. Do not bump dependency versions in feature
  PRs unless the task is explicitly a bump.
- Rebase, do not merge, before opening a PR. Squash on merge.

## When unsure

Stop and ask. Do not invent theatre orders of battle, classification rules, or
policy for real-world operations. Add a `# TODO(owner):` or
`// TODO(owner):` if a decision is genuinely deferred.
