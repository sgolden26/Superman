"""Detection: a single raw observation produced by a sensor."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from app.domain.enums import SensorType


@dataclass(frozen=True, slots=True)
class GeoPoint:
    lat: float
    lon: float
    elevation_m: float | None = None


@dataclass(frozen=True, slots=True)
class Detection:
    """A point-in-time, point-in-space observation from one sensor.

    Heartbeat-bearing detections include `signature_id`. Imagery-only
    detections leave it as `None`.
    """

    id: UUID
    sensor_id: UUID
    sensor_type: SensorType
    location: GeoPoint
    observed_at: datetime
    confidence: float
    signature_id: UUID | None
    metadata: dict[str, object]
