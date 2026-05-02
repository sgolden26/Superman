"""Track: a temporally and spatially clustered sequence of detections."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from app.domain.models.detection import GeoPoint


@dataclass(frozen=True, slots=True)
class Track:
    """A persistent identity for one moving signature.

    A track is the unit operators reason about: "person 7 is moving north".
    Tracks may be linked to a `Subject` once an identity is asserted.
    """

    id: UUID
    subject_id: UUID | None
    started_at: datetime
    last_seen_at: datetime
    last_location: GeoPoint
    detection_count: int
    is_active: bool
