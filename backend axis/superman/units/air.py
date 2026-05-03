"""Air-domain manoeuvre subclass."""

from __future__ import annotations

from dataclasses import dataclass
from typing import ClassVar

from superman.units.base import Unit
from superman.units.domain import UnitDomain, UnitKind


@dataclass(slots=True)
class AirWing(Unit):
    DOMAIN: ClassVar[UnitDomain] = UnitDomain.AIR
    KIND: ClassVar[UnitKind] = UnitKind.AIR_WING
