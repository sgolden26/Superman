"""Surface naval manoeuvre grouping."""

from __future__ import annotations

from dataclasses import dataclass
from typing import ClassVar

from superman.units.base import Unit
from superman.units.domain import UnitDomain, UnitKind


@dataclass(slots=True)
class NavalTaskGroup(Unit):
    DOMAIN: ClassVar[UnitDomain] = UnitDomain.NAVAL
    KIND: ClassVar[UnitKind] = UnitKind.NAVAL_TASK_GROUP
