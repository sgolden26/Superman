"""Factions: a side in the conflict, with allegiance and brand colour."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class Allegiance(str, Enum):
    BLUE = "blue"
    RED = "red"
    NEUTRAL = "neutral"


@dataclass(frozen=True, slots=True)
class Faction:
    id: str
    name: str
    allegiance: Allegiance
    color: str  # hex string, used by FE for layer styling

    def __post_init__(self) -> None:
        if not self.id:
            raise ValueError("Faction.id must be non-empty")
        if not self.color.startswith("#") or len(self.color) not in (4, 7):
            raise ValueError(f"Faction.color must be a hex colour, got {self.color!r}")
