"""Sensors: register devices and look them up. Trivial CRUD; no service layer."""
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.exceptions import NotFoundError
from app.db import get_session
from app.models import Sensor

router = APIRouter(prefix="/sensors", tags=["sensors"])


class SensorCreate(BaseModel):
    name: str
    lat: float
    lon: float


@router.get("", response_model=list[Sensor])
def list_sensors(session: Session = Depends(get_session)) -> list[Sensor]:
    """All registered sensors, ordered by id."""
    return list(session.exec(select(Sensor).order_by(Sensor.id)))


@router.post("", response_model=Sensor, status_code=status.HTTP_201_CREATED)
def create_sensor(
    payload: SensorCreate,
    session: Session = Depends(get_session),
) -> Sensor:
    """Register a new sensor."""
    sensor = Sensor(**payload.model_dump())
    session.add(sensor)
    session.commit()
    session.refresh(sensor)
    return sensor


@router.get("/{sensor_id}", response_model=Sensor)
def get_sensor(sensor_id: int, session: Session = Depends(get_session)) -> Sensor:
    """One sensor by id."""
    sensor = session.get(Sensor, sensor_id)
    if sensor is None:
        raise NotFoundError(f"sensor {sensor_id} not found")
    return sensor
