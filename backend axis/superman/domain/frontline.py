"""Line-of-contact polyline plus render buffer for contested belts."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from superman.domain.coordinates import Coordinate


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
