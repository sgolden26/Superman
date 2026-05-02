"""Sensor request/response DTOs."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.domain.enums import SensorStatus, SensorType
from app.schemas.common import GeoPointDTO


class SensorRead(BaseModel):
    id: UUID
    name: str
    type: SensorType
    status: SensorStatus
    location: GeoPointDTO
    range_metres: float
    last_heartbeat_at: datetime | None


class SensorCreate(BaseModel):
    name: str
    type: SensorType
    location: GeoPointDTO
    range_metres: float


class SensorUpdate(BaseModel):
    name: str | None = None
    status: SensorStatus | None = None
    location: GeoPointDTO | None = None
