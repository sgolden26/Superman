"""ClassificationResult: a structured civilian-vs-combatant decision."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID

from app.domain.enums import Classification, ThreatLevel


@dataclass(frozen=True, slots=True)
class ClassificationFactor:
    """One piece of evidence contributing to a classification.

    Examples: "carried a rifle in open at 12:04", "matched signature of
    known combatant X", "located inside designated safe zone".
    """

    kind: str
    description: str
    weight: float


@dataclass(frozen=True, slots=True)
class ClassificationResult:
    """The output of `ClassificationService.classify_subject`.

    `confidence` is in [0, 1]. `factors` should be human-readable; the C2
    UI surfaces them verbatim so operators can audit a decision.
    """

    id: UUID
    subject_id: UUID
    classification: Classification
    confidence: float
    threat_level: ThreatLevel
    decided_at: datetime
    classifier_name: str
    factors: tuple[ClassificationFactor, ...] = field(default_factory=tuple)
