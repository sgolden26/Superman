"""FastAPI dependency providers.

Routes import these and never construct services directly. Keeps wiring in
one place and tests easy to override via `app.dependency_overrides`.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from app.config import get_settings
from app.repositories.alert_repo import AlertRepository
from app.repositories.detection_repo import DetectionRepository
from app.repositories.mission_repo import MissionRepository
from app.repositories.sensor_repo import SensorRepository
from app.repositories.subject_repo import SubjectRepository
from app.repositories.track_repo import TrackRepository
from app.services.alerting_service import AlertingService
from app.services.classification_service import ClassificationService
from app.services.fusion_service import FusionService
from app.services.history_service import HistoryService
from app.services.imagery_service import ImageryService
from app.services.ingestion_service import IngestionService
from app.services.tracking_service import TrackingService
from app.storage import JsonDocumentStore


@lru_cache(maxsize=1)
def get_json_store() -> JsonDocumentStore:
    """Demo persistence: one JSON file, see `Settings.data_json_path`."""
    path = Path(get_settings().data_json_path)
    if not path.is_absolute():
        path = Path.cwd() / path
    return JsonDocumentStore(path)


def get_detection_repo() -> DetectionRepository:
    raise NotImplementedError


def get_track_repo() -> TrackRepository:
    raise NotImplementedError


def get_subject_repo() -> SubjectRepository:
    raise NotImplementedError


def get_alert_repo() -> AlertRepository:
    raise NotImplementedError


def get_mission_repo() -> MissionRepository:
    raise NotImplementedError


def get_sensor_repo() -> SensorRepository:
    raise NotImplementedError


def get_imagery_service() -> ImageryService:
    raise NotImplementedError


def get_history_service() -> HistoryService:
    raise NotImplementedError


def get_alerting_service() -> AlertingService:
    raise NotImplementedError


def get_tracking_service() -> TrackingService:
    raise NotImplementedError


def get_ingestion_service() -> IngestionService:
    raise NotImplementedError


def get_fusion_service() -> FusionService:
    raise NotImplementedError


def get_classification_service() -> ClassificationService:
    raise NotImplementedError
