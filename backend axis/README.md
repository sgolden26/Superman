# Superman backend

Python package **superman**: theatre snapshots, FastAPI live play, intel pipeline, and order execution.

## Install

```bash
cd "backend axis"
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
```

## Commands

- `python -m superman serve`: API on `127.0.0.1:8000` (use `--reload` in dev).
- `python -m superman export`: write `data/state.json` (and intel when configured).
- `python -m superman intel export`: refresh `intel.json` only.
- `python -m superman intel tick`: pipeline tick (see `typer --help` for options).
- `python -m superman settings`: persisted toggles in `data/backend_settings.json`.

## Wire format

Order batches and snapshot JSON match the Pydantic and TS types: the FE posts
`OrderBatch` shapes to `/api/orders/execute` and reads the same structure from
`GET /api/state`. Extend fields additively; renames require coordinated releases.
