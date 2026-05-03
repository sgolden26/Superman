"""SubjectRepository."""
from __future__ import annotations

from app.domain.models.subject import Subject


class SubjectRepository:
    """Read subjects. Backed by an empty fixture until a data source is wired."""

    async def list(self) -> list[Subject]:
        # TODO(team): replace with a real source (JSON store, upstream feed).
        return []
