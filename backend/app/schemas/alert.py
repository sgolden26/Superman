"""Alert DTOs."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.domain.enums import AlertKind, ThreatLevel
from app.schemas.common import GeoPointDTO


class AlertRead(BaseModel):
    id: UUID
    kind: AlertKind
    threat_level: ThreatLevel
    subject_id: UUID | None
    track_id: UUID | None
    sensor_id: UUID | None
    location: GeoPointDTO | None
    summary: str
    created_at: datetime
    acknowledged_at: datetime | None


class AlertAcknowledgeRequest(BaseModel):
    note: str | None = None


class AlertQuery(BaseModel):
    since: datetime | None = None
    unacknowledged_only: bool = False
    near: GeoPointDTO | None = None
    radius_metres: float | None = None
    limit: int = 100
    offset: int = 0
