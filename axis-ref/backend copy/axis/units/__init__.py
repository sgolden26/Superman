"""Combat units: ABC + concrete subclasses per domain."""

from axis.units.air import AirWing
from axis.units.base import Unit
from axis.units.domain import UnitDomain, UnitKind
from axis.units.ground import ArmouredBrigade, InfantryBrigade
from axis.units.naval import NavalTaskGroup

__all__ = [
    "AirWing",
    "ArmouredBrigade",
    "InfantryBrigade",
    "NavalTaskGroup",
    "Unit",
    "UnitDomain",
    "UnitKind",
]
