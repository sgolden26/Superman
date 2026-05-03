"""Land manoeuvre subclasses (light + armoured brigades)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import ClassVar

from superman.units.base import Unit
from superman.units.domain import UnitDomain, UnitKind


@dataclass(slots=True)
class InfantryBrigade(Unit):
    DOMAIN: ClassVar[UnitDomain] = UnitDomain.GROUND
    KIND: ClassVar[UnitKind] = UnitKind.INFANTRY_BRIGADE


@dataclass(slots=True)
class ArmouredBrigade(Unit):
    DOMAIN: ClassVar[UnitDomain] = UnitDomain.GROUND
    KIND: ClassVar[UnitKind] = UnitKind.ARMOURED_BRIGADE
