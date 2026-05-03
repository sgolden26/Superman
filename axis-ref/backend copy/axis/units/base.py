"""Unit ABC.

Concrete units inherit from `Unit` and set `DOMAIN` and `KIND` class
attributes. Combat-relevant behaviour (`engage`, `move`, `take_losses`) lives
on the subclasses so the future simulation layer can dispatch polymorphically
without if-trees.
"""

from __future__ import annotations

from abc import ABC
from dataclasses import dataclass, field
from typing import ClassVar

from axis.domain.coordinates import Coordinate
from axis.units.domain import UnitDomain, UnitKind


def _validate_unit_interval(name: str, value: float) -> None:
    if not 0.0 <= value <= 1.0:
        raise ValueError(f"{name} must be in [0, 1], got {value}")


@dataclass(slots=True)
class Unit(ABC):
    """A combat formation. Subclasses bind a domain and kind."""

    DOMAIN: ClassVar[UnitDomain]
    KIND: ClassVar[UnitKind]

    id: str
    name: str
    faction_id: str
    position: Coordinate
    strength: float = 1.0  # share of nominal combat power remaining
    readiness: float = 1.0  # ability to fight now (training, supply, fatigue)
    morale: float = 1.0  # cohesion / will to fight; driven by intel layer later
    entrenchment: float = 0.0  # 0..1 dug-in level; raises defence in engagements
    echelon: str = "brigade"
    callsign: str = ""
    country_id: str | None = None
    home_base_id: str | None = None  # airfield/naval base id (rebasing target validation)
    available_actions: tuple[str, ...] = field(default_factory=tuple)
    metadata: dict[str, object] = field(default_factory=dict)

    def __post_init__(self) -> None:
        _validate_unit_interval("strength", self.strength)
        _validate_unit_interval("readiness", self.readiness)
        _validate_unit_interval("morale", self.morale)
        _validate_unit_interval("entrenchment", self.entrenchment)
        if not self.id:
            raise ValueError("Unit.id must be non-empty")

    @property
    def domain(self) -> UnitDomain:
        return type(self).DOMAIN

    @property
    def kind(self) -> UnitKind:
        return type(self).KIND
