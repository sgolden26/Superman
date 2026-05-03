"""Frontline trace.

A single contiguous line-of-contact polyline plus a buffer width that the
frontend uses to render a contested band. v0.4.0 carries one frontline per
theater; richer multi-segment topologies can be added later.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from axis.domain.coordinates import Coordinate


@dataclass(frozen=True, slots=True)
class Frontline:
    id: str
    name: str
    path: tuple[Coordinate, ...]
    buffer_km: float = 8.0
    updated_at: datetime | None = None
    notes: str = ""
    available_actions: tuple[str, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        if len(self.path) < 2:
            raise ValueError("Frontline.path must have >= 2 points")
        if self.buffer_km < 0:
            raise ValueError("Frontline.buffer_km must be non-negative")
