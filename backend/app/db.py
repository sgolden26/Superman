"""SQLite engine, session factory, and schema initialisation.

The engine is lazily created so tests can override settings before first use.
Call `init_db()` once at startup to create tables.
"""
from __future__ import annotations

from collections.abc import Iterator
from functools import lru_cache

from sqlmodel import Session, SQLModel, create_engine
from sqlalchemy.engine import Engine

from app.config import get_settings


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    """Return the process-wide SQLite engine, creating the data directory if needed."""
    db_path = get_settings().db_path
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )


def init_db() -> None:
    """Create all tables. Idempotent."""
    # Import models so SQLModel.metadata is populated before create_all.
    from app import models  # noqa: F401

    SQLModel.metadata.create_all(get_engine())


def get_session() -> Iterator[Session]:
    """FastAPI dependency: yield a request-scoped session."""
    with Session(get_engine()) as session:
        yield session
