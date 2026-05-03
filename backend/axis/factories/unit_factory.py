"""UnitFactory: factory method that hides concrete unit subclasses from callers.

Scenario code and the future simulation engine should never instantiate unit
subclasses directly. Going through the factory means we can swap concrete
classes (e.g. add `MechanisedInfantryBrigade`) without touching every caller.
"""

from __future__ import annotations

from typing import ClassVar

from axis.domain.coordinates import Coordinate
from axis.units.air import AirWing
from axis.units.base import Unit
from axis.units.domain import UnitKind
from axis.units.ground import ArmouredBrigade, InfantryBrigade
from axis.units.naval import NavalTaskGroup


class UnitFactory:
    """Build a unit by `UnitKind`. Stateless; class-level registry."""

    _registry: ClassVar[dict[UnitKind, type[Unit]]] = {
        UnitKind.INFANTRY_BRIGADE: InfantryBrigade,
        UnitKind.ARMOURED_BRIGADE: ArmouredBrigade,
        UnitKind.AIR_WING: AirWing,
        UnitKind.NAVAL_TASK_GROUP: NavalTaskGroup,
    }

    @classmethod
    def register(cls, kind: UnitKind, unit_cls: type[Unit]) -> None:
        """Register a custom unit subclass. Useful for tests and extensions."""
        cls._registry[kind] = unit_cls

    @classmethod
    def create(
        cls,
        *,
        kind: UnitKind,
        id: str,
        name: str,
        faction_id: str,
        position: Coordinate,
        strength: float = 1.0,
        readiness: float = 1.0,
        morale: float = 1.0,
        echelon: str | None = None,
        callsign: str = "",
        country_id: str | None = None,
        available_actions: tuple[str, ...] = (),
        metadata: dict[str, object] | None = None,
    ) -> Unit:
        if kind not in cls._registry:
            raise ValueError(f"No unit class registered for kind={kind!r}")
        unit_cls = cls._registry[kind]
        actions = available_actions or cls._default_actions(kind)
        return unit_cls(
            id=id,
            name=name,
            faction_id=faction_id,
            position=position,
            strength=strength,
            readiness=readiness,
            morale=morale,
            echelon=echelon if echelon is not None else cls._default_echelon(kind),
            callsign=callsign,
            country_id=country_id,
            available_actions=tuple(actions),
            metadata=dict(metadata) if metadata else {},
        )

    @staticmethod
    def _default_echelon(kind: UnitKind) -> str:
        return {
            UnitKind.INFANTRY_BRIGADE: "brigade",
            UnitKind.ARMOURED_BRIGADE: "brigade",
            UnitKind.AIR_WING: "wing",
            UnitKind.NAVAL_TASK_GROUP: "task_group",
        }[kind]

    @staticmethod
    def _default_actions(kind: UnitKind) -> tuple[str, ...]:
        """Action affordances exposed in the FE; execution is stubbed in v1."""
        return {
            UnitKind.INFANTRY_BRIGADE: (
                "advance",
                "dig_in",
                "withdraw",
                "engage",
                "screen",
                "reconnoiter",
            ),
            UnitKind.ARMOURED_BRIGADE: (
                "advance",
                "exploit",
                "counter_attack",
                "withdraw",
                "engage",
                "leaguer",
            ),
            UnitKind.AIR_WING: (
                "intercept",
                "strike",
                "combat_air_patrol",
                "suppress_air_defence",
                "reconnoiter",
            ),
            UnitKind.NAVAL_TASK_GROUP: (
                "patrol",
                "blockade",
                "strike",
                "escort",
                "anti_submarine_patrol",
            ),
        }[kind]
