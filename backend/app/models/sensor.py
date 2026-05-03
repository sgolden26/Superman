"""A physical or virtual device that produces heartbeat readings."""
from __future__ import annotations

from sqlmodel import Field, SQLModel


class Sensor(SQLModel, table=True):
    """Identity and fixed location of a heartbeat sensor."""

    __tablename__ = "sensor"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    lat: float
    lon: float
