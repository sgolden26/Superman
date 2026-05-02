"""Alert: an actionable notification for operators or field users."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from app.domain.enums import AlertKind, ThreatLevel
from app.domain.models.detection import GeoPoint


@dataclass(frozen=True, slots=True)
class Alert:
    """A single alert event.

    `audience` is the set of user roles the alert should reach. The field UI
    filters more aggressively (proximity-based) than C2.
    """

    id: UUID
    kind: AlertKind
    threat_level: ThreatLevel
    subject_id: UUID | None
    track_id: UUID | None
    sensor_id: UUID | None
    location: GeoPoint | None
    summary: str
    created_at: datetime
    acknowledged_at: datetime | None
    audience: frozenset[str]
