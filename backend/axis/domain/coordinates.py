"""Geographic primitives. Always (lon, lat), GeoJSON order."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Coordinate:
    """A single (lon, lat) point in WGS84."""

    lon: float
    lat: float

    def __post_init__(self) -> None:
        if not -180.0 <= self.lon <= 180.0:
            raise ValueError(f"Longitude out of range: {self.lon}")
        if not -90.0 <= self.lat <= 90.0:
            raise ValueError(f"Latitude out of range: {self.lat}")

    def as_tuple(self) -> tuple[float, float]:
        return (self.lon, self.lat)


@dataclass(frozen=True, slots=True)
class BoundingBox:
    """Axis-aligned bounding box in (minLon, minLat, maxLon, maxLat) order."""

    min_lon: float
    min_lat: float
    max_lon: float
    max_lat: float

    def __post_init__(self) -> None:
        if self.min_lon > self.max_lon or self.min_lat > self.max_lat:
            raise ValueError("BoundingBox min must be <= max on both axes")

    def as_tuple(self) -> tuple[float, float, float, float]:
        return (self.min_lon, self.min_lat, self.max_lon, self.max_lat)
