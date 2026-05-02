"""Classification DTOs."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.domain.enums import Classification, ThreatLevel


class ClassificationFactorDTO(BaseModel):
    kind: str
    description: str
    weight: float


class ClassificationResultRead(BaseModel):
    id: UUID
    subject_id: UUID
    classification: Classification
    confidence: float
    threat_level: ThreatLevel
    decided_at: datetime
    classifier_name: str
    factors: list[ClassificationFactorDTO]


class ClassifyRequest(BaseModel):
    """Force a re-classification of one subject (operator-initiated)."""

    classifier_name: str | None = None
