"""Cities: fixed points of strategic value on the map."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

from axis.domain.coordinates import Coordinate


class CityImportance(str, Enum):
    CAPITAL = "capital"
    MAJOR = "major"
    MINOR = "minor"


@dataclass(frozen=True, slots=True)
class City:
    id: str
    name: str
    faction_id: str
    position: Coordinate
    population: int
    importance: CityImportance
    infrastructure: tuple[str, ...] = field(default_factory=tuple)
    country_id: str | None = None

    def __post_init__(self) -> None:
        if self.population < 0:
            raise ValueError("City.population must be non-negative")
