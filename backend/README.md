# Backend

FastAPI service backed by SQLite (via SQLModel).

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

The database file defaults to `data/superman.db`. Override with `APP_DB_PATH`.
Tables are created on app startup via `app.db.init_db`.

## Layout

```
app/
  main.py        FastAPI factory, wires startup
  config.py      Settings (env-driven)
  db.py          SQLite engine, session, init_db
  models/        One SQLModel table per file (sensor, person, reading)
  core/          Logging, AppError + handlers
  utils/         Pure helpers (time)
```

Conventions live in the root `AGENTS.md`.
