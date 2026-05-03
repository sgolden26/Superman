"""FastAPI dependency providers.

Routes import these and never construct services directly. Keeps wiring in
one place and tests easy to override via `app.dependency_overrides`.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from app.config import get_settings
from app.repositories.sensor_repo import SensorRepository
from app.repositories.subject_repo import SubjectRepository
from app.services.sensor_service import SensorService
from app.services.subject_service import SubjectService
from app.storage import JsonDocumentStore


@lru_cache(maxsize=1)
def get_json_store() -> JsonDocumentStore:
    """Demo persistence: one JSON file, see `Settings.data_json_path`."""
    path = Path(get_settings().data_json_path)
    if not path.is_absolute():
        path = Path.cwd() / path
    return JsonDocumentStore(path)


@lru_cache(maxsize=1)
def get_sensor_repo() -> SensorRepository:
    return SensorRepository()


@lru_cache(maxsize=1)
def get_subject_repo() -> SubjectRepository:
    return SubjectRepository()


def get_sensor_service() -> SensorService:
    return SensorService(get_sensor_repo())


def get_subject_service() -> SubjectService:
    return SubjectService(get_subject_repo())
