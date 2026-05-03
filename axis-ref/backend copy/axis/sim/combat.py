"""Combat resolution + detection helpers for the order pipeline.

Design points
-------------
- Stochastic, but seeded per-batch so a single Execute call is reproducible
  given the order ids submitted. The FE can replay an outcome offline by
  hashing the same ordered list of order_ids.
- All combat outputs are pure values (`EngagementResolution`, `StrikeResolution`)
  the order's `apply()` then folds back into the theatre. This keeps the math
  unit-testable without a Theater dependency.
- Engagement range and detection are consulted at *validate* time so illegal
  orders are rejected early. Combat math runs at *apply* time.

Combat model (intentionally simple, demo-grade)
-----------------------------------------------
For an attacker A engaging a defender D:

    f_x   = strength * readiness * morale * weapon_factor(kind)
    R     = (f_a * isr_bonus_a) / (f_d * (1 + entrenchment_d * 0.6))
    base  = 0.18                              # share of strength at parity
    dmg_d = clip(base * sqrt(R)   * (1 + N(0, 0.20)), 0.02, 0.85)
    dmg_a = clip(base / sqrt(R)   * (1 + N(0, 0.20)), 0.01, 0.60)

Morale takes a proportional hit on top of strength. Defender retreats if
their post-engagement strength drops below 0.20 or they lost more than
0.40 of strength outright.

Strike resolution (air sortie / missile / naval) uses a single one-sided draw
with platform-specific `accuracy` + a SAM intercept roll if any enemy SAM
envelope covers the target.
"""

from __future__ import annotations

import hashlib
import math
import random
from dataclasses import dataclass, field
from typing import Iterable, Literal

from axis.domain.coordinates import Coordinate
from axis.domain.military_assets import IsrCoverage, MissileRange
from axis.domain.theater import Theater
from axis.units.base import Unit
from axis.units.domain import UnitKind


# ---------------------------------------------------------------------------
# RNG: deterministic per batch
# ---------------------------------------------------------------------------


class BatchRng:
    """Deterministic RNG keyed on a stable string (order ids concat).

    Each call site pulls a fresh `random.Random` seeded with a sub-key so
    independent rolls (engagement A vs engagement B vs SAM intercept) do not
    correlate.
    """

    def __init__(self, seed_material: str) -> None:
        self._seed = seed_material

    @classmethod
    def for_batch(cls, order_ids: Iterable[str]) -> "BatchRng":
        h = hashlib.sha256("|".join(order_ids).encode("utf-8")).hexdigest()
        return cls(h)

    def stream(self, sub_key: str) -> random.Random:
        h = hashlib.sha256(f"{self._seed}::{sub_key}".encode("utf-8")).hexdigest()
        return random.Random(int(h[:16], 16))


# ---------------------------------------------------------------------------
# Per-kind combat constants
# ---------------------------------------------------------------------------


# Direct-fire weapon factor; multiplies effective firepower in engagements.
_WEAPON_FACTOR: dict[UnitKind, float] = {
    UnitKind.INFANTRY_BRIGADE: 0.85,
    UnitKind.ARMOURED_BRIGADE: 1.30,
    UnitKind.AIR_WING: 1.0,  # sortie path, not direct engagement
    UnitKind.NAVAL_TASK_GROUP: 1.20,
}


# Maximum direct-engagement range (km) for ground/naval units.
_ENGAGE_RANGE_KM: dict[UnitKind, float] = {
    UnitKind.INFANTRY_BRIGADE: 18.0,
    UnitKind.ARMOURED_BRIGADE: 32.0,
    UnitKind.AIR_WING: 0.0,  # uses sortie radius instead
    UnitKind.NAVAL_TASK_GROUP: 280.0,
}


# Sortie / mission radius (km) for air wings.
AIR_SORTIE_RADIUS_KM: float = 600.0
AIR_REBASE_RADIUS_KM: float = 1800.0
NAVAL_MOVE_RADIUS_KM: float = 520.0


def engagement_range_km(unit: Unit) -> float:
    return _ENGAGE_RANGE_KM.get(unit.kind, 20.0)


def weapon_factor(unit: Unit) -> float:
    return _WEAPON_FACTOR.get(unit.kind, 1.0)


# ---------------------------------------------------------------------------
# Geometry / detection
# ---------------------------------------------------------------------------


def haversine_km(a: Coordinate, b: Coordinate) -> float:
    r_km = 6371.0088
    lat1 = math.radians(a.lat)
    lat2 = math.radians(b.lat)
    dlat = lat2 - lat1
    dlon = math.radians(b.lon - a.lon)
    h = math.sin(dlat / 2.0) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2.0) ** 2
    return 2.0 * r_km * math.asin(min(1.0, math.sqrt(h)))


def _bearing_deg(origin: Coordinate, target: Coordinate) -> float:
    """Initial bearing from origin -> target, degrees clockwise from north."""
    lat1 = math.radians(origin.lat)
    lat2 = math.radians(target.lat)
    dlon = math.radians(target.lon - origin.lon)
    x = math.sin(dlon) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    return (math.degrees(math.atan2(x, y)) + 360.0) % 360.0


def _angle_within_beam(bearing: float, heading: float, beam: float) -> bool:
    if beam >= 359.999:
        return True
    diff = abs(((bearing - heading + 540.0) % 360.0) - 180.0)
    return diff <= beam / 2.0


def covered_by_isr(target: Coordinate, isrs: Iterable[IsrCoverage]) -> bool:
    """True if any ISR cone in `isrs` covers `target`."""
    for cone in isrs:
        if haversine_km(cone.origin, target) > cone.range_km:
            continue
        if _angle_within_beam(_bearing_deg(cone.origin, target), cone.heading_deg, cone.beam_deg):
            return True
    return False


def covered_by_sam(target: Coordinate, sams: Iterable[MissileRange]) -> bool:
    """True if any SAM envelope covers `target` (used for sortie risk)."""
    for s in sams:
        if s.category != "sam":
            continue
        if haversine_km(s.origin, target) > s.range_km:
            continue
        if _angle_within_beam(_bearing_deg(s.origin, target), s.heading_deg, s.beam_deg):
            return True
    return False


def friendly_isr_for(theater: Theater, faction_id: str) -> list[IsrCoverage]:
    return [c for c in theater.isr_coverages if c.faction_id == faction_id]


def hostile_sams_for(theater: Theater, attacker_faction_id: str) -> list[MissileRange]:
    return [
        m for m in theater.missile_ranges
        if m.faction_id != attacker_faction_id and m.category == "sam"
    ]


def is_target_detected(
    target_position: Coordinate,
    target_faction_id: str,
    attacker_faction_id: str,
    attacker_position: Coordinate | None,
    theater: Theater,
    *,
    self_detect_radius_km: float = 0.0,
) -> bool:
    """Detection rule: target is visible if either:
       (a) within any friendly ISR cone, or
       (b) within `self_detect_radius_km` of the attacker (line-of-sight proxy).

    Friendly co-faction targets are always detected. `self_detect_radius_km`
    of 0 disables (b).
    """
    if target_faction_id == attacker_faction_id:
        return True
    if attacker_position is not None and self_detect_radius_km > 0:
        if haversine_km(attacker_position, target_position) <= self_detect_radius_km:
            return True
    return covered_by_isr(target_position, friendly_isr_for(theater, attacker_faction_id))


# ---------------------------------------------------------------------------
# Engagement resolution (unit vs unit)
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class EngagementResolution:
    attacker_id: str
    defender_id: str
    attacker_strength_loss: float
    defender_strength_loss: float
    attacker_morale_loss: float
    defender_morale_loss: float
    force_ratio: float
    defender_retreated: bool
    retreat_destination: Coordinate | None = None
    summary: str = ""

    def to_dict(self) -> dict[str, object]:
        out: dict[str, object] = {
            "attacker_id": self.attacker_id,
            "defender_id": self.defender_id,
            "attacker_strength_loss": round(self.attacker_strength_loss, 3),
            "defender_strength_loss": round(self.defender_strength_loss, 3),
            "attacker_morale_loss": round(self.attacker_morale_loss, 3),
            "defender_morale_loss": round(self.defender_morale_loss, 3),
            "force_ratio": round(self.force_ratio, 2),
            "defender_retreated": self.defender_retreated,
            "summary": self.summary,
        }
        if self.retreat_destination is not None:
            out["retreat_destination"] = [
                self.retreat_destination.lon,
                self.retreat_destination.lat,
            ]
        return out


def resolve_engagement(
    *,
    attacker: Unit,
    defender: Unit,
    rng: random.Random,
    isr_bonus: float = 0.0,
    entrenchment: float = 0.0,
) -> EngagementResolution:
    """Stochastic engagement resolution. Mutates nothing; returns a result."""
    f_a = max(1e-3, attacker.strength * attacker.readiness * attacker.morale * weapon_factor(attacker))
    f_d = max(1e-3, defender.strength * defender.readiness * defender.morale * weapon_factor(defender))
    f_a *= 1.0 + 0.15 * isr_bonus
    f_d *= 1.0 + 0.6 * max(0.0, min(1.0, entrenchment))

    R = f_a / f_d
    base = 0.18
    dmg_d = max(0.02, min(0.85, base * math.sqrt(R) * (1.0 + rng.gauss(0.0, 0.20))))
    dmg_a = max(0.01, min(0.60, base / math.sqrt(R) * (1.0 + rng.gauss(0.0, 0.20))))

    morale_d_loss = min(defender.morale, 0.6 * dmg_d + rng.uniform(0.0, 0.05))
    morale_a_loss = min(attacker.morale, 0.4 * dmg_a + rng.uniform(0.0, 0.04))

    actual_dmg_d = min(defender.strength, dmg_d)
    actual_dmg_a = min(attacker.strength, dmg_a)

    post_d_strength = defender.strength - actual_dmg_d
    retreated = post_d_strength < 0.20 or actual_dmg_d > 0.40
    retreat_dest: Coordinate | None = None
    if retreated:
        retreat_dest = _retreat_point(defender.position, away_from=attacker.position, km=20.0)

    summary = (
        f"R={R:.2f} A-{actual_dmg_a:.2f}/D-{actual_dmg_d:.2f}"
        + (" def retreats" if retreated else "")
    )
    return EngagementResolution(
        attacker_id=attacker.id,
        defender_id=defender.id,
        attacker_strength_loss=actual_dmg_a,
        defender_strength_loss=actual_dmg_d,
        attacker_morale_loss=morale_a_loss,
        defender_morale_loss=morale_d_loss,
        force_ratio=R,
        defender_retreated=retreated,
        retreat_destination=retreat_dest,
        summary=summary,
    )


def _retreat_point(origin: Coordinate, *, away_from: Coordinate, km: float) -> Coordinate:
    bearing = (_bearing_deg(away_from, origin)) % 360.0
    return _project(origin, bearing_deg=bearing, distance_km=km)


def _project(origin: Coordinate, *, bearing_deg: float, distance_km: float) -> Coordinate:
    r = 6371.0088
    br = math.radians(bearing_deg)
    lat1 = math.radians(origin.lat)
    lon1 = math.radians(origin.lon)
    d_r = distance_km / r
    lat2 = math.asin(math.sin(lat1) * math.cos(d_r) + math.cos(lat1) * math.sin(d_r) * math.cos(br))
    lon2 = lon1 + math.atan2(
        math.sin(br) * math.sin(d_r) * math.cos(lat1),
        math.cos(d_r) - math.sin(lat1) * math.sin(lat2),
    )
    return Coordinate(lon=math.degrees(lon2), lat=math.degrees(lat2))


# ---------------------------------------------------------------------------
# Strike resolution (sortie / missile / naval salvo)
# ---------------------------------------------------------------------------


StrikeKind = Literal["air_strike", "air_sead", "missile", "naval_strike", "interdict"]


@dataclass(slots=True)
class StrikeResolution:
    """One-sided resolution for stand-off strikes."""

    kind: StrikeKind
    target_id: str
    intercepted: bool
    hit: bool
    damage: float = 0.0  # 0..1 share applied to target metric
    attacker_loss: float = 0.0  # share of attacker strength (sortie attrition)
    summary: str = ""
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, object]:
        return {
            "kind": self.kind,
            "target_id": self.target_id,
            "intercepted": self.intercepted,
            "hit": self.hit,
            "damage": round(self.damage, 3),
            "attacker_loss": round(self.attacker_loss, 3),
            "summary": self.summary,
            "notes": list(self.notes),
        }


def resolve_strike(
    *,
    kind: StrikeKind,
    target_id: str,
    target_position: Coordinate,
    attacker_faction_id: str,
    accuracy: float,
    base_damage: float,
    sam_intercept_chance: float,
    rng: random.Random,
    theater: Theater,
    sortie_attrition_base: float = 0.0,
) -> StrikeResolution:
    """One-sided strike: optional SAM intercept, then hit/miss, then damage roll.

    `accuracy` is the unmitigated hit probability assuming no intercept.
    `sam_intercept_chance` 0..1 is multiplied by the platform-specific
    interceptability; SEAD strikes ignore intercepts (they target the SAM).
    """
    notes: list[str] = []
    intercepted = False
    if kind != "air_sead":
        sams = hostile_sams_for(theater, attacker_faction_id)
        covered = covered_by_sam(target_position, sams)
        if covered:
            roll = rng.random()
            if roll < sam_intercept_chance:
                intercepted = True
                notes.append(f"SAM intercept (p={sam_intercept_chance:.2f}, roll={roll:.2f})")
    if intercepted:
        attrition = max(0.0, sortie_attrition_base + rng.uniform(0.02, 0.06))
        return StrikeResolution(
            kind=kind, target_id=target_id, intercepted=True, hit=False,
            attacker_loss=attrition,
            summary=f"intercepted; attacker -{attrition:.2f}",
            notes=notes,
        )

    hit_roll = rng.random()
    hit = hit_roll < accuracy
    if not hit:
        attrition = max(0.0, sortie_attrition_base + rng.uniform(0.0, 0.03))
        return StrikeResolution(
            kind=kind, target_id=target_id, intercepted=False, hit=False,
            attacker_loss=attrition,
            summary=f"miss (acc={accuracy:.2f}, roll={hit_roll:.2f})",
            notes=notes,
        )

    damage = max(0.05, min(0.95, base_damage * (1.0 + rng.gauss(0.0, 0.20))))
    attrition = max(0.0, sortie_attrition_base + rng.uniform(0.0, 0.04))
    return StrikeResolution(
        kind=kind, target_id=target_id, intercepted=False, hit=True,
        damage=damage,
        attacker_loss=attrition,
        summary=f"hit dmg={damage:.2f}",
        notes=notes,
    )
