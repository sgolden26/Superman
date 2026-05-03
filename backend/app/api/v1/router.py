"""Top-level v1 router. Mount each area router here."""
from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.routes import sensors, subjects

api_router = APIRouter()
api_router.include_router(sensors.router, prefix="/sensors", tags=["sensors"])
api_router.include_router(subjects.router, prefix="/subjects", tags=["subjects"])
