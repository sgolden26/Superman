"""ImageryFrame: a single satellite or drone capture covering a region."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from app.domain.enums import SensorType
from app.domain.models.detection import GeoPoint


@dataclass(frozen=True, slots=True)
class ImageryFrame:
    """One imagery observation usable by the fusion layer.

    The image bytes themselves live in object storage; this model carries the
    metadata needed to fetch them and to align them with detections.
    """

    id: UUID
    source: SensorType
    sensor_id: UUID
    captured_at: datetime
    centre: GeoPoint
    footprint: tuple[GeoPoint, ...]
    resolution_m: float
    storage_uri: str
