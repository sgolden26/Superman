"""Drone footage adapter.

Higher-resolution, lower-latency imagery for active areas. Same interface as
satellite; differentiated by `SensorType.DRONE`.
"""
from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import datetime

from app.domain.enums import SensorType
from app.sensors.base import SensorBase, SensorReading


class DroneSensor(SensorBase):
    type = SensorType.DRONE

    def __init__(self, *, base_url: str, api_key: str, drone_id: str) -> None:
        self._base_url = base_url
        self._api_key = api_key
        self._drone_id = drone_id

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
