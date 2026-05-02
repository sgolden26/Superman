"""Satellite imagery adapter.

Yields imagery readings (with `imagery_uri`) covering a polygon footprint.
Used by `FusionService` to corroborate or contradict heartbeat detections.
"""
from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import datetime

from app.domain.enums import SensorType
from app.sensors.base import SensorBase, SensorReading


class SatelliteSensor(SensorBase):
    type = SensorType.SATELLITE

    def __init__(self, *, base_url: str, api_key: str, constellation: str) -> None:
        self._base_url = base_url
        self._api_key = api_key
        self._constellation = constellation

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
