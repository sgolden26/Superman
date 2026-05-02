"""SensorRepository."""
from __future__ import annotations

from uuid import UUID

from app.domain.enums import SensorStatus, SensorType
from app.domain.models.sensor import Sensor


class SensorRepository:
    async def get(self, id_: UUID) -> Sensor | None:
        raise NotImplementedError

    async def add(self, sensor: Sensor) -> Sensor:
        raise NotImplementedError

    async def update(self, sensor: Sensor) -> Sensor:
        raise NotImplementedError

    async def list(
        self,
        *,
        type_: SensorType | None = None,
        status: SensorStatus | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Sensor]:
        raise NotImplementedError
