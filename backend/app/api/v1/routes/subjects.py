"""Subject endpoints."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.deps import get_subject_repo
from app.repositories.subject_repo import SubjectRepository
from app.schemas.subject import SubjectAnnotateRequest, SubjectRead

router = APIRouter()


@router.get("", response_model=list[SubjectRead])
async def list_subjects(
    repo: SubjectRepository = Depends(get_subject_repo),
) -> list[SubjectRead]:
    raise NotImplementedError


@router.get("/{subject_id}", response_model=SubjectRead)
async def get_subject(
    subject_id: UUID,
    repo: SubjectRepository = Depends(get_subject_repo),
) -> SubjectRead:
    raise NotImplementedError


@router.patch("/{subject_id}", response_model=SubjectRead)
async def annotate_subject(
    subject_id: UUID,
    payload: SubjectAnnotateRequest,
    repo: SubjectRepository = Depends(get_subject_repo),
) -> SubjectRead:
    raise NotImplementedError
