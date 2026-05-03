# Superman

Superman is a battlespace command and control console for a theatre-scale
wargame demo. It brings together a live map, a structured decision engine,
and political layer signals so operators can reason about force posture,
intent, and second-order effects in one place.

The stack ingests a theatre snapshot (units, assets, territory, fronts),
curated or live-derived intel, leader statements, and morale factors. The
UI surfaces a unit and asset map, a decision flow with explicit political
effects, and natural-language order suggestions validated against the same
simulator the backend runs.

## Repo layout

| Path | Role |
|------|------|
| `axis/` | Vite + React + TypeScript frontend (MapLibre map, HUD, decision UI). |
| `backend axis/` | Python package `superman`: CLI, FastAPI server, intel pipeline, sim. |
| `data/` | Generated `state.json` / `intel.json` and backend runtime settings JSON. |

The legacy trees `frontend/` and `backend/` belong to an older heartbeat-sensor
demo scaffold. They are deprecated here and scheduled for removal; do not use
them for the C2 console.

## Quick start

From the repo root (quotes matter because `backend axis` contains a space):

```bash
cd "backend axis" && python -m superman serve
```

In another shell:

```bash
cd axis && npm install && npm run dev
```

`npm run dev` runs `predev`, which copies `data/state.json` (and optional
`data/intel.json`) into `axis/public/` for static bootstrapping. Regenerate
snapshots with `python -m superman export` (see `data/README.md`).

## Conventions

- Demo posture: no real authentication; permissive CORS for local dev.
- Strict typing: TypeScript `strict`, Python type annotations throughout.
- Read `AGENTS.md` before you change code or docs.
