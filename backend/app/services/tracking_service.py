"""TrackingService.

Clusters detections into `Track`s, matches tracks to existing `Subject`s by
heartbeat signature, and creates new subjects when no match is found.
"""
from __future__ import annotations

from uuid import UUID

from app.domain.models.detection import Detection
from app.domain.models.subject import Subject
from app.domain.models.track import Track
from app.repositories.subject_repo import SubjectRepository
from app.repositories.track_repo import TrackRepository
from app.services.base import ServiceBase


class TrackingService(ServiceBase):
    def __init__(
        self,
        *,
        track_repo: TrackRepository,
        subject_repo: SubjectRepository,
        match_threshold: float = 0.85,
    ) -> None:
        self._tracks = track_repo
        self._subjects = subject_repo
        self._match_threshold = match_threshold

    async def assimilate(self, detection: Detection) -> Track:
        """Attach `detection` to an existing track or open a new one."""
        raise NotImplementedError

    async def link_track_to_subject(self, track_id: UUID) -> Subject:
        """Match a track's signature to an existing subject or create one."""
        raise NotImplementedError

    async def expire_stale_tracks(self) -> int:
        """Mark tracks inactive after the configured idle timeout."""
        raise NotImplementedError
