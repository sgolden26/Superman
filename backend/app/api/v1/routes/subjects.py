"""Subject endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_subject_service
from app.schemas.common import GeoPointDTO
from app.schemas.subject import SubjectRead
from app.services.subject_service import SubjectService

router = APIRouter()


@router.get("", response_model=list[SubjectRead])
async def list_subjects(
    service: SubjectService = Depends(get_subject_service),
) -> list[SubjectRead]:
    subjects = await service.list_subjects()
    return [
        SubjectRead(
            id=s.id,
            name=s.name,
            location=GeoPointDTO(
                lat=s.location.lat,
                lon=s.location.lon,
                elevation_m=s.location.elevation_m,
            ),
        )
        for s in subjects
    ]
