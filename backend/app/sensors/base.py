"""Sensor adapter interface.

A sensor adapter wraps an upstream data source (ghost murmur unit, satellite
provider, drone feed) and yields normalised `SensorReading`s. Lifecycle:
`open()` once, `stream()` for as long as needed, `close()` on shutdown.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from app.domain.enums import SensorType
from app.domain.models.detection import GeoPoint


@dataclass(frozen=True, slots=True)
class SensorReading:
    """Normalised, sensor-agnostic reading.

    Heartbeat-bearing readings (ghost murmur) populate `signature_payload`;
    imagery sensors populate `imagery_uri` instead. Both populate `location`
    and `confidence`.
    """

    sensor_id: UUID
    sensor_type: SensorType
    observed_at: datetime
    location: GeoPoint
    confidence: float
    signature_payload: tuple[float, ...] | None
    imagery_uri: str | None
    raw: dict[str, Any]


class SensorBase(ABC):
    """Abstract base for all sensor adapters."""

    type: SensorType

    @abstractmethod
    async def open(self) -> None:
        """Establish any persistent connection."""

    @abstractmethod
    async def close(self) -> None:
        """Release resources."""

    @abstractmethod
    def stream(self) -> AsyncIterator[SensorReading]:
        """Yield readings as they arrive."""

    @abstractmethod
    async def poll(self, since: datetime | None = None) -> list[SensorReading]:
        """One-shot pull. Used by the polling ingestion loop."""

    @abstractmethod
    async def healthcheck(self) -> bool:
        """Return True if the upstream is reachable and authenticated."""
