"""TrackRepository."""
from __future__ import annotations

from uuid import UUID

from app.domain.models.track import Track


class TrackRepository:
    async def get(self, id_: UUID) -> Track | None:
        raise NotImplementedError

    async def add(self, track: Track) -> Track:
        raise NotImplementedError

    async def update(self, track: Track) -> Track:
        raise NotImplementedError

    async def list_active(
        self,
        *,
        bbox: tuple[float, float, float, float] | None = None,
        subject_id: UUID | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Track]:
        raise NotImplementedError

    async def list_for_subject(self, subject_id: UUID) -> list[Track]:
        raise NotImplementedError

    async def list_stale(self, idle_seconds: int) -> list[Track]:
        raise NotImplementedError
