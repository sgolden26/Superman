"""Shared Pydantic types."""
from __future__ import annotations

from pydantic import BaseModel, Field


class GeoPointDTO(BaseModel):
    """Wire-format mirror of `app.domain.models.geo.GeoPoint`."""

    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    elevation_m: float | None = None


class ErrorResponse(BaseModel):
    code: str
    message: str
    details: dict[str, object] | None = None
