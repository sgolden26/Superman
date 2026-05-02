"""Subject DTOs."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.domain.enums import Classification


class SubjectRead(BaseModel):
    id: UUID
    primary_signature_id: UUID
    alias: str | None
    current_classification: Classification
    classification_confidence: float
    first_seen_at: datetime
    last_seen_at: datetime
    aliases: list[str]
    tags: list[str]


class SubjectAnnotateRequest(BaseModel):
    """Operator annotations: tagging or aliasing a subject."""

    alias: str | None = None
    add_tags: list[str] = []
    remove_tags: list[str] = []
