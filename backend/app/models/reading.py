"""A single heartbeat reading captured by a sensor at a point in time and space."""
from __future__ import annotations

from datetime import datetime

from sqlmodel import Field, SQLModel

from app.utils.time import utcnow


class HeartbeatReading(SQLModel, table=True):
    """A heartbeat captured at (lat, lon, height) by a sensor and resolved to a person.

    Resolution is upstream of persistence: each fingerprint is 1:1 with a `Person`,
    so callers look up or create the person before writing the reading.
    """

    __tablename__ = "heartbeat_reading"

    id: int | None = Field(default=None, primary_key=True)
    sensor_id: int = Field(foreign_key="sensor.id", index=True)
    person_id: int = Field(foreign_key="person.id", index=True)
    captured_at: datetime = Field(default_factory=utcnow, index=True)
    lat: float
    lon: float
    height: float  # metres above ground level
