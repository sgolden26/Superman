"""Detection DTOs."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.domain.enums import SensorType
from app.schemas.common import GeoPointDTO


class DetectionRead(BaseModel):
    id: UUID
    sensor_id: UUID
    sensor_type: SensorType
    location: GeoPointDTO
    observed_at: datetime
    confidence: float
    signature_id: UUID | None
    metadata: dict[str, object]


class DetectionQuery(BaseModel):
    """Filter parameters for `GET /detections`."""

    sensor_id: UUID | None = None
    since: datetime | None = None
    until: datetime | None = None
    bbox: tuple[float, float, float, float] | None = None
    limit: int = 100
    offset: int = 0
