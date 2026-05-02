"""HeartbeatSignature: the biometric fingerprint extracted from cardiac data."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(frozen=True, slots=True)
class HeartbeatSignature:
    """A compact, comparable representation of a person's cardiac signature.

    The vector is opaque at the domain layer; the matching strategy lives in
    `services.tracking_service` (and ultimately a dedicated matcher).
    """

    id: UUID
    subject_id: UUID | None
    vector: tuple[float, ...]
    captured_at: datetime
    quality: float
