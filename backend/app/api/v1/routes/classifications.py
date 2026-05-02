"""Classification endpoints."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.deps import get_classification_service
from app.schemas.classification import ClassificationResultRead, ClassifyRequest
from app.services.classification_service import ClassificationService

router = APIRouter()


@router.get("/subject/{subject_id}", response_model=list[ClassificationResultRead])
async def history_for_subject(
    subject_id: UUID,
    service: ClassificationService = Depends(get_classification_service),
) -> list[ClassificationResultRead]:
    raise NotImplementedError


@router.post("/subject/{subject_id}", response_model=ClassificationResultRead)
async def classify_subject(
    subject_id: UUID,
    payload: ClassifyRequest,
    service: ClassificationService = Depends(get_classification_service),
) -> ClassificationResultRead:
    raise NotImplementedError
