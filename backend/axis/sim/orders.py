"""Order abstraction and resolver.

The simulation engine accepts batches of player-issued ``Order`` instances and
mutates a ``Theater`` accordingly. The hierarchy is intentionally polymorphic
so new order kinds can drop in alongside the existing ones without changes to
the HTTP layer or the FE wiring.

Design points
-------------
- ``Order`` is the ABC. Each subclass owns a unique ``kind`` discriminator,
  knows how to validate itself against a ``Theater``, and how to apply
  itself.
- ``OrderRegistry`` decodes ``{"kind": ..., ...}`` payloads into the right
  subclass. New kinds register themselves at import time via
  ``OrderRegistry.register``.
- ``OrderBatch`` runs validate-all then apply-all in *phase order* so a
  malformed order doesn't half-mutate the theatre and so naturally
  sequenced effects (move -> strike -> resupply -> political fallout) are
  applied in the right sequence.
- Combat math lives in ``axis.sim.combat``. Order subclasses are responsible
  only for translating their parameters into a call into that module and
  folding the result back into the theatre.
"""

from __future__ import annotations

import dataclasses
import enum
import math
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, ClassVar, Iterable, Literal

from axis.domain.coordinates import Coordinate
from axis.domain.country import Country, PublicOpinion
from axis.domain.faction import Allegiance
from axis.domain.military_assets import (
    Airfield,
    Depot,
    MissileRange,
    SupplyLine,
)
from axis.domain.oblast import Oblast
from axis.domain.theater import Theater
from axis.sim.combat import (
    AIR_REBASE_RADIUS_KM,
    AIR_SORTIE_RADIUS_KM,
    BatchRng,
    EngagementResolution,
    NAVAL_MOVE_RADIUS_KM,
    StrikeResolution,
    engagement_range_km,
    haversine_km,
    is_target_detected,
    resolve_engagement,
    resolve_strike,
)
from axis.units.base import Unit
from axis.units.domain import UnitDomain, UnitKind


PlayerTeam = Literal["red", "blue"]


_TEAM_TO_ALLEGIANCE: dict[PlayerTeam, Allegiance] = {
    "red": Allegiance.RED,
    "blue": Allegiance.BLUE,
}


# Mirror of frontend/src/state/groundMove.ts RADIUS_KM. Keep in sync.
_GROUND_MOVE_RADIUS_KM: dict[str, float] = {
    "foot": 24.1,
    "vehicle": 250.0,
}


# ---------------------------------------------------------------------------
# Phases
# ---------------------------------------------------------------------------


class Phase(enum.IntEnum):
    """Execution phases. Lower values resolve first."""

    POSTURE = 10        # entrench (passive flag flips)
    MOVE = 20           # move ground / rebase air / move naval
    INTERDICT = 30      # missile / sortie strikes vs supply lines, SAMs, fixed assets
    ENGAGE = 40         # unit-vs-unit direct combat
    RESUPPLY = 50       # depot pushes to friendly units along supply lines
    POLITICAL = 60      # roll up civilian/asset damage into country dimensions


# ---------------------------------------------------------------------------
# Outcome types
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class OrderOutcome:
    """Per-order result returned to the caller."""

    order_id: str
    ok: bool
    message: str = ""
    kind: str = ""
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "order_id": self.order_id,
            "ok": self.ok,
            "message": self.message,
            "kind": self.kind,
            "details": self.details,
        }


@dataclass(slots=True)
class ExecutionResult:
    """Aggregate outcome of an OrderBatch.execute call."""

    ok: bool
    outcomes: list[OrderOutcome] = field(default_factory=list)
    political_summary: dict[str, dict[str, float]] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "outcomes": [o.to_dict() for o in self.outcomes],
            "political_summary": {
                k: {kk: round(vv, 3) for kk, vv in v.items()}
                for k, v in self.political_summary.items()
            },
        }


# ---------------------------------------------------------------------------
# Order ABC + registry
# ---------------------------------------------------------------------------


class Order(ABC):
    """A single player-issued instruction the engine can resolve."""

    kind: ClassVar[str]
    phase: ClassVar[Phase] = Phase.MOVE
    label: ClassVar[str] = ""
    description: ClassVar[str] = ""

    def __init__(self, *, order_id: str, issuer_team: PlayerTeam) -> None:
        if not order_id:
            raise ValueError("Order.order_id must be non-empty")
        if issuer_team not in ("red", "blue"):
            raise ValueError(f"issuer_team must be 'red' or 'blue', got {issuer_team!r}")
        self.order_id = order_id
        self.issuer_team = issuer_team

    @abstractmethod
    def validate(self, theater: Theater) -> OrderOutcome: ...

    @abstractmethod
    def apply(self, theater: Theater, *, rng: BatchRng, ledger: "PoliticalLedger") -> OrderOutcome:
        """Mutate the theatre. May write civilian/asset damage to ``ledger``."""

    @classmethod
    @abstractmethod
    def from_dict(cls, raw: dict[str, Any]) -> "Order": ...


class OrderRegistry:
    """Decodes JSON payloads into concrete Order subclasses."""

    _classes: ClassVar[dict[str, type[Order]]] = {}

    @classmethod
    def register(cls, order_cls: type[Order]) -> type[Order]:
        kind = getattr(order_cls, "kind", None)
        if not isinstance(kind, str) or not kind:
            raise TypeError(f"{order_cls!r} must define a non-empty `kind` ClassVar")
        if kind in cls._classes and cls._classes[kind] is not order_cls:
            raise ValueError(f"Order kind {kind!r} already registered")
        cls._classes[kind] = order_cls
        return order_cls

    @classmethod
    def decode(cls, raw: dict[str, Any]) -> Order:
        kind = raw.get("kind")
        if not isinstance(kind, str):
            raise ValueError("order payload missing 'kind'")
        if kind not in cls._classes:
            raise ValueError(f"unknown order kind: {kind!r}")
        return cls._classes[kind].from_dict(raw)

    @classmethod
    def known_kinds(cls) -> tuple[str, ...]:
        return tuple(sorted(cls._classes))

    @classmethod
    def catalogue(cls) -> list[dict[str, str]]:
        items: list[dict[str, str]] = []
        for k, c in cls._classes.items():
            items.append(
                {
                    "kind": k,
                    "label": c.label or k,
                    "description": c.description,
                    "phase": c.phase.name,
                }
            )
        items.sort(key=lambda x: (x["phase"], x["kind"]))
        return items


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _clamp(value: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, value))


def _find_unit(theater: Theater, unit_id: str) -> Unit | None:
    for u in theater.units:
        if u.id == unit_id:
            return u
    return None


def _coord_from_payload(value: Any, *, label: str) -> Coordinate:
    try:
        lon = float(value[0])
        lat = float(value[1])
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise ValueError(f"{label} malformed: {exc}") from exc
    return Coordinate(lon=lon, lat=lat)


def _faction_owns_unit(theater: Theater, unit: Unit, team: PlayerTeam) -> bool:
    try:
        faction = theater.faction(unit.faction_id)
    except KeyError:
        return False
    return faction.allegiance is _TEAM_TO_ALLEGIANCE[team]


def _faction_owns_id(theater: Theater, faction_id: str, team: PlayerTeam) -> bool:
    try:
        faction = theater.faction(faction_id)
    except KeyError:
        return False
    return faction.allegiance is _TEAM_TO_ALLEGIANCE[team]


def _replace_in_list(items: list[Any], replacement: Any) -> None:
    for i, item in enumerate(items):
        if item.id == replacement.id:
            items[i] = replacement
            return
    raise KeyError(f"id {replacement.id!r} not found")


def _replace_country(theater: Theater, country: Country) -> None:
    _replace_in_list(theater.countries, country)


def _replace_oblast(theater: Theater, oblast: Oblast) -> None:
    _replace_in_list(theater.oblasts, oblast)


# Country -> oblast lookup by point-in-bbox (oblasts have only metadata, not
# polygons, in the backend; we approximate by capital_city distance).
def _oblast_for_position(theater: Theater, country_id: str, position: Coordinate) -> Oblast | None:
    candidates = [o for o in theater.oblasts if o.country_id == country_id]
    if not candidates:
        return None
    best: Oblast | None = None
    best_d = math.inf
    for o in candidates:
        ref = o.centroid
        if ref is None and o.capital_city_id:
            for c in theater.cities:
                if c.id == o.capital_city_id:
                    ref = c.position
                    break
        if ref is None:
            continue
        d = haversine_km(ref, position)
        if d < best_d:
            best_d = d
            best = o
    return best


def _country_for_position(theater: Theater, position: Coordinate) -> Country | None:
    """Heuristic: nearest capital city. Fine for the demo (oblasts are only UA)."""
    best: Country | None = None
    best_d = math.inf
    for c in theater.countries:
        if c.capital_city_id is None:
            continue
        cap = next((ct for ct in theater.cities if ct.id == c.capital_city_id), None)
        if cap is None:
            continue
        d = haversine_km(cap.position, position)
        if d < best_d:
            best_d = d
            best = c
    return best


# ---------------------------------------------------------------------------
# Political ledger (collected during apply, drained in PoliticalRolloutOrder)
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class PoliticalLedger:
    """Accumulates political deltas during a batch.

    Order subclasses call `note_*` while applying. The engine then folds the
    aggregate into country dimensions in a single Phase.POLITICAL pass so we
    can show a cleaner summary in the UI.
    """

    civilian_strikes: dict[str, int] = field(default_factory=dict)  # country_id -> count
    infrastructure_hits: dict[str, int] = field(default_factory=dict)
    military_strikes: dict[str, int] = field(default_factory=dict)
    oblast_struck: dict[str, int] = field(default_factory=dict)  # oblast_id -> hit count

    def note_city_hit(self, country_id: str, oblast_id: str | None) -> None:
        self.civilian_strikes[country_id] = self.civilian_strikes.get(country_id, 0) + 1
        if oblast_id is not None:
            self.oblast_struck[oblast_id] = self.oblast_struck.get(oblast_id, 0) + 1

    def note_infra_hit(self, country_id: str) -> None:
        self.infrastructure_hits[country_id] = self.infrastructure_hits.get(country_id, 0) + 1

    def note_military_hit(self, country_id: str) -> None:
        self.military_strikes[country_id] = self.military_strikes.get(country_id, 0) + 1


# ---------------------------------------------------------------------------
# Concrete orders
# ---------------------------------------------------------------------------


GroundMoveMode = Literal["foot", "vehicle"]


class MoveOrder(Order):
    """Relocate a single ground unit to a destination within mode radius."""

    kind: ClassVar[str] = "move"
    phase: ClassVar[Phase] = Phase.MOVE
    label: ClassVar[str] = "Ground move"
    description: ClassVar[str] = "Reposition a ground unit on foot or by vehicle."

    def __init__(
        self,
        *,
        order_id: str,
        issuer_team: PlayerTeam,
        unit_id: str,
        mode: GroundMoveMode,
        destination: Coordinate,
    ) -> None:
        super().__init__(order_id=order_id, issuer_team=issuer_team)
        if mode not in ("foot", "vehicle"):
            raise ValueError(f"MoveOrder.mode must be 'foot' or 'vehicle', got {mode!r}")
        self.unit_id = unit_id
        self.mode = mode
        self.destination = destination

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "MoveOrder":
        return cls(
            order_id=str(raw["order_id"]),
            issuer_team=raw["issuer_team"],
            unit_id=str(raw["unit_id"]),
            mode=raw["mode"],
            destination=_coord_from_payload(raw["destination"], label="MoveOrder.destination"),
        )

    def validate(self, theater: Theater) -> OrderOutcome:
        unit = _find_unit(theater, self.unit_id)
        if unit is None:
            return OrderOutcome(self.order_id, False, f"unknown unit: {self.unit_id}", self.kind)
        if unit.domain is not UnitDomain.GROUND:
            return OrderOutcome(
                self.order_id, False,
                f"unit {unit.id} is not a ground unit (domain={unit.domain.value})", self.kind,
            )
        if not _faction_owns_unit(theater, unit, self.issuer_team):
            return OrderOutcome(
                self.order_id, False,
                f"unit {unit.id} does not belong to the {self.issuer_team} team", self.kind,
            )
        radius_km = _GROUND_MOVE_RADIUS_KM[self.mode]
        d = haversine_km(unit.position, self.destination)
        if d > radius_km * 1.01:
            return OrderOutcome(
                self.order_id, False,
                f"destination {d:.1f} km exceeds {self.mode} range {radius_km:.1f} km",
                self.kind,
            )
        return OrderOutcome(self.order_id, True, "ok", self.kind)

    def apply(self, theater: Theater, *, rng: BatchRng, ledger: PoliticalLedger) -> OrderOutcome:
        unit = _find_unit(theater, self.unit_id)
        if unit is None:
            raise RuntimeError(f"MoveOrder.apply: unit {self.unit_id} no longer present")
        unit.position = self.destination
        unit.entrenchment = 0.0  # moving breaks entrenchment
        return OrderOutcome(
            self.order_id, True, "moved", self.kind,
            {"unit_id": self.unit_id, "destination": [self.destination.lon, self.destination.lat]},
        )


OrderRegistry.register(MoveOrder)


class EntrenchOrder(Order):
    """Dig in: raise the unit's entrenchment level (defensive bonus)."""

    kind: ClassVar[str] = "entrench"
    phase: ClassVar[Phase] = Phase.POSTURE
    label: ClassVar[str] = "Entrench"
    description: ClassVar[str] = "Dig in. Boosts defence in next engagement, no movement."

    def __init__(self, *, order_id: str, issuer_team: PlayerTeam, unit_id: str) -> None:
        super().__init__(order_id=order_id, issuer_team=issuer_team)
        self.unit_id = unit_id

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "EntrenchOrder":
        return cls(
            order_id=str(raw["order_id"]),
            issuer_team=raw["issuer_team"],
            unit_id=str(raw["unit_id"]),
        )

    def validate(self, theater: Theater) -> OrderOutcome:
        unit = _find_unit(theater, self.unit_id)
        if unit is None:
            return OrderOutcome(self.order_id, False, f"unknown unit: {self.unit_id}", self.kind)
        if unit.domain is not UnitDomain.GROUND:
            return OrderOutcome(self.order_id, False, "only ground units can entrench", self.kind)
        if not _faction_owns_unit(theater, unit, self.issuer_team):
            return OrderOutcome(self.order_id, False, "unit not on issuing team", self.kind)
        if unit.entrenchment >= 0.95:
            return OrderOutcome(self.order_id, False, "already fully entrenched", self.kind)
        return OrderOutcome(self.order_id, True, "ok", self.kind)

    def apply(self, theater: Theater, *, rng: BatchRng, ledger: PoliticalLedger) -> OrderOutcome:
        unit = _find_unit(theater, self.unit_id)
        assert unit is not None
        before = unit.entrenchment
        unit.entrenchment = _clamp(unit.entrenchment + 0.30 + 0.10 * unit.readiness)
        return OrderOutcome(
            self.order_id, True, "entrenched", self.kind,
            {"unit_id": unit.id, "entrenchment_before": round(before, 2),
             "entrenchment_after": round(unit.entrenchment, 2)},
        )


OrderRegistry.register(EntrenchOrder)


class EngageOrder(Order):
    """Direct unit-vs-unit engagement (ground or naval)."""

    kind: ClassVar[str] = "engage"
    phase: ClassVar[Phase] = Phase.ENGAGE
    label: ClassVar[str] = "Engage"
    description: ClassVar[str] = "Attack a detected enemy unit within engagement range."

    def __init__(
        self, *, order_id: str, issuer_team: PlayerTeam, attacker_id: str, target_id: str,
    ) -> None:
        super().__init__(order_id=order_id, issuer_team=issuer_team)
        self.attacker_id = attacker_id
        self.target_id = target_id

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "EngageOrder":
        return cls(
            order_id=str(raw["order_id"]),
            issuer_team=raw["issuer_team"],
            attacker_id=str(raw["attacker_id"]),
            target_id=str(raw["target_id"]),
        )

    def validate(self, theater: Theater) -> OrderOutcome:
        attacker = _find_unit(theater, self.attacker_id)
        target = _find_unit(theater, self.target_id)
        if attacker is None:
            return OrderOutcome(self.order_id, False, f"unknown attacker: {self.attacker_id}", self.kind)
        if target is None:
            return OrderOutcome(self.order_id, False, f"unknown target: {self.target_id}", self.kind)
        if not _faction_owns_unit(theater, attacker, self.issuer_team):
            return OrderOutcome(self.order_id, False, "attacker not on issuing team", self.kind)
        if attacker.faction_id == target.faction_id:
            return OrderOutcome(self.order_id, False, "cannot engage own faction", self.kind)
        if attacker.domain is UnitDomain.AIR:
            return OrderOutcome(
                self.order_id, False, "use 'air_sortie' for air engagement", self.kind,
            )
        rng_km = engagement_range_km(attacker)
        d = haversine_km(attacker.position, target.position)
        if d > rng_km * 1.05:
            return OrderOutcome(
                self.order_id, False,
                f"target {d:.1f} km outside engagement range {rng_km:.1f} km", self.kind,
            )
        if not is_target_detected(
            target.position, target.faction_id, attacker.faction_id,
            attacker.position, theater, self_detect_radius_km=rng_km,
        ):
            return OrderOutcome(
                self.order_id, False,
                "target not detected (need ISR coverage or close-in contact)", self.kind,
            )
        if attacker.strength < 0.10:
            return OrderOutcome(self.order_id, False, "attacker combat-ineffective", self.kind)
        return OrderOutcome(self.order_id, True, "ok", self.kind)

    def apply(self, theater: Theater, *, rng: BatchRng, ledger: PoliticalLedger) -> OrderOutcome:
        attacker = _find_unit(theater, self.attacker_id)
        target = _find_unit(theater, self.target_id)
        assert attacker is not None and target is not None
        sub = rng.stream(f"engage::{self.order_id}")
        isr_bonus = 1.0 if is_target_detected(
            target.position, target.faction_id, attacker.faction_id,
            None, theater, self_detect_radius_km=0.0,
        ) else 0.0
        result = resolve_engagement(
            attacker=attacker, defender=target,
            rng=sub, isr_bonus=isr_bonus, entrenchment=target.entrenchment,
        )
        _apply_engagement(theater, attacker, target, result)
        # Defender's country soaks a small political hit (war exhaustion).
        if target.country_id is not None:
            ledger.note_military_hit(target.country_id)
        return OrderOutcome(
            self.order_id, True, "engaged", self.kind, result.to_dict(),
        )


OrderRegistry.register(EngageOrder)


def _apply_engagement(theater: Theater, attacker: Unit, defender: Unit, r: EngagementResolution) -> None:
    attacker.strength = _clamp(attacker.strength - r.attacker_strength_loss)
    defender.strength = _clamp(defender.strength - r.defender_strength_loss)
    attacker.morale = _clamp(attacker.morale - r.attacker_morale_loss)
    defender.morale = _clamp(defender.morale - r.defender_morale_loss)
    attacker.readiness = _clamp(attacker.readiness * 0.92)
    defender.readiness = _clamp(defender.readiness * 0.92)
    defender.entrenchment = _clamp(defender.entrenchment * 0.5)
    if r.defender_retreated and r.retreat_destination is not None:
        defender.position = r.retreat_destination
        defender.entrenchment = 0.0


# ---------------------------------------------------------------------------
# Air rebase + sortie
# ---------------------------------------------------------------------------


class RebaseAirOrder(Order):
    """Move an air wing to a friendly airfield."""

    kind: ClassVar[str] = "rebase_air"
    phase: ClassVar[Phase] = Phase.MOVE
    label: ClassVar[str] = "Rebase air wing"
    description: ClassVar[str] = "Relocate an air wing to a friendly airfield (runway-gated)."

    MIN_RUNWAY_M: ClassVar[int] = 2000

    def __init__(
        self, *, order_id: str, issuer_team: PlayerTeam, unit_id: str, airfield_id: str,
    ) -> None:
        super().__init__(order_id=order_id, issuer_team=issuer_team)
        self.unit_id = unit_id
        self.airfield_id = airfield_id

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "RebaseAirOrder":
        return cls(
            order_id=str(raw["order_id"]), issuer_team=raw["issuer_team"],
            unit_id=str(raw["unit_id"]), airfield_id=str(raw["airfield_id"]),
        )

    def _airfield(self, theater: Theater) -> Airfield | None:
        for a in theater.airfields:
            if a.id == self.airfield_id:
                return a
        return None

    def validate(self, theater: Theater) -> OrderOutcome:
        unit = _find_unit(theater, self.unit_id)
        airfield = self._airfield(theater)
        if unit is None:
            return OrderOutcome(self.order_id, False, "unknown air wing", self.kind)
        if unit.domain is not UnitDomain.AIR:
            return OrderOutcome(self.order_id, False, "rebase requires an air unit", self.kind)
        if not _faction_owns_unit(theater, unit, self.issuer_team):
            return OrderOutcome(self.order_id, False, "unit not on issuing team", self.kind)
        if airfield is None:
            return OrderOutcome(self.order_id, False, f"unknown airfield: {self.airfield_id}", self.kind)
        if not _faction_owns_id(theater, airfield.faction_id, self.issuer_team):
            return OrderOutcome(self.order_id, False, "airfield not friendly", self.kind)
        if airfield.runway_m < self.MIN_RUNWAY_M:
            return OrderOutcome(
                self.order_id, False,
                f"runway {airfield.runway_m}m below minimum {self.MIN_RUNWAY_M}m", self.kind,
            )
        d = haversine_km(unit.position, airfield.position)
        if d > AIR_REBASE_RADIUS_KM * 1.01:
            return OrderOutcome(
                self.order_id, False,
                f"airfield {d:.0f} km exceeds rebase radius {AIR_REBASE_RADIUS_KM:.0f} km",
                self.kind,
            )
        return OrderOutcome(self.order_id, True, "ok", self.kind)

    def apply(self, theater: Theater, *, rng: BatchRng, ledger: PoliticalLedger) -> OrderOutcome:
        unit = _find_unit(theater, self.unit_id)
        airfield = self._airfield(theater)
        assert unit is not None and airfield is not None
        unit.position = airfield.position
        unit.home_base_id = airfield.id
        return OrderOutcome(
            self.order_id, True, "rebased", self.kind,
            {"unit_id": unit.id, "airfield_id": airfield.id,
             "destination": [airfield.position.lon, airfield.position.lat]},
        )


OrderRegistry.register(RebaseAirOrder)


SortieMission = Literal["strike", "sead"]


class AirSortieOrder(Order):
    """Air wing flies a one-shot mission against a target id."""

    kind: ClassVar[str] = "air_sortie"
    phase: ClassVar[Phase] = Phase.INTERDICT
    label: ClassVar[str] = "Air sortie"
    description: ClassVar[str] = "Strike or SEAD against a fixed target or detected unit."

    def __init__(
        self, *, order_id: str, issuer_team: PlayerTeam, unit_id: str,
        mission: SortieMission, target_kind: str, target_id: str,
    ) -> None:
        super().__init__(order_id=order_id, issuer_team=issuer_team)
        if mission not in ("strike", "sead"):
            raise ValueError(f"AirSortieOrder.mission must be strike|sead, got {mission!r}")
        self.unit_id = unit_id
        self.mission = mission
        self.target_kind = target_kind
        self.target_id = target_id

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "AirSortieOrder":
        return cls(
            order_id=str(raw["order_id"]), issuer_team=raw["issuer_team"],
            unit_id=str(raw["unit_id"]), mission=raw["mission"],
            target_kind=str(raw["target_kind"]), target_id=str(raw["target_id"]),
        )

    def validate(self, theater: Theater) -> OrderOutcome:
        unit = _find_unit(theater, self.unit_id)
        if unit is None:
            return OrderOutcome(self.order_id, False, "unknown air wing", self.kind)
        if unit.domain is not UnitDomain.AIR:
            return OrderOutcome(self.order_id, False, "sortie requires an air unit", self.kind)
        if not _faction_owns_unit(theater, unit, self.issuer_team):
            return OrderOutcome(self.order_id, False, "unit not on issuing team", self.kind)
        if unit.readiness < 0.20:
            return OrderOutcome(self.order_id, False, "air wing readiness too low", self.kind)
        target_pos, target_faction = _resolve_strike_target(theater, self.target_kind, self.target_id)
        if target_pos is None:
            return OrderOutcome(self.order_id, False, f"unknown target {self.target_kind}/{self.target_id}", self.kind)
        if target_faction == unit.faction_id:
            return OrderOutcome(self.order_id, False, "cannot strike friendly target", self.kind)
        d = haversine_km(unit.position, target_pos)
        if d > AIR_SORTIE_RADIUS_KM * 1.02:
            return OrderOutcome(
                self.order_id, False,
                f"target {d:.0f} km outside sortie radius {AIR_SORTIE_RADIUS_KM:.0f} km",
                self.kind,
            )
        if self.mission == "sead":
            sam = next((m for m in theater.missile_ranges if m.id == self.target_id), None)
            if sam is None or sam.category != "sam":
                return OrderOutcome(self.order_id, False, "SEAD target must be a SAM missile_range", self.kind)
        if not is_target_detected(
            target_pos, target_faction or unit.faction_id, unit.faction_id,
            unit.position, theater, self_detect_radius_km=AIR_SORTIE_RADIUS_KM,
        ):
            # Sorties can self-detect across their own search radius (large).
            return OrderOutcome(self.order_id, False, "target not detected", self.kind)
        return OrderOutcome(self.order_id, True, "ok", self.kind)

    def apply(self, theater: Theater, *, rng: BatchRng, ledger: PoliticalLedger) -> OrderOutcome:
        unit = _find_unit(theater, self.unit_id)
        assert unit is not None
        target_pos, _ = _resolve_strike_target(theater, self.target_kind, self.target_id)
        assert target_pos is not None
        sub = rng.stream(f"sortie::{self.order_id}")
        accuracy = 0.55 + 0.35 * unit.readiness
        sam_p = 0.50 if self.mission != "sead" else 0.0
        kind = "air_sead" if self.mission == "sead" else "air_strike"
        result = resolve_strike(
            kind=kind, target_id=self.target_id, target_position=target_pos,
            attacker_faction_id=unit.faction_id,
            accuracy=accuracy, base_damage=0.30, sam_intercept_chance=sam_p,
            rng=sub, theater=theater, sortie_attrition_base=0.02,
        )
        _apply_strike_to_target(theater, self.target_kind, self.target_id, result, ledger)
        unit.strength = _clamp(unit.strength - result.attacker_loss)
        unit.readiness = _clamp(unit.readiness * 0.85)
        return OrderOutcome(self.order_id, True, "sortie complete", self.kind, result.to_dict())


OrderRegistry.register(AirSortieOrder)


# ---------------------------------------------------------------------------
# Naval move + naval strike
# ---------------------------------------------------------------------------


class NavalMoveOrder(Order):
    """Reposition a naval task group within the naval move radius."""

    kind: ClassVar[str] = "naval_move"
    phase: ClassVar[Phase] = Phase.MOVE
    label: ClassVar[str] = "Naval move"
    description: ClassVar[str] = "Reposition a naval task group."

    def __init__(
        self, *, order_id: str, issuer_team: PlayerTeam, unit_id: str, destination: Coordinate,
    ) -> None:
        super().__init__(order_id=order_id, issuer_team=issuer_team)
        self.unit_id = unit_id
        self.destination = destination

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "NavalMoveOrder":
        return cls(
            order_id=str(raw["order_id"]), issuer_team=raw["issuer_team"],
            unit_id=str(raw["unit_id"]),
            destination=_coord_from_payload(raw["destination"], label="NavalMoveOrder.destination"),
        )

    def validate(self, theater: Theater) -> OrderOutcome:
        unit = _find_unit(theater, self.unit_id)
        if unit is None:
            return OrderOutcome(self.order_id, False, "unknown naval unit", self.kind)
        if unit.domain is not UnitDomain.NAVAL:
            return OrderOutcome(self.order_id, False, "naval move requires a naval unit", self.kind)
        if not _faction_owns_unit(theater, unit, self.issuer_team):
            return OrderOutcome(self.order_id, False, "unit not on issuing team", self.kind)
        d = haversine_km(unit.position, self.destination)
        if d > NAVAL_MOVE_RADIUS_KM * 1.02:
            return OrderOutcome(
                self.order_id, False,
                f"destination {d:.0f} km exceeds naval move radius {NAVAL_MOVE_RADIUS_KM:.0f} km",
                self.kind,
            )
        return OrderOutcome(self.order_id, True, "ok", self.kind)

    def apply(self, theater: Theater, *, rng: BatchRng, ledger: PoliticalLedger) -> OrderOutcome:
        unit = _find_unit(theater, self.unit_id)
        assert unit is not None
        unit.position = self.destination
        return OrderOutcome(
            self.order_id, True, "moved", self.kind,
            {"unit_id": unit.id, "destination": [self.destination.lon, self.destination.lat]},
        )


OrderRegistry.register(NavalMoveOrder)


class NavalStrikeOrder(Order):
    """Naval task group launches a strike against a fixed asset or coastal unit."""

    kind: ClassVar[str] = "naval_strike"
    phase: ClassVar[Phase] = Phase.INTERDICT
    label: ClassVar[str] = "Naval strike"
    description: ClassVar[str] = "VLS / cruise launch from a naval task group."

    def __init__(
        self, *, order_id: str, issuer_team: PlayerTeam, unit_id: str,
        target_kind: str, target_id: str,
    ) -> None:
        super().__init__(order_id=order_id, issuer_team=issuer_team)
        self.unit_id = unit_id
        self.target_kind = target_kind
        self.target_id = target_id

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "NavalStrikeOrder":
        return cls(
            order_id=str(raw["order_id"]), issuer_team=raw["issuer_team"],
            unit_id=str(raw["unit_id"]),
            target_kind=str(raw["target_kind"]), target_id=str(raw["target_id"]),
        )

    def validate(self, theater: Theater) -> OrderOutcome:
        unit = _find_unit(theater, self.unit_id)
        if unit is None:
            return OrderOutcome(self.order_id, False, "unknown naval unit", self.kind)
        if unit.domain is not UnitDomain.NAVAL:
            return OrderOutcome(self.order_id, False, "naval strike requires a naval unit", self.kind)
        if not _faction_owns_unit(theater, unit, self.issuer_team):
            return OrderOutcome(self.order_id, False, "unit not on issuing team", self.kind)
        target_pos, target_faction = _resolve_strike_target(theater, self.target_kind, self.target_id)
        if target_pos is None:
            return OrderOutcome(self.order_id, False, "unknown target", self.kind)
        if target_faction == unit.faction_id:
            return OrderOutcome(self.order_id, False, "cannot strike friendly target", self.kind)
        d = haversine_km(unit.position, target_pos)
        rng_km = engagement_range_km(unit)
        if d > rng_km * 1.05:
            return OrderOutcome(
                self.order_id, False,
                f"target {d:.0f} km exceeds naval strike radius {rng_km:.0f} km",
                self.kind,
            )
        if not is_target_detected(
            target_pos, target_faction or unit.faction_id, unit.faction_id,
            unit.position, theater, self_detect_radius_km=rng_km,
        ):
            return OrderOutcome(self.order_id, False, "target not detected", self.kind)
        return OrderOutcome(self.order_id, True, "ok", self.kind)

    def apply(self, theater: Theater, *, rng: BatchRng, ledger: PoliticalLedger) -> OrderOutcome:
        unit = _find_unit(theater, self.unit_id)
        assert unit is not None
        target_pos, _ = _resolve_strike_target(theater, self.target_kind, self.target_id)
        assert target_pos is not None
        sub = rng.stream(f"naval::{self.order_id}")
        accuracy = 0.60 + 0.30 * unit.readiness
        result = resolve_strike(
            kind="naval_strike", target_id=self.target_id, target_position=target_pos,
            attacker_faction_id=unit.faction_id,
            accuracy=accuracy, base_damage=0.35, sam_intercept_chance=0.40,
            rng=sub, theater=theater, sortie_attrition_base=0.0,
        )
        _apply_strike_to_target(theater, self.target_kind, self.target_id, result, ledger)
        unit.readiness = _clamp(unit.readiness * 0.92)
        return OrderOutcome(self.order_id, True, "strike complete", self.kind, result.to_dict())


OrderRegistry.register(NavalStrikeOrder)


# ---------------------------------------------------------------------------
# Missile strike (from a MissileRange platform)
# ---------------------------------------------------------------------------


class MissileStrikeOrder(Order):
    """Cruise / ballistic / MLRS launch from a friendly MissileRange platform."""

    kind: ClassVar[str] = "missile_strike"
    phase: ClassVar[Phase] = Phase.INTERDICT
    label: ClassVar[str] = "Missile strike"
    description: ClassVar[str] = "Stand-off launch against a fixed asset or detected unit."

    def __init__(
        self, *, order_id: str, issuer_team: PlayerTeam, platform_id: str,
        target_kind: str, target_id: str,
    ) -> None:
        super().__init__(order_id=order_id, issuer_team=issuer_team)
        self.platform_id = platform_id
        self.target_kind = target_kind
        self.target_id = target_id

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "MissileStrikeOrder":
        return cls(
            order_id=str(raw["order_id"]), issuer_team=raw["issuer_team"],
            platform_id=str(raw["platform_id"]),
            target_kind=str(raw["target_kind"]), target_id=str(raw["target_id"]),
        )

    def _platform(self, theater: Theater) -> MissileRange | None:
        for m in theater.missile_ranges:
            if m.id == self.platform_id:
                return m
        return None

    def validate(self, theater: Theater) -> OrderOutcome:
        platform = self._platform(theater)
        if platform is None:
            return OrderOutcome(self.order_id, False, "unknown missile platform", self.kind)
        if platform.category == "sam":
            return OrderOutcome(self.order_id, False, "SAM platforms are defensive only", self.kind)
        if not _faction_owns_id(theater, platform.faction_id, self.issuer_team):
            return OrderOutcome(self.order_id, False, "platform not on issuing team", self.kind)
        target_pos, target_faction = _resolve_strike_target(theater, self.target_kind, self.target_id)
        if target_pos is None:
            return OrderOutcome(self.order_id, False, "unknown target", self.kind)
        if target_faction == platform.faction_id:
            return OrderOutcome(self.order_id, False, "cannot strike friendly target", self.kind)
        d = haversine_km(platform.origin, target_pos)
        if d > platform.range_km * 1.02:
            return OrderOutcome(
                self.order_id, False,
                f"target {d:.0f} km exceeds {platform.weapon} range {platform.range_km:.0f} km",
                self.kind,
            )
        return OrderOutcome(self.order_id, True, "ok", self.kind)

    def apply(self, theater: Theater, *, rng: BatchRng, ledger: PoliticalLedger) -> OrderOutcome:
        platform = self._platform(theater)
        assert platform is not None
        target_pos, _ = _resolve_strike_target(theater, self.target_kind, self.target_id)
        assert target_pos is not None
        sub = rng.stream(f"missile::{self.order_id}")
        # Cruise/MLRS more accurate than ballistic; tweak by category.
        accuracy = {"cruise": 0.78, "ballistic": 0.62, "mlrs": 0.55}.get(platform.category, 0.65)
        sam_p = 0.55 if platform.category in ("cruise", "mlrs") else 0.30
        result = resolve_strike(
            kind="missile", target_id=self.target_id, target_position=target_pos,
            attacker_faction_id=platform.faction_id,
            accuracy=accuracy, base_damage=0.40, sam_intercept_chance=sam_p,
            rng=sub, theater=theater,
        )
        _apply_strike_to_target(theater, self.target_kind, self.target_id, result, ledger)
        return OrderOutcome(self.order_id, True, "missile launched", self.kind, result.to_dict())


OrderRegistry.register(MissileStrikeOrder)


# ---------------------------------------------------------------------------
# Resupply + interdict supply
# ---------------------------------------------------------------------------


class ResupplyOrder(Order):
    """Push from a depot to a friendly unit along an existing supply line.

    Raises the unit's readiness, drains depot fill. Throughput is gated by
    the supply line's health and by the depot's capacity.
    """

    kind: ClassVar[str] = "resupply"
    phase: ClassVar[Phase] = Phase.RESUPPLY
    label: ClassVar[str] = "Resupply"
    description: ClassVar[str] = "Depot pushes ammo/POL to a friendly unit; raises readiness."

    def __init__(
        self, *, order_id: str, issuer_team: PlayerTeam,
        depot_id: str, unit_id: str,
    ) -> None:
        super().__init__(order_id=order_id, issuer_team=issuer_team)
        self.depot_id = depot_id
        self.unit_id = unit_id

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "ResupplyOrder":
        return cls(
            order_id=str(raw["order_id"]), issuer_team=raw["issuer_team"],
            depot_id=str(raw["depot_id"]), unit_id=str(raw["unit_id"]),
        )

    def _depot(self, theater: Theater) -> Depot | None:
        for d in theater.depots:
            if d.id == self.depot_id:
                return d
        return None

    def _supply_line(self, theater: Theater, depot: Depot, unit: Unit) -> SupplyLine | None:
        # Prefer an explicit edge; otherwise allow any healthy line whose
        # endpoints are near both the depot and the unit (loose proxy).
        for s in theater.supply_lines:
            if s.faction_id != depot.faction_id:
                continue
            if s.from_id == depot.id or s.to_id == depot.id:
                return s
        # fallback: nearest line endpoint within 80km of both
        for s in theater.supply_lines:
            if s.faction_id != depot.faction_id:
                continue
            if not s.path:
                continue
            near_depot = haversine_km(s.path[0], depot.position) < 80 or haversine_km(s.path[-1], depot.position) < 80
            near_unit = haversine_km(s.path[0], unit.position) < 80 or haversine_km(s.path[-1], unit.position) < 80
            if near_depot and near_unit:
                return s
        return None

    def validate(self, theater: Theater) -> OrderOutcome:
        depot = self._depot(theater)
        unit = _find_unit(theater, self.unit_id)
        if depot is None:
            return OrderOutcome(self.order_id, False, "unknown depot", self.kind)
        if unit is None:
            return OrderOutcome(self.order_id, False, "unknown unit", self.kind)
        if not _faction_owns_id(theater, depot.faction_id, self.issuer_team):
            return OrderOutcome(self.order_id, False, "depot not on issuing team", self.kind)
        if not _faction_owns_unit(theater, unit, self.issuer_team):
            return OrderOutcome(self.order_id, False, "unit not on issuing team", self.kind)
        if depot.fill < 0.05:
            return OrderOutcome(self.order_id, False, "depot empty", self.kind)
        if unit.readiness >= 0.99:
            return OrderOutcome(self.order_id, False, "unit already at full readiness", self.kind)
        line = self._supply_line(theater, depot, unit)
        if line is None:
            return OrderOutcome(self.order_id, False, "no supply line links depot and unit", self.kind)
        if line.health < 0.10:
            return OrderOutcome(self.order_id, False, f"supply line {line.id} severed", self.kind)
        return OrderOutcome(self.order_id, True, "ok", self.kind)

    def apply(self, theater: Theater, *, rng: BatchRng, ledger: PoliticalLedger) -> OrderOutcome:
        depot = self._depot(theater)
        unit = _find_unit(theater, self.unit_id)
        assert depot is not None and unit is not None
        line = self._supply_line(theater, depot, unit)
        assert line is not None
        throughput = min(depot.fill, 0.30) * line.health
        unit.readiness = _clamp(unit.readiness + 0.6 * throughput)
        unit.morale = _clamp(unit.morale + 0.2 * throughput)
        new_depot = dataclasses.replace(depot, fill=_clamp(depot.fill - throughput))
        _replace_in_list(theater.depots, new_depot)
        return OrderOutcome(
            self.order_id, True, "resupplied", self.kind,
            {"unit_id": unit.id, "depot_id": depot.id, "supply_line_id": line.id,
             "throughput": round(throughput, 3),
             "unit_readiness_after": round(unit.readiness, 3),
             "depot_fill_after": round(new_depot.fill, 3)},
        )


OrderRegistry.register(ResupplyOrder)


class InterdictSupplyOrder(Order):
    """Strike a supply line, degrading its health.

    Launched from an air wing or a missile platform. The two sources have
    different accuracy/damage profiles and SAM exposure.
    """

    kind: ClassVar[str] = "interdict_supply"
    phase: ClassVar[Phase] = Phase.INTERDICT
    label: ClassVar[str] = "Interdict supply"
    description: ClassVar[str] = "Strike a supply line to degrade enemy throughput."

    def __init__(
        self, *, order_id: str, issuer_team: PlayerTeam,
        platform_kind: Literal["air_wing", "missile_range"], platform_id: str,
        supply_line_id: str,
    ) -> None:
        super().__init__(order_id=order_id, issuer_team=issuer_team)
        if platform_kind not in ("air_wing", "missile_range"):
            raise ValueError(f"InterdictSupply.platform_kind unknown: {platform_kind!r}")
        self.platform_kind = platform_kind
        self.platform_id = platform_id
        self.supply_line_id = supply_line_id

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "InterdictSupplyOrder":
        return cls(
            order_id=str(raw["order_id"]), issuer_team=raw["issuer_team"],
            platform_kind=raw["platform_kind"],
            platform_id=str(raw["platform_id"]),
            supply_line_id=str(raw["supply_line_id"]),
        )

    def _line(self, theater: Theater) -> SupplyLine | None:
        for s in theater.supply_lines:
            if s.id == self.supply_line_id:
                return s
        return None

    def _midpoint(self, line: SupplyLine) -> Coordinate:
        n = len(line.path)
        if n == 0:
            raise ValueError("supply line has no path")
        if n % 2 == 1:
            return line.path[n // 2]
        a = line.path[n // 2 - 1]
        b = line.path[n // 2]
        return Coordinate(lon=(a.lon + b.lon) / 2.0, lat=(a.lat + b.lat) / 2.0)

    def _platform_lookup(self, theater: Theater) -> tuple[Coordinate, str, float] | None:
        """Return (origin, faction_id, max_range_km) for the chosen platform."""
        if self.platform_kind == "air_wing":
            unit = _find_unit(theater, self.platform_id)
            if unit is None or unit.domain is not UnitDomain.AIR:
                return None
            return unit.position, unit.faction_id, AIR_SORTIE_RADIUS_KM
        for m in theater.missile_ranges:
            if m.id == self.platform_id and m.category != "sam":
                return m.origin, m.faction_id, m.range_km
        return None

    def validate(self, theater: Theater) -> OrderOutcome:
        plat = self._platform_lookup(theater)
        if plat is None:
            return OrderOutcome(self.order_id, False, "unknown / invalid platform", self.kind)
        origin, faction_id, max_range = plat
        if not _faction_owns_id(theater, faction_id, self.issuer_team):
            return OrderOutcome(self.order_id, False, "platform not on issuing team", self.kind)
        line = self._line(theater)
        if line is None:
            return OrderOutcome(self.order_id, False, "unknown supply line", self.kind)
        if line.faction_id == faction_id:
            return OrderOutcome(self.order_id, False, "cannot interdict friendly supply", self.kind)
        if line.health <= 0.05:
            return OrderOutcome(self.order_id, False, "supply line already severed", self.kind)
        target = self._midpoint(line)
        d = haversine_km(origin, target)
        if d > max_range * 1.02:
            return OrderOutcome(
                self.order_id, False,
                f"target {d:.0f} km exceeds platform range {max_range:.0f} km", self.kind,
            )
        return OrderOutcome(self.order_id, True, "ok", self.kind)

    def apply(self, theater: Theater, *, rng: BatchRng, ledger: PoliticalLedger) -> OrderOutcome:
        line = self._line(theater)
        plat = self._platform_lookup(theater)
        assert line is not None and plat is not None
        _, faction_id, _ = plat
        target = self._midpoint(line)
        sub = rng.stream(f"interdict::{self.order_id}")
        if self.platform_kind == "air_wing":
            unit = _find_unit(theater, self.platform_id)
            assert unit is not None
            accuracy = 0.55 + 0.3 * unit.readiness
            result = resolve_strike(
                kind="interdict", target_id=line.id, target_position=target,
                attacker_faction_id=faction_id,
                accuracy=accuracy, base_damage=0.25, sam_intercept_chance=0.45,
                rng=sub, theater=theater, sortie_attrition_base=0.02,
            )
            unit.strength = _clamp(unit.strength - result.attacker_loss)
            unit.readiness = _clamp(unit.readiness * 0.85)
        else:
            result = resolve_strike(
                kind="interdict", target_id=line.id, target_position=target,
                attacker_faction_id=faction_id,
                accuracy=0.70, base_damage=0.30, sam_intercept_chance=0.30,
                rng=sub, theater=theater,
            )
        if result.hit:
            new_line = dataclasses.replace(
                line, health=_clamp(line.health - result.damage),
            )
            _replace_in_list(theater.supply_lines, new_line)
        return OrderOutcome(self.order_id, True, "interdiction resolved", self.kind, result.to_dict())


OrderRegistry.register(InterdictSupplyOrder)


# ---------------------------------------------------------------------------
# Strike target resolution + application
# ---------------------------------------------------------------------------


def _resolve_strike_target(
    theater: Theater, target_kind: str, target_id: str,
) -> tuple[Coordinate | None, str | None]:
    """Return (position, owning_faction_id) for a strike target by kind+id.

    Recognised target kinds: 'unit', 'depot', 'airfield', 'naval_base',
    'missile_range', 'supply_line', 'city'.
    """
    if target_kind == "unit":
        u = _find_unit(theater, target_id)
        return (u.position, u.faction_id) if u else (None, None)
    if target_kind == "depot":
        for d in theater.depots:
            if d.id == target_id:
                return d.position, d.faction_id
    if target_kind == "airfield":
        for a in theater.airfields:
            if a.id == target_id:
                return a.position, a.faction_id
    if target_kind == "naval_base":
        for n in theater.naval_bases:
            if n.id == target_id:
                return n.position, n.faction_id
    if target_kind == "missile_range":
        for m in theater.missile_ranges:
            if m.id == target_id:
                return m.origin, m.faction_id
    if target_kind == "city":
        for c in theater.cities:
            if c.id == target_id:
                return c.position, c.faction_id
    return None, None


def _apply_strike_to_target(
    theater: Theater, target_kind: str, target_id: str,
    result: StrikeResolution, ledger: PoliticalLedger,
) -> None:
    """Fold a successful strike into the target entity + political ledger."""
    if not result.hit:
        return
    if target_kind == "unit":
        u = _find_unit(theater, target_id)
        if u is None:
            return
        u.strength = _clamp(u.strength - result.damage)
        u.morale = _clamp(u.morale - 0.5 * result.damage)
        if u.country_id is not None:
            ledger.note_military_hit(u.country_id)
        return
    if target_kind == "depot":
        for i, d in enumerate(theater.depots):
            if d.id == target_id:
                theater.depots[i] = dataclasses.replace(
                    d, fill=_clamp(d.fill - 0.6 * result.damage),
                    capacity=_clamp(d.capacity - 0.3 * result.damage),
                )
                if d.country_id is not None:
                    ledger.note_infra_hit(d.country_id)
                return
    if target_kind == "airfield":
        for i, a in enumerate(theater.airfields):
            if a.id == target_id:
                # Damage scales aircraft basing capacity (proxy via runway).
                new_runway = max(0, int(a.runway_m - 600 * result.damage))
                theater.airfields[i] = dataclasses.replace(a, runway_m=new_runway)
                if a.country_id is not None:
                    ledger.note_infra_hit(a.country_id)
                return
    if target_kind == "naval_base":
        for i, n in enumerate(theater.naval_bases):
            if n.id == target_id:
                theater.naval_bases[i] = dataclasses.replace(
                    n, pier_count=max(0, int(n.pier_count - round(result.damage * 2))),
                )
                if n.country_id is not None:
                    ledger.note_infra_hit(n.country_id)
                return
    if target_kind == "missile_range":
        for i, m in enumerate(theater.missile_ranges):
            if m.id == target_id:
                # SEAD / strike on a missile platform shrinks its envelope.
                theater.missile_ranges[i] = dataclasses.replace(
                    m, range_km=max(1.0, m.range_km * (1.0 - result.damage)),
                )
                if m.country_id is not None:
                    ledger.note_military_hit(m.country_id)
                return
    if target_kind == "city":
        for c in theater.cities:
            if c.id == target_id:
                if c.country_id is not None:
                    oblast = _oblast_for_position(theater, c.country_id, c.position)
                    ledger.note_city_hit(c.country_id, oblast.id if oblast else None)
                return


# ---------------------------------------------------------------------------
# Political rollout: drain ledger -> country dimension deltas
# ---------------------------------------------------------------------------


# Unit deltas per single hit. These are intentionally small so multiple hits
# in one batch compound but a single strike is not catastrophic.
_PER_CITY_HIT = {
    "defender_war_support": -0.04,
    "defender_protest": +0.07,
    "defender_unrest": +0.06,  # applied to oblast.civil_unrest
    "defender_morale_oblast": -0.05,
    "attacker_war_support": -0.015,  # international pressure on the aggressor
    "attacker_protest": +0.02,
}
_PER_INFRA_HIT = {
    "defender_war_support": -0.015,
    "defender_protest": +0.02,
    "attacker_war_support": -0.005,
}
_PER_MIL_HIT = {
    "defender_war_support": -0.01,  # defender public sees casualties
    "attacker_war_support": +0.005,  # short-term rally for the aggressor
}


def _apply_political_rollup(theater: Theater, ledger: PoliticalLedger,
                            attacker_country_ids_by_team: dict[str, set[str]]) -> dict[str, dict[str, float]]:
    """Mutate countries / oblasts using accumulated ledger.

    Returns a flat per-country summary of changes for the FE.
    """
    summary: dict[str, dict[str, float]] = {}

    def bump(country_id: str, key: str, delta: float) -> None:
        d = summary.setdefault(country_id, {})
        d[key] = d.get(key, 0.0) + delta

    # City & infrastructure hits = defender + attacker political fallout.
    def apply_defender(country_id: str, ws_d: float, prot_d: float) -> None:
        country = next((c for c in theater.countries if c.id == country_id), None)
        if country is None:
            return
        op = country.public_opinion
        new_op = dataclasses.replace(
            op,
            war_support=_clamp(op.war_support + ws_d),
            protest_intensity=_clamp(op.protest_intensity + prot_d),
        )
        _replace_country(theater, dataclasses.replace(country, public_opinion=new_op))
        bump(country_id, "war_support", new_op.war_support - op.war_support)
        bump(country_id, "protest_intensity", new_op.protest_intensity - op.protest_intensity)

    def apply_attacker_pressure(team_attacker_ids: set[str], ws_d: float, prot_d: float = 0.0) -> None:
        for cid in team_attacker_ids:
            country = next((c for c in theater.countries if c.id == cid), None)
            if country is None:
                continue
            op = country.public_opinion
            new_op = dataclasses.replace(
                op,
                war_support=_clamp(op.war_support + ws_d),
                protest_intensity=_clamp(op.protest_intensity + prot_d),
            )
            _replace_country(theater, dataclasses.replace(country, public_opinion=new_op))
            bump(cid, "war_support", new_op.war_support - op.war_support)
            if prot_d != 0.0:
                bump(cid, "protest_intensity", new_op.protest_intensity - op.protest_intensity)

    # Resolve which team attacked which defender to know who soaks "attacker"
    # pressure deltas. Heuristic: any country whose faction allegiance equals
    # the attacking team. We track per defender to keep it simple.
    def attackers_against(defender_country_id: str) -> set[str]:
        defender = next((c for c in theater.countries if c.id == defender_country_id), None)
        if defender is None:
            return set()
        defender_faction = next((f for f in theater.factions if f.id == defender.faction_id), None)
        if defender_faction is None:
            return set()
        return attacker_country_ids_by_team.get(_OPP_TEAM[defender_faction.allegiance], set())

    for cid, count in ledger.civilian_strikes.items():
        apply_defender(
            cid,
            _PER_CITY_HIT["defender_war_support"] * count,
            _PER_CITY_HIT["defender_protest"] * count,
        )
        apply_attacker_pressure(
            attackers_against(cid),
            _PER_CITY_HIT["attacker_war_support"] * count,
            _PER_CITY_HIT["attacker_protest"] * count,
        )
    for cid, count in ledger.infrastructure_hits.items():
        apply_defender(
            cid,
            _PER_INFRA_HIT["defender_war_support"] * count,
            _PER_INFRA_HIT["defender_protest"] * count,
        )
        apply_attacker_pressure(
            attackers_against(cid),
            _PER_INFRA_HIT["attacker_war_support"] * count,
        )
    for cid, count in ledger.military_strikes.items():
        apply_defender(cid, _PER_MIL_HIT["defender_war_support"] * count, 0.0)
        apply_attacker_pressure(
            attackers_against(cid),
            _PER_MIL_HIT["attacker_war_support"] * count,
        )

    # Oblast-level effects from city hits.
    for oblast_id, count in ledger.oblast_struck.items():
        oblast = next((o for o in theater.oblasts if o.id == oblast_id), None)
        if oblast is None:
            continue
        new_oblast = dataclasses.replace(
            oblast,
            civil_unrest=_clamp(oblast.civil_unrest + _PER_CITY_HIT["defender_unrest"] * count),
            morale=_clamp(oblast.morale + _PER_CITY_HIT["defender_morale_oblast"] * count),
            refugees_outflow=oblast.refugees_outflow + 5000 * count,
        )
        _replace_oblast(theater, new_oblast)
        bump(oblast.country_id, "oblast_civil_unrest_max",
             max(summary.get(oblast.country_id, {}).get("oblast_civil_unrest_max", 0.0),
                 new_oblast.civil_unrest - oblast.civil_unrest))

    return summary


_OPP_TEAM: dict[Allegiance, PlayerTeam] = {
    Allegiance.RED: "blue",
    Allegiance.BLUE: "red",
    Allegiance.NEUTRAL: "blue",
}


# ---------------------------------------------------------------------------
# Batch
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class OrderBatch:
    """A list of orders submitted together for a single team."""

    issuer_team: PlayerTeam
    orders: list[Order]

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "OrderBatch":
        team = raw.get("issuer_team")
        if team not in ("red", "blue"):
            raise ValueError(f"issuer_team must be 'red' or 'blue', got {team!r}")
        raw_orders = raw.get("orders", [])
        if not isinstance(raw_orders, list):
            raise ValueError("OrderBatch.orders must be a list")
        orders: list[Order] = []
        for o in raw_orders:
            if not isinstance(o, dict):
                raise ValueError("each order must be an object")
            payload = dict(o)
            payload.setdefault("issuer_team", team)
            if payload["issuer_team"] != team:
                raise ValueError(
                    f"order {payload.get('order_id')!r} issuer_team "
                    f"{payload['issuer_team']!r} differs from batch {team!r}"
                )
            orders.append(OrderRegistry.decode(payload))
        return cls(issuer_team=team, orders=orders)

    def execute(self, theater: Theater) -> ExecutionResult:
        """Validate-all then apply-by-phase if every order is valid.

        Returns the per-order outcomes plus a per-country political summary.
        """
        outcomes = [order.validate(theater) for order in self.orders]
        if not all(o.ok for o in outcomes):
            return ExecutionResult(ok=False, outcomes=outcomes)

        # Validate uniqueness: at most one combat-affecting order per unit per
        # batch (move + engage same-batch is intentionally rejected to keep
        # validation pre-batch-state correct).
        unit_orders: dict[str, list[Order]] = {}
        for order in self.orders:
            unit_id = getattr(order, "unit_id", None) or getattr(order, "attacker_id", None)
            if unit_id:
                unit_orders.setdefault(unit_id, []).append(order)
        for uid, ords in unit_orders.items():
            if len(ords) > 1:
                msg = f"unit {uid} has {len(ords)} orders this batch (max 1)"
                for o, oc in zip(self.orders, outcomes):
                    if getattr(o, "unit_id", None) == uid or getattr(o, "attacker_id", None) == uid:
                        oc.ok = False
                        oc.message = msg
                return ExecutionResult(ok=False, outcomes=outcomes)

        rng = BatchRng.for_batch([o.order_id for o in self.orders])
        ledger = PoliticalLedger()

        applied: list[OrderOutcome] = []
        ordered = sorted(enumerate(self.orders), key=lambda kv: (kv[1].phase, kv[0]))
        for original_idx, order in ordered:
            new_outcome = order.apply(theater, rng=rng, ledger=ledger)
            outcomes[original_idx] = new_outcome
            applied.append(new_outcome)

        attacker_ids_by_team = _attacker_country_ids_by_team(theater)
        political_summary = _apply_political_rollup(theater, ledger, attacker_ids_by_team)

        return ExecutionResult(ok=True, outcomes=outcomes, political_summary=political_summary)


def _attacker_country_ids_by_team(theater: Theater) -> dict[str, set[str]]:
    by_team: dict[str, set[str]] = {"red": set(), "blue": set()}
    for c in theater.countries:
        f = next((f for f in theater.factions if f.id == c.faction_id), None)
        if f is None:
            continue
        if f.allegiance is Allegiance.RED:
            by_team["red"].add(c.id)
        elif f.allegiance is Allegiance.BLUE:
            by_team["blue"].add(c.id)
    return by_team


@dataclass(slots=True)
class RoundExecutionResult:
    """Aggregate outcome of a hot-seat round: per-team outcomes + shared rollup."""

    ok: bool
    outcomes_by_team: dict[str, list[OrderOutcome]] = field(default_factory=dict)
    political_summary: dict[str, dict[str, float]] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "outcomes_by_team": {
                team: [o.to_dict() for o in outs]
                for team, outs in self.outcomes_by_team.items()
            },
            "political_summary": {
                k: {kk: round(vv, 3) for kk, vv in v.items()}
                for k, v in self.political_summary.items()
            },
        }


def execute_round(theater: Theater, batches: list[OrderBatch]) -> RoundExecutionResult:
    """Execute multiple per-team batches as one phased round.

    Each batch is validated independently (so a team only sees its own owner
    errors). If *any* batch is invalid the whole round is rejected without
    mutating the theatre. Otherwise the union of orders is applied in one
    phased pass with a single shared `BatchRng`, so kinetic results account
    for both teams' moves before strikes resolve.
    """
    if not batches:
        return RoundExecutionResult(ok=True, outcomes_by_team={}, political_summary={})

    teams_seen: set[str] = set()
    outcomes_by_team: dict[str, list[OrderOutcome]] = {}
    all_outcomes: list[tuple[str, int, OrderOutcome]] = []
    all_orders: list[tuple[str, int, Order]] = []
    overall_ok = True

    for batch in batches:
        if batch.issuer_team in teams_seen:
            raise ValueError(f"team {batch.issuer_team!r} appears in multiple batches")
        teams_seen.add(batch.issuer_team)

        outcomes = [order.validate(theater) for order in batch.orders]

        unit_orders: dict[str, list[int]] = {}
        for idx, order in enumerate(batch.orders):
            unit_id = getattr(order, "unit_id", None) or getattr(order, "attacker_id", None)
            if unit_id:
                unit_orders.setdefault(unit_id, []).append(idx)
        for uid, idxs in unit_orders.items():
            if len(idxs) > 1:
                msg = f"unit {uid} has {len(idxs)} orders this batch (max 1)"
                for i in idxs:
                    outcomes[i].ok = False
                    outcomes[i].message = msg

        outcomes_by_team[batch.issuer_team] = outcomes
        if not all(o.ok for o in outcomes):
            overall_ok = False

        for idx, (order, outcome) in enumerate(zip(batch.orders, outcomes)):
            all_outcomes.append((batch.issuer_team, idx, outcome))
            all_orders.append((batch.issuer_team, idx, order))

    if not overall_ok:
        return RoundExecutionResult(ok=False, outcomes_by_team=outcomes_by_team)

    seed_ids = sorted(o.order_id for _, _, o in all_orders)
    rng = BatchRng.for_batch(seed_ids)
    ledger = PoliticalLedger()

    ordered = sorted(
        enumerate(all_orders),
        key=lambda kv: (kv[1][2].phase, kv[1][0], kv[1][1]),
    )
    for _, (team, idx, order) in ordered:
        new_outcome = order.apply(theater, rng=rng, ledger=ledger)
        outcomes_by_team[team][idx] = new_outcome

    attacker_ids_by_team = _attacker_country_ids_by_team(theater)
    political_summary = _apply_political_rollup(theater, ledger, attacker_ids_by_team)

    return RoundExecutionResult(
        ok=True,
        outcomes_by_team=outcomes_by_team,
        political_summary=political_summary,
    )
