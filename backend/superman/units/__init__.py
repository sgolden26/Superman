"""Combined exports for manoeuvre subclasses."""

from superman.units.air import AirWing
from superman.units.base import Unit
from superman.units.domain import UnitDomain, UnitKind
from superman.units.ground import ArmouredBrigade, InfantryBrigade
from superman.units.naval import NavalTaskGroup

__all__ = [
    "AirWing",
    "ArmouredBrigade",
    "InfantryBrigade",
    "NavalTaskGroup",
    "Unit",
    "UnitDomain",
    "UnitKind",
]
