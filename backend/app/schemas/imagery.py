"""Imagery DTOs."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.domain.enums import SensorType
from app.schemas.common import GeoPointDTO


class ImageryFrameRead(BaseModel):
    id: UUID
    source: SensorType
    sensor_id: UUID
    captured_at: datetime
    centre: GeoPointDTO
    footprint: list[GeoPointDTO]
    resolution_m: float
    storage_uri: str


class ImageryQuery(BaseModel):
    bbox: tuple[float, float, float, float] | None = None
    since: datetime | None = None
    until: datetime | None = None
    source: SensorType | None = None
    limit: int = 50
    offset: int = 0
