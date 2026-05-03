"""Sensor request/response DTOs."""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel

from app.schemas.common import GeoPointDTO


class SensorRead(BaseModel):
    """Public sensor projection: identity, label, and where it sits."""

    id: UUID
    name: str
    location: GeoPointDTO
