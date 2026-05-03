"""Subject: an observed entity with a known geographic location."""
from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from app.domain.models.geo import GeoPoint


@dataclass(frozen=True, slots=True)
class Subject:
    """A persistent identity for an observed entity.

    Reduced to the demo essentials. Classification, signatures, aliases and
    history will return when those features are reintroduced.
    """

    id: UUID
    name: str
    location: GeoPoint
