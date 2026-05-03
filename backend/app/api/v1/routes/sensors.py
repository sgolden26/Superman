"""Sensor endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_sensor_service
from app.schemas.common import GeoPointDTO
from app.schemas.sensor import SensorRead
from app.services.sensor_service import SensorService

router = APIRouter()


@router.get("", response_model=list[SensorRead])
async def list_sensors(
    service: SensorService = Depends(get_sensor_service),
) -> list[SensorRead]:
    sensors = await service.list_sensors()
    return [
        SensorRead(
            id=s.id,
            name=s.name,
            location=GeoPointDTO(
                lat=s.location.lat,
                lon=s.location.lon,
                elevation_m=s.location.elevation_m,
            ),
        )
        for s in sensors
    ]
