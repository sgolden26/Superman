"""SubjectRepository."""
from __future__ import annotations

from uuid import UUID

from app.domain.models.heartbeat_signature import HeartbeatSignature
from app.domain.models.subject import Subject


class SubjectRepository:
    async def get(self, id_: UUID) -> Subject | None:
        raise NotImplementedError

    async def add(self, subject: Subject) -> Subject:
        raise NotImplementedError

    async def update(self, subject: Subject) -> Subject:
        raise NotImplementedError

    async def find_by_signature(
        self, signature: HeartbeatSignature, *, threshold: float
    ) -> Subject | None:
        """Vector-similarity match. Threshold is cosine similarity."""
        raise NotImplementedError

    async def list(
        self, *, classification: str | None = None, limit: int = 100, offset: int = 0
    ) -> list[Subject]:
        raise NotImplementedError
