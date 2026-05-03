# Backend

FastAPI service backed by SQLite (via SQLModel). Managed with [uv].

```bash
uv sync                                # install runtime + dev deps
uv run uvicorn app.main:app --reload   # start the API
uv run pytest                          # run the suite
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

[uv]: https://docs.astral.sh/uv/
