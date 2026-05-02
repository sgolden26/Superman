# Backend

FastAPI service. Stubs only at this stage.

Persistence is a **JSON file** (default `data/demo.json` when you run from this
directory). Override with `APP_DATA_JSON_PATH`. Use `app.api.deps.get_json_store`
when wiring repositories.

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

Layout and conventions live in the root `AGENTS.md`. Read it first.
