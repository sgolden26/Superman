"""SensorRepository."""
from __future__ import annotations

from app.domain.models.sensor import Sensor


class SensorRepository:
    """Read sensors. Backed by an empty fixture until a data source is wired."""

    async def list(self) -> list[Sensor]:
        # TODO(team): replace with a real source (JSON store, upstream feed).
        return []
