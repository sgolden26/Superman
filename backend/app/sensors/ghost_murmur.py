"""Ghost murmur adapter: long-range cardiac detection (~40 km radius).

Yields heartbeat-bearing readings with a `signature_payload`. The signature
vector is a fixed-length tuple of floats; matching is done downstream by
`TrackingService`.
"""
from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import datetime

from app.domain.enums import SensorType
from app.sensors.base import SensorBase, SensorReading


class GhostMurmurSensor(SensorBase):
    type = SensorType.GHOST_MURMUR

    def __init__(self, *, base_url: str, api_key: str, sensor_id: str) -> None:
        self._base_url = base_url
        self._api_key = api_key
        self._sensor_id = sensor_id

    async def open(self) -> None:
        raise NotImplementedError

    async def close(self) -> None:
        raise NotImplementedError

    def stream(self) -> AsyncIterator[SensorReading]:
        raise NotImplementedError

    async def poll(self, since: datetime | None = None) -> list[SensorReading]:
        raise NotImplementedError

    async def healthcheck(self) -> bool:
        raise NotImplementedError
