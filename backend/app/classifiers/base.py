"""Classifier interface.

A classifier maps a `Subject` plus contextual evidence to a
`ClassificationResult`. Implementations must be deterministic given the
same context and explain their decision via `factors`.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from app.domain.models.classification import ClassificationResult
from app.domain.models.detection import Detection
from app.domain.models.imagery import ImageryFrame
from app.domain.models.subject import Subject
from app.domain.models.track import Track


@dataclass(frozen=True, slots=True)
class ClassifierContext:
    """Bundle of evidence handed to a classifier.

    All fields are read-only views. Order should be deterministic
    (chronological where applicable) so classifications are reproducible.
    """

    subject: Subject
    tracks: tuple[Track, ...] = field(default_factory=tuple)
    detections: tuple[Detection, ...] = field(default_factory=tuple)
    imagery: tuple[ImageryFrame, ...] = field(default_factory=tuple)
    historical_tags: tuple[str, ...] = field(default_factory=tuple)


class ClassifierBase(ABC):
    """Abstract base for all classifiers."""

    name: str

    @abstractmethod
    async def classify(self, context: ClassifierContext) -> ClassificationResult:
        """Return a classification for the subject in `context`."""
