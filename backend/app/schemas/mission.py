"""Mission DTOs."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.domain.enums import MissionStatus
from app.schemas.common import GeoPointDTO


class AreaOfOperationsDTO(BaseModel):
    name: str
    polygon: list[GeoPointDTO]


class MissionRead(BaseModel):
    id: UUID
    name: str
    status: MissionStatus
    area: AreaOfOperationsDTO
    started_at: datetime
    ended_at: datetime | None
    sensor_ids: list[UUID]
    operator_ids: list[UUID]


class MissionCreate(BaseModel):
    name: str
    area: AreaOfOperationsDTO
    sensor_ids: list[UUID] = []
    operator_ids: list[UUID] = []
