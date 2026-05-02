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
# backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload

# frontend
cd frontend && npm install
npm run dev
```

## Conventions

- Demo mode: **no auth** (use the C2 / Field switcher in the top bar). Backend
  persists to **`backend/data/demo.json`** via `JsonDocumentStore`, not SQL.
- Strict typing both sides (`mypy --strict`, `tsc --strict`).
- Domain logic lives in `backend/app/domain` and `backend/app/services`.
  Routes are thin.
- Frontend views are composed from `components/ui` (primitives) and
  `components/domain` (cross-cutting domain widgets). View-specific pieces
  stay inside `views/<view>/components`.
- Read `AGENTS.md` before touching anything.
