"""Aggregate v1 router. Mounted under `/api/v1` in `app.main`."""
from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.routes import people, readings, sensors

api_router = APIRouter()
api_router.include_router(sensors.router)
api_router.include_router(people.router)
api_router.include_router(readings.router)
