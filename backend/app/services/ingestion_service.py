"""IngestionService.

Drives sensor adapters, normalises their readings into `Detection`s and
persists them via the detection repository. Also forwards new detections
to `TrackingService` for clustering.
"""
from __future__ import annotations

from collections.abc import Iterable
from uuid import UUID

from app.domain.models.detection import Detection
from app.repositories.detection_repo import DetectionRepository
from app.sensors.base import SensorBase, SensorReading
from app.services.base import ServiceBase
from app.services.tracking_service import TrackingService


class IngestionService(ServiceBase):
    def __init__(
        self,
        *,
        detection_repo: DetectionRepository,
        tracking_service: TrackingService,
    ) -> None:
        self._detections = detection_repo
        self._tracking = tracking_service

    async def ingest_one(self, sensor: SensorBase, reading: SensorReading) -> Detection:
        """Normalise a single reading and persist it."""
        raise NotImplementedError

    async def poll_sensor(self, sensor: SensorBase) -> list[Detection]:
        """One-shot pull from a sensor and persist all new readings."""
        raise NotImplementedError

    async def run_polling_loop(self, sensors: Iterable[SensorBase]) -> None:
        """Long-running task: continuously poll the given sensors."""
        raise NotImplementedError

    async def list_recent_for_sensor(self, sensor_id: UUID, limit: int) -> list[Detection]:
        raise NotImplementedError
