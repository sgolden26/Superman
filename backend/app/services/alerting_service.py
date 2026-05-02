"""AlertingService.

Generates and dispatches alerts. Audience selection (C2 vs field) and
deduplication live here, not in the API layer.
"""
from __future__ import annotations

from uuid import UUID

from app.domain.enums import AlertKind, ThreatLevel
from app.domain.models.alert import Alert
from app.domain.models.detection import GeoPoint
from app.repositories.alert_repo import AlertRepository
from app.services.base import ServiceBase


class AlertingService(ServiceBase):
    def __init__(self, *, alert_repo: AlertRepository) -> None:
        self._alerts = alert_repo

    async def raise_alert(
        self,
        *,
        kind: AlertKind,
        threat_level: ThreatLevel,
        summary: str,
        subject_id: UUID | None = None,
        track_id: UUID | None = None,
        sensor_id: UUID | None = None,
        location: GeoPoint | None = None,
        audience: frozenset[str] | None = None,
    ) -> Alert:
        """Create and persist an alert. Deduplicates against the recent window."""
        raise NotImplementedError

    async def acknowledge(self, alert_id: UUID, user_id: UUID, note: str | None) -> Alert:
        raise NotImplementedError

    async def list_for_audience(
        self, role: str, *, near: GeoPoint | None = None, radius_metres: float | None = None
    ) -> list[Alert]:
        """Audience-filtered + (optionally) proximity-filtered alert feed."""
        raise NotImplementedError
