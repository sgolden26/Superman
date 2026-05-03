"""Sensor: a deployed source with a known geographic location."""
from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from app.domain.models.geo import GeoPoint


@dataclass(frozen=True, slots=True)
class Sensor:
    """A single deployed sensor.

    The minimal demo surface is identity, a human-readable name, and a
    location. Type, status, range and heartbeat will return as the product
    expands.
    """

    id: UUID
    name: str
    location: GeoPoint
