"""ImageryService.

Queries available imagery frames from satellite or drone sensors and
returns metadata only. Image bytes are served directly from object storage
via signed URLs to keep the API stateless.
"""
from __future__ import annotations

from datetime import datetime

from app.domain.enums import SensorType
from app.domain.models.detection import GeoPoint
from app.domain.models.imagery import ImageryFrame
from app.services.base import ServiceBase


class ImageryService(ServiceBase):
    def __init__(self) -> None:
        pass

    async def list_in_window(
        self,
        *,
        bbox: tuple[float, float, float, float] | None,
        since: datetime | None,
        until: datetime | None,
        source: SensorType | None,
        limit: int,
        offset: int,
    ) -> list[ImageryFrame]:
        raise NotImplementedError

    async def find_corroborating(
        self, *, location: GeoPoint, at: datetime, radius_metres: float, window_seconds: float
    ) -> list[ImageryFrame]:
        """Used by `FusionService` to enrich a heartbeat detection."""
        raise NotImplementedError

    async def signed_url(self, frame_id: str, ttl_seconds: int = 600) -> str:
        raise NotImplementedError
