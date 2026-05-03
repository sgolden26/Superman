"""Heartbeat reading ingest: resolve fingerprint to a person, then persist."""
from __future__ import annotations

from datetime import datetime

from sqlmodel import Session

from app.core.exceptions import NotFoundError
from app.models import HeartbeatReading, Sensor
from app.services.people import find_or_create_by_fingerprint
from app.utils.time import utcnow


def ingest(
    session: Session,
    *,
    sensor_id: int,
    fingerprint: str,
    lat: float,
    lon: float,
    height: float,
    captured_at: datetime | None = None,
) -> HeartbeatReading:
    """Persist a new heartbeat reading, creating an unknown person if the fingerprint is new."""
    if session.get(Sensor, sensor_id) is None:
        raise NotFoundError(f"sensor {sensor_id} not found")

    person = find_or_create_by_fingerprint(session, fingerprint)
    assert person.id is not None  # set by flush in find_or_create_by_fingerprint

    reading = HeartbeatReading(
        sensor_id=sensor_id,
        person_id=person.id,
        lat=lat,
        lon=lon,
        height=height,
        captured_at=captured_at or utcnow(),
    )
    session.add(reading)
    session.commit()
    session.refresh(reading)
    return reading
