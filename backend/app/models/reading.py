"""A single heartbeat reading captured by a sensor at a point in time and space."""
from __future__ import annotations

from datetime import datetime

from sqlmodel import Field, SQLModel

from app.utils.time import utcnow


class HeartbeatReading(SQLModel, table=True):
    """A heartbeat captured at (lat, lon) by a sensor.

    Exactly one of `person_id` or `fingerprint` should be populated:
    - `person_id` set: the heartbeat was matched to a known `Person`.
    - `fingerprint` set: raw signature for an as-yet-unidentified person.
    """

    __tablename__ = "heartbeat_reading"

    id: int | None = Field(default=None, primary_key=True)
    sensor_id: int = Field(foreign_key="sensor.id", index=True)
    captured_at: datetime = Field(default_factory=utcnow, index=True)
    lat: float
    lon: float
    person_id: int | None = Field(default=None, foreign_key="person.id", index=True)
    fingerprint: str | None = Field(default=None, index=True)
