"""A known individual identified by their canonical heartbeat fingerprint."""
from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel

from app.utils.time import utcnow


class Alignment(StrEnum):
    """Force/affiliation tag used to render the person in the UI."""

    BLUE = "blue"      # ally
    GREEN = "green"    # neutral / partner
    RED = "red"        # hostile
    GREY = "grey"      # unknown


class Person(SQLModel, table=True):
    """A person we can recognise via heartbeat. `attributes` is free-form metadata."""

    __tablename__ = "person"

    id: int | None = Field(default=None, primary_key=True)
    name: str
    alignment: Alignment = Field(default=Alignment.GREY, index=True)
    fingerprint: str = Field(index=True, unique=True)
    attributes: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=utcnow)
