"""SubjectService: orchestrates subject reads."""
from __future__ import annotations

from app.domain.models.subject import Subject
from app.repositories.subject_repo import SubjectRepository
from app.services.base import ServiceBase


class SubjectService(ServiceBase):
    """Use-case wrapper over `SubjectRepository`. Keeps routes thin."""

    def __init__(self, repo: SubjectRepository) -> None:
        self._repo = repo

    async def list_subjects(self) -> list[Subject]:
        return await self._repo.list()
