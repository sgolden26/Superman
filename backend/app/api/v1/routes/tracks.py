"""Track endpoints."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.deps import get_track_repo
from app.repositories.track_repo import TrackRepository
from app.schemas.track import TrackQuery, TrackRead

router = APIRouter()


@router.get("", response_model=list[TrackRead])
async def list_tracks(
    query: TrackQuery = Depends(),
    repo: TrackRepository = Depends(get_track_repo),
) -> list[TrackRead]:
    raise NotImplementedError


@router.get("/{track_id}", response_model=TrackRead)
async def get_track(
    track_id: UUID,
    repo: TrackRepository = Depends(get_track_repo),
) -> TrackRead:
    raise NotImplementedError
