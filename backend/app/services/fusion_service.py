"""FusionService.

Combines heterogeneous detections (heartbeat, satellite, drone) into a
single coherent picture for downstream consumers. Emits enriched detections
that link a heartbeat reading to corroborating imagery within a temporal
and spatial window.
"""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from app.domain.models.detection import Detection
from app.domain.models.imagery import ImageryFrame
from app.repositories.detection_repo import DetectionRepository
from app.services.base import ServiceBase
from app.services.imagery_service import ImageryService


class FusionService(ServiceBase):
    def __init__(
        self,
        *,
        detection_repo: DetectionRepository,
        imagery_service: ImageryService,
        spatial_window_metres: float = 250.0,
        temporal_window_seconds: float = 60.0,
    ) -> None:
        self._detections = detection_repo
        self._imagery = imagery_service
        self._spatial = spatial_window_metres
        self._temporal = temporal_window_seconds

    async def fuse_detection(self, detection: Detection) -> list[ImageryFrame]:
        """Return imagery frames temporally and spatially near `detection`."""
        raise NotImplementedError

    async def fuse_window(
        self, since: datetime, until: datetime
    ) -> dict[UUID, list[ImageryFrame]]:
        """Fuse all detections in a window. Keyed by detection id."""
        raise NotImplementedError
