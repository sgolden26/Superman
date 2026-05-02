"""Imagery endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_imagery_service
from app.schemas.imagery import ImageryFrameRead, ImageryQuery
from app.services.imagery_service import ImageryService

router = APIRouter()


@router.get("", response_model=list[ImageryFrameRead])
async def list_imagery(
    query: ImageryQuery = Depends(),
    service: ImageryService = Depends(get_imagery_service),
) -> list[ImageryFrameRead]:
    raise NotImplementedError


@router.get("/{frame_id}/url")
async def get_signed_url(
    frame_id: str,
    service: ImageryService = Depends(get_imagery_service),
) -> dict[str, str]:
    raise NotImplementedError
