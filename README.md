# Superman

Superman is a Mission Command and Control console. It pulls unit positions,
sensor coverage, intel events, and leader signals into one operational
picture, then lets a watch officer drive the kill chain through an AI
assistant that can read the COP, draft orders, and forecast the political
or social knock-on of an action *before* it ships.

The headline capability is the **Implications Forecaster**: every candidate
order set is run through a non-mutating sandbox of the political engine to
project credibility shifts, faction pressure changes, and signal-versus-action
gaps. The watch officer sees the second-order effects on the same screen as
the order, then confirms or holds.

## Capabilities

- **Unified COP**: live theatre with units, assets, territory, intel events,
  and leader signals on a single MapLibre canvas.
- **Tool-calling assistant**: free-form intent in, structured action out. The
  assistant composes primitives (read COP, summarise intel, propose orders,
  forecast implications, drive the map, stage actions) under explicit
  human-in-the-loop oversight.
- **Implications forecast**: model the credibility / pressure / political
  consequences of an order on a sandbox theatre before staging it.
- **Decision engine**: explainable per-region rationale; every probability
  exposes drivers and provenance.
- **Real intel feed**: GDELT live and snapshot adapters land Goldstein-scaled
  events into the morale aggregator.

## Repo layout

| Path | Role |
|------|------|
| `frontend/` | Vite + React + TypeScript console (MapLibre map, HUD, AssistantBar, decision UI). |
| `backend/` | Python package `axis`: CLI, FastAPI server, intel pipeline, political sim, assistant tool registry. |
| `data/` | Generated `state.json` / `intel.json` and backend runtime settings JSON. |
| `axis-ref/` | Historical reference snapshot. Not part of the live build. |

## Quick start

From the repo root:

```bash
cd backend && python -m axis serve
```

In another shell:

```bash
cd frontend && npm install && npm run dev
```

`npm run dev` runs `predev`, which copies `data/state.json` (and optional
`data/intel.json`) into `frontend/public/` for static bootstrapping.
Regenerate snapshots with `python -m axis export` (see `data/README.md`).

The C2 assistant requires `OPENAI_API_KEY` in `.env` (repo root or
`backend/.env`). See `.env.example`.

## API surface (selected)

| Method | Path | Purpose |
|--------|------|---------|
| `GET`  | `/api/state` | Full theatre snapshot. |
| `GET`  | `/api/signals` | Political slice: pressure, credibility, leader signals. |
| `POST` | `/api/orders/execute` | Apply a validated `OrderBatch`. |
| `POST` | `/api/orders/suggest` | Single-shot LLM order draft (legacy). |
| `POST` | `/api/assistant/chat` | C2 tool-calling assistant: read, forecast, stage. |
| `POST` | `/api/decision/explain` | Per-action region rationale. |

## Conventions

- Demo posture: no real authentication; permissive CORS for local dev.
- Strict typing both sides: TypeScript `strict`, Python annotations throughout.
- Read `AGENTS.md` before you change code or docs.
