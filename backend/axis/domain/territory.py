"""Territories: polygonal regions with a controlling faction and a control share."""

from __future__ import annotations

from dataclasses import dataclass

from axis.domain.coordinates import Coordinate


@dataclass(frozen=True, slots=True)
class Territory:
    id: str
    name: str
    faction_id: str
    polygon: tuple[tuple[Coordinate, ...], ...]  # one or more linear rings, first is outer
    control: float  # 0..1 share of effective control by faction_id
    country_id: str | None = None

    def __post_init__(self) -> None:
        if not 0.0 <= self.control <= 1.0:
            raise ValueError(f"Territory.control must be in [0,1], got {self.control}")
        if not self.polygon or not self.polygon[0]:
            raise ValueError("Territory.polygon must contain at least one non-empty ring")
        for ring in self.polygon:
            if len(ring) < 3:
                raise ValueError("Each polygon ring must have at least 3 points")
