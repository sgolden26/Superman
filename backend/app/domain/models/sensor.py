"""Sensor: a deployed source of detections (ghost murmur unit, sat, drone)."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from app.domain.enums import SensorStatus, SensorType
from app.domain.models.detection import GeoPoint


@dataclass(frozen=True, slots=True)
class Sensor:
    """A single deployed sensor.

    `range_metres` is the nominal detection radius for the device. Ghost murmur
    units are spec'd at 40_000 m.
    """

    id: UUID
    name: str
    type: SensorType
    status: SensorStatus
    location: GeoPoint
    range_metres: float
    last_heartbeat_at: datetime | None
