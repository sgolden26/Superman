"""MissionRepository."""
from __future__ import annotations

from uuid import UUID

from app.domain.models.mission import Mission


class MissionRepository:
    async def get(self, id_: UUID) -> Mission | None:
        raise NotImplementedError

    async def add(self, mission: Mission) -> Mission:
        raise NotImplementedError

    async def update(self, mission: Mission) -> Mission:
        raise NotImplementedError

    async def list(
        self, *, status: str | None = None, limit: int = 100, offset: int = 0
    ) -> list[Mission]:
        raise NotImplementedError
