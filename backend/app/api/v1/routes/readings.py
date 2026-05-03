"""Heartbeat readings: sensor ingest and queries."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.db import get_session
from app.models import HeartbeatReading
from app.services import readings as readings_service

router = APIRouter(prefix="/readings", tags=["readings"])


class ReadingIngest(BaseModel):
    sensor_id: int
    fingerprint: str
    lat: float
    lon: float
    height: float
    captured_at: datetime | None = None


@router.post("", response_model=HeartbeatReading, status_code=status.HTTP_201_CREATED)
def ingest_reading(
    payload: ReadingIngest,
    session: Session = Depends(get_session),
) -> HeartbeatReading:
    """Ingest a heartbeat. Fingerprint is resolved to a `Person` (created if new)."""
    return readings_service.ingest(
        session,
        sensor_id=payload.sensor_id,
        fingerprint=payload.fingerprint,
        lat=payload.lat,
        lon=payload.lon,
        height=payload.height,
        captured_at=payload.captured_at,
    )


@router.get("", response_model=list[HeartbeatReading])
def list_readings(
    person_id: int | None = None,
    sensor_id: int | None = None,
    since: datetime | None = None,
    until: datetime | None = None,
    limit: int = Query(default=100, ge=1, le=1000),
    session: Session = Depends(get_session),
) -> list[HeartbeatReading]:
    """Most-recent-first readings, optionally filtered."""
    stmt = select(HeartbeatReading).order_by(HeartbeatReading.captured_at.desc()).limit(limit)
    if person_id is not None:
        stmt = stmt.where(HeartbeatReading.person_id == person_id)
    if sensor_id is not None:
        stmt = stmt.where(HeartbeatReading.sensor_id == sensor_id)
    if since is not None:
        stmt = stmt.where(HeartbeatReading.captured_at >= since)
    if until is not None:
        stmt = stmt.where(HeartbeatReading.captured_at < until)
    return list(session.exec(stmt))
