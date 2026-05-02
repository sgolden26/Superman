"""Mission endpoints."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.deps import get_mission_repo
from app.repositories.mission_repo import MissionRepository
from app.schemas.mission import MissionCreate, MissionRead

router = APIRouter()


@router.get("", response_model=list[MissionRead])
async def list_missions(
    repo: MissionRepository = Depends(get_mission_repo),
) -> list[MissionRead]:
    raise NotImplementedError


@router.post("", response_model=MissionRead, status_code=201)
async def create_mission(
    payload: MissionCreate,
    repo: MissionRepository = Depends(get_mission_repo),
) -> MissionRead:
    raise NotImplementedError


@router.get("/{mission_id}", response_model=MissionRead)
async def get_mission(
    mission_id: UUID,
    repo: MissionRepository = Depends(get_mission_repo),
) -> MissionRead:
    raise NotImplementedError
