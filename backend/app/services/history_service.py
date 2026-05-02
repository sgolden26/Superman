"""HistoryService.

Read-side queries over historical detections, tracks and classifications.
Powers the timeline view in the C2 console and supplies historical
evidence (e.g. "carried weapon openly at...") to the classifier context.
"""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from app.domain.models.classification import ClassificationResult
from app.domain.models.detection import Detection
from app.domain.models.track import Track
from app.repositories.detection_repo import DetectionRepository
from app.repositories.subject_repo import SubjectRepository
from app.repositories.track_repo import TrackRepository
from app.services.base import ServiceBase


class HistoryService(ServiceBase):
    def __init__(
        self,
        *,
        detection_repo: DetectionRepository,
        track_repo: TrackRepository,
        subject_repo: SubjectRepository,
    ) -> None:
        self._detections = detection_repo
        self._tracks = track_repo
        self._subjects = subject_repo

    async def subject_timeline(
        self, subject_id: UUID, *, since: datetime, until: datetime
    ) -> list[Detection]:
        raise NotImplementedError

    async def subject_tracks(self, subject_id: UUID) -> list[Track]:
        raise NotImplementedError

    async def subject_classifications(self, subject_id: UUID) -> list[ClassificationResult]:
        raise NotImplementedError

    async def historical_tags_for_subject(self, subject_id: UUID) -> list[str]:
        """Aggregate evidence tags fed to the classifier (e.g. open-carry events)."""
        raise NotImplementedError
