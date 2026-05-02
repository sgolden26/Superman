"""Detection endpoints (read-only; ingestion is internal)."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.deps import get_detection_repo
from app.repositories.detection_repo import DetectionRepository
from app.schemas.detection import DetectionQuery, DetectionRead

router = APIRouter()


@router.get("", response_model=list[DetectionRead])
async def list_detections(
    query: DetectionQuery = Depends(),
    repo: DetectionRepository = Depends(get_detection_repo),
) -> list[DetectionRead]:
    raise NotImplementedError


@router.get("/{detection_id}", response_model=DetectionRead)
async def get_detection(
    detection_id: UUID,
    repo: DetectionRepository = Depends(get_detection_repo),
) -> DetectionRead:
    raise NotImplementedError
