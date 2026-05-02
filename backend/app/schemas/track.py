"""Track DTOs."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.common import GeoPointDTO


class TrackRead(BaseModel):
    id: UUID
    subject_id: UUID | None
    started_at: datetime
    last_seen_at: datetime
    last_location: GeoPointDTO
    detection_count: int
    is_active: bool


class TrackQuery(BaseModel):
    active_only: bool = True
    subject_id: UUID | None = None
    bbox: tuple[float, float, float, float] | None = None
    limit: int = 100
    offset: int = 0
