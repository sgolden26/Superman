"""A known individual identified by their canonical heartbeat fingerprint."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel

from app.utils.time import utcnow


class Person(SQLModel, table=True):
    """A person we can recognise via heartbeat. `attributes` is free-form metadata."""

    __tablename__ = "person"

    id: int | None = Field(default=None, primary_key=True)
    name: str
    fingerprint: str = Field(index=True, unique=True)
    attributes: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=utcnow)
