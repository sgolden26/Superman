"""ClassificationService.

Builds a `ClassifierContext` for a subject and delegates to a chosen
classifier. Persists the result and emits a classification-change alert
via `AlertingService` when the verdict materially changes.
"""
from __future__ import annotations

from uuid import UUID

from app.classifiers.base import ClassifierBase
from app.classifiers.factory import ClassifierFactory
from app.domain.models.classification import ClassificationResult
from app.repositories.detection_repo import DetectionRepository
from app.repositories.subject_repo import SubjectRepository
from app.repositories.track_repo import TrackRepository
from app.services.alerting_service import AlertingService
from app.services.base import ServiceBase
from app.services.history_service import HistoryService
from app.services.imagery_service import ImageryService


class ClassificationService(ServiceBase):
    def __init__(
        self,
        *,
        subject_repo: SubjectRepository,
        track_repo: TrackRepository,
        detection_repo: DetectionRepository,
        imagery_service: ImageryService,
        history_service: HistoryService,
        alerting_service: AlertingService,
    ) -> None:
        self._subjects = subject_repo
        self._tracks = track_repo
        self._detections = detection_repo
        self._imagery = imagery_service
        self._history = history_service
        self._alerts = alerting_service

    async def classify_subject(
        self, subject_id: UUID, *, classifier: ClassifierBase | None = None
    ) -> ClassificationResult:
        """Classify a subject; persist; emit alert if classification changed."""
        raise NotImplementedError

    async def reclassify_window(self, since_minutes: int = 15) -> list[ClassificationResult]:
        """Re-run classification for all subjects active in the recent window."""
        raise NotImplementedError

    def default_classifier(self) -> ClassifierBase:
        return ClassifierFactory.default()
