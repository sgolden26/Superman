"""DetectionRepository."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from app.domain.models.detection import Detection


class DetectionRepository:
    async def get(self, id_: UUID) -> Detection | None:
        raise NotImplementedError

    async def add(self, detection: Detection) -> Detection:
        raise NotImplementedError

    async def list(
        self,
        *,
        sensor_id: UUID | None = None,
        since: datetime | None = None,
        until: datetime | None = None,
        bbox: tuple[float, float, float, float] | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Detection]:
        raise NotImplementedError

    async def list_recent_for_signature(
        self, signature_id: UUID, limit: int = 50
    ) -> list[Detection]:
        raise NotImplementedError
