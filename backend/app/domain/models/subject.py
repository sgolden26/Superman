"""Subject: an identified (or pseudonymous) human signature."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID

from app.domain.enums import Classification


@dataclass(frozen=True, slots=True)
class Subject:
    """A persistent identity for a human signature across encounters.

    A subject may aggregate multiple historical tracks. Identity may be
    pseudonymous (signature-only) or asserted with higher-confidence
    biometrics if available.
    """

    id: UUID
    primary_signature_id: UUID
    alias: str | None
    current_classification: Classification
    classification_confidence: float
    first_seen_at: datetime
    last_seen_at: datetime
    aliases: tuple[str, ...] = field(default_factory=tuple)
    tags: tuple[str, ...] = field(default_factory=tuple)
