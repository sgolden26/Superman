# Superman

Heartbeat-fused situational awareness platform.

Combines long-range cardiac detection ("ghost murmur") with satellite imagery,
drone footage and historical activity to classify human signatures as civilian
or combatant in near real-time. Two consumer surfaces:

- **Command and Control (C2)**: map-first multi-operator console.
- **Field**: lean, glance-able view for frontline personnel.

## Layout

```
.
├── AGENTS.md          # Instructions for AI collaborators (read first)
├── backend/           # Python / FastAPI
└── frontend/          # React + TypeScript + Tailwind (Vite)
```

See `backend/README.md` and `frontend/README.md` for stack-specific notes.

## Status

Hackathon scaffold. Stubs only. No business logic implemented yet.

## Getting started

```bash
# backend (managed with uv: https://docs.astral.sh/uv/)
cd backend && uv sync
uv run uvicorn app.main:app --reload

# frontend
cd frontend && npm install
npm run dev
```

## Conventions

- Demo mode: **no auth** (use the C2 / Field switcher in the top bar). Backend
  persists to a local **SQLite** file at `backend/data/superman.db` via SQLModel.
- Strict typing both sides (`mypy --strict`, `tsc --strict`).
- Backend layout is intentionally minimal: `app/models/` (one SQLModel table
  per file), `app/db.py`, `app/main.py`. Routes and services are added per
  feature.
- Frontend views are composed from `components/ui` (primitives) and
  `components/domain` (cross-cutting domain widgets). View-specific pieces
  stay inside `views/<view>/components`.
- Read `AGENTS.md` before touching anything.
