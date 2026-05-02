"""Geographic helpers (haversine, bbox checks, polygon membership)."""
from __future__ import annotations

from app.domain.models.detection import GeoPoint


def haversine_metres(a: GeoPoint, b: GeoPoint) -> float:
    """Great-circle distance between two points, in metres."""
    raise NotImplementedError


def within_radius(centre: GeoPoint, point: GeoPoint, radius_metres: float) -> bool:
    raise NotImplementedError


def bbox_contains(bbox: tuple[float, float, float, float], point: GeoPoint) -> bool:
    """`bbox` is `(min_lon, min_lat, max_lon, max_lat)`."""
    raise NotImplementedError


def polygon_contains(polygon: tuple[GeoPoint, ...], point: GeoPoint) -> bool:
    raise NotImplementedError
