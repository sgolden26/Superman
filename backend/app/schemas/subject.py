"""Subject DTOs."""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel

from app.schemas.common import GeoPointDTO


class SubjectRead(BaseModel):
    """Public subject projection: identity, label, and current location."""

    id: UUID
    name: str
    location: GeoPointDTO
