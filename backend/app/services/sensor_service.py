"""SensorService: orchestrates sensor reads."""
from __future__ import annotations

from app.domain.models.sensor import Sensor
from app.repositories.sensor_repo import SensorRepository
from app.services.base import ServiceBase


class SensorService(ServiceBase):
    """Use-case wrapper over `SensorRepository`. Keeps routes thin."""

    def __init__(self, repo: SensorRepository) -> None:
        self._repo = repo

    async def list_sensors(self) -> list[Sensor]:
        return await self._repo.list()
