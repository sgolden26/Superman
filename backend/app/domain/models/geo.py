"""Geographic primitives shared across domain models."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class GeoPoint:
    """A WGS84 point. `elevation_m` is optional and metres above sea level."""

    lat: float
    lon: float
    elevation_m: float | None = None
