"""Mission: an operational context grouping sensors, areas and personnel."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID

from app.domain.enums import MissionStatus
from app.domain.models.detection import GeoPoint


@dataclass(frozen=True, slots=True)
class AreaOfOperations:
    """Polygon defining the geographic scope of a mission."""

    name: str
    polygon: tuple[GeoPoint, ...]


@dataclass(frozen=True, slots=True)
class Mission:
    """A bounded operation. All detections are scoped to a mission for audit."""

    id: UUID
    name: str
    status: MissionStatus
    area: AreaOfOperations
    started_at: datetime
    ended_at: datetime | None
    sensor_ids: tuple[UUID, ...] = field(default_factory=tuple)
    operator_ids: tuple[UUID, ...] = field(default_factory=tuple)
