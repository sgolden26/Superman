"""Top-level v1 router. Mount each area router here."""
from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.routes import (
    alerts,
    classifications,
    detections,
    imagery,
    missions,
    sensors,
    subjects,
    tracks,
)

api_router = APIRouter()
api_router.include_router(detections.router, prefix="/detections", tags=["detections"])
api_router.include_router(tracks.router, prefix="/tracks", tags=["tracks"])
api_router.include_router(subjects.router, prefix="/subjects", tags=["subjects"])
api_router.include_router(
    classifications.router, prefix="/classifications", tags=["classifications"]
)
api_router.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
api_router.include_router(sensors.router, prefix="/sensors", tags=["sensors"])
api_router.include_router(imagery.router, prefix="/imagery", tags=["imagery"])
api_router.include_router(missions.router, prefix="/missions", tags=["missions"])
