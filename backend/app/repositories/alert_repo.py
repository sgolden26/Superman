"""AlertRepository."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from app.domain.models.alert import Alert
from app.domain.models.detection import GeoPoint


class AlertRepository:
    async def get(self, id_: UUID) -> Alert | None:
        raise NotImplementedError

    async def add(self, alert: Alert) -> Alert:
        raise NotImplementedError

    async def update(self, alert: Alert) -> Alert:
        raise NotImplementedError

    async def list(
        self,
        *,
        since: datetime | None = None,
        unacknowledged_only: bool = False,
        near: GeoPoint | None = None,
        radius_metres: float | None = None,
        audience: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Alert]:
        raise NotImplementedError

    async def find_recent_duplicate(
        self, *, kind: str, subject_id: UUID | None, within_seconds: int
    ) -> Alert | None:
        raise NotImplementedError
