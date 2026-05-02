"""Sensor endpoints."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.deps import get_sensor_repo
from app.repositories.sensor_repo import SensorRepository
from app.schemas.sensor import SensorCreate, SensorRead, SensorUpdate

router = APIRouter()


@router.get("", response_model=list[SensorRead])
async def list_sensors(
    repo: SensorRepository = Depends(get_sensor_repo),
) -> list[SensorRead]:
    raise NotImplementedError


@router.post("", response_model=SensorRead, status_code=201)
async def create_sensor(
    payload: SensorCreate,
    repo: SensorRepository = Depends(get_sensor_repo),
) -> SensorRead:
    raise NotImplementedError


@router.patch("/{sensor_id}", response_model=SensorRead)
async def update_sensor(
    sensor_id: UUID,
    payload: SensorUpdate,
    repo: SensorRepository = Depends(get_sensor_repo),
) -> SensorRead:
    raise NotImplementedError
