"""Air units."""

from __future__ import annotations

from dataclasses import dataclass
from typing import ClassVar

from axis.units.base import Unit
from axis.units.domain import UnitDomain, UnitKind


@dataclass(slots=True)
class AirWing(Unit):
    DOMAIN: ClassVar[UnitDomain] = UnitDomain.AIR
    KIND: ClassVar[UnitKind] = UnitKind.AIR_WING
