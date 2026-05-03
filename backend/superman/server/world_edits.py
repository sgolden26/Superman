"""Spawn helpers that ingest LLM-proposed edits into an in-flight `Theater`.

Tier-1 modelling pass: callers may mint only `spawn_missile_range`
(SAM/ballistic/MLRS umbrellas, handy for injecting air denial mid-scenario)
or `spawn_unit` (fresh formations routed through `UnitFactory` validation).

Safeguards (unchanged semantics):

- ≤3 edits per response; surplus rows land in warnings only.
- Factions belong to the issuing player's team until a later relax.
- Coordinates clipped to `theater.bbox` with numeric clamps.
- `*.llm.<n>` ids never collide with seeded entities.

Executed under the same `TheaterStore` lock as order decode so spawned ids may
appear in sibling orders issued in one response cycle.
"""

from __future__ import annotations

from typing import Any

from superman.domain.coordinates import Coordinate
from superman.domain.faction import Allegiance
from superman.domain.military_assets import MissileRange
from superman.domain.theater import Theater
from superman.factories.unit_factory import UnitFactory
from superman.units.domain import UnitKind


_MAX_EDITS_PER_CALL: int = 3
_DEFAULT_BEAM_DEG: float = 360.0

_VALID_MISSILE_CATEGORIES: tuple[str, ...] = ("sam", "cruise", "ballistic", "mlrs")
_MISSILE_RANGE_BOUNDS_KM: tuple[float, float] = (50.0, 400.0)

_UNIT_KIND_BY_STR: dict[str, UnitKind] = {
    "infantry_brigade": UnitKind.INFANTRY_BRIGADE,
    "armoured_brigade": UnitKind.ARMOURED_BRIGADE,
    "air_wing": UnitKind.AIR_WING,
    "naval_task_group": UnitKind.NAVAL_TASK_GROUP,
}

_TEAM_TO_ALLEGIANCE: dict[str, Allegiance] = {
    "red": Allegiance.RED,
    "blue": Allegiance.BLUE,
}


def _own_faction_ids(theater: Theater, issuer_team: str) -> set[str]:
    target = _TEAM_TO_ALLEGIANCE[issuer_team]
    return {f.id for f in theater.factions if f.allegiance is target}


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _within_bbox(theater: Theater, lon: float, lat: float) -> bool:
    bb = theater.bbox
    return bb.min_lon <= lon <= bb.max_lon and bb.min_lat <= lat <= bb.max_lat


def _next_seq(theater: Theater, prefix: str) -> int:
    """Smallest n where `<prefix>.<n>` is unused. O(N) but N is tiny."""
    used: set[int] = set()
    for u in theater.units:
        if u.id.startswith(prefix + "."):
            tail = u.id.rsplit(".", 1)[-1]
            if tail.isdigit():
                used.add(int(tail))
    for m in theater.missile_ranges:
        if m.id.startswith(prefix + "."):
            tail = m.id.rsplit(".", 1)[-1]
            if tail.isdigit():
                used.add(int(tail))
    n = 1
    while n in used:
        n += 1
    return n


def _coerce_position(raw: Any) -> tuple[float, float] | None:
    if not isinstance(raw, (list, tuple)) or len(raw) != 2:
        return None
    try:
        lon = float(raw[0])
        lat = float(raw[1])
    except (TypeError, ValueError):
        return None
    if not -180.0 <= lon <= 180.0 or not -90.0 <= lat <= 90.0:
        return None
    return lon, lat


def _apply_spawn_missile_range(
    theater: Theater,
    edit: dict[str, Any],
    own_factions: set[str],
) -> tuple[dict[str, Any] | None, str | None]:
    faction_id = str(edit.get("faction_id") or "").strip()
    if faction_id not in own_factions:
        return None, f"spawn_missile_range: faction_id {faction_id!r} not on your team"

    pos = _coerce_position(edit.get("position"))
    if pos is None:
        return None, "spawn_missile_range: position must be [lon, lat]"
    lon, lat = pos
    if not _within_bbox(theater, lon, lat):
        return None, "spawn_missile_range: position is outside the theatre bbox"

    raw_range = edit.get("range_km", 200.0)
    try:
        range_km = float(raw_range)
    except (TypeError, ValueError):
        return None, "spawn_missile_range: range_km must be numeric"
    range_km = _clamp(range_km, *_MISSILE_RANGE_BOUNDS_KM)

    category = str(edit.get("category") or "sam").strip().lower()
    if category not in _VALID_MISSILE_CATEGORIES:
        category = "sam"

    weapon = str(edit.get("weapon") or "improvised").strip()[:40] or "improvised"
    name = str(edit.get("name") or "").strip()[:40]
    if not name:
        name = f"{weapon.upper()} ({faction_id.upper()})"

    seq = _next_seq(theater, f"msl.{faction_id}.llm")
    new_id = f"msl.{faction_id}.llm.{seq}"

    spawned = MissileRange(
        id=new_id,
        name=name,
        faction_id=faction_id,
        origin=Coordinate(lon=lon, lat=lat),
        range_km=range_km,
        weapon=weapon,
        category=category,
        beam_deg=_DEFAULT_BEAM_DEG,
        available_actions=("strike", "interdict") if category != "sam" else (),
    )
    theater.missile_ranges.append(spawned)

    return (
        {
            "kind": "spawn_missile_range",
            "id": new_id,
            "faction_id": faction_id,
            "name": name,
            "position": [round(lon, 4), round(lat, 4)],
            "range_km": round(range_km, 1),
            "category": category,
            "weapon": weapon,
        },
        None,
    )


def _apply_spawn_unit(
    theater: Theater,
    edit: dict[str, Any],
    own_factions: set[str],
) -> tuple[dict[str, Any] | None, str | None]:
    faction_id = str(edit.get("faction_id") or "").strip()
    if faction_id not in own_factions:
        return None, f"spawn_unit: faction_id {faction_id!r} not on your team"

    raw_kind = str(edit.get("kind_unit") or edit.get("unit_kind") or "").strip().lower()
    if raw_kind not in _UNIT_KIND_BY_STR:
        return (
            None,
            "spawn_unit: kind_unit must be one of "
            "infantry_brigade|armoured_brigade|air_wing|naval_task_group",
        )

    pos = _coerce_position(edit.get("position"))
    if pos is None:
        return None, "spawn_unit: position must be [lon, lat]"
    lon, lat = pos
    if not _within_bbox(theater, lon, lat):
        return None, "spawn_unit: position is outside the theatre bbox"

    name = str(edit.get("name") or "").strip()[:48]
    if not name:
        name = f"{raw_kind.replace('_', ' ').title()} ({faction_id.upper()})"

    def _scalar(field: str, default: float) -> float:
        raw = edit.get(field, default)
        try:
            return _clamp(float(raw), 0.0, 1.0)
        except (TypeError, ValueError):
            return default

    strength = _scalar("strength", 0.6)
    readiness = _scalar("readiness", 0.6)
    morale = _scalar("morale", 0.6)

    seq = _next_seq(theater, f"unit.{faction_id}.llm")
    new_id = f"unit.{faction_id}.llm.{seq}"

    spawned = UnitFactory.create(
        kind=_UNIT_KIND_BY_STR[raw_kind],
        id=new_id,
        name=name,
        faction_id=faction_id,
        position=Coordinate(lon=lon, lat=lat),
        strength=strength,
        readiness=readiness,
        morale=morale,
    )
    theater.units.append(spawned)

    return (
        {
            "kind": "spawn_unit",
            "id": new_id,
            "faction_id": faction_id,
            "name": name,
            "unit_kind": raw_kind,
            "position": [round(lon, 4), round(lat, 4)],
            "strength": round(strength, 2),
            "readiness": round(readiness, 2),
            "morale": round(morale, 2),
        },
        None,
    )


def apply_edits(
    theater: Theater,
    raw_edits: list[Any],
    issuer_team: str,
) -> tuple[list[dict[str, Any]], list[str]]:
    """Apply LLM-proposed edits in order. Mutates `theater` in place.

    Returns (applied, warnings). Capped at `_MAX_EDITS_PER_CALL`; excess
    rolls into warnings rather than silently dropping.
    """
    applied: list[dict[str, Any]] = []
    warnings: list[str] = []

    if issuer_team not in _TEAM_TO_ALLEGIANCE:
        warnings.append(f"edits ignored: bad issuer_team {issuer_team!r}")
        return applied, warnings

    if not isinstance(raw_edits, list):
        if raw_edits is not None:
            warnings.append("edits ignored: must be a list")
        return applied, warnings

    if len(raw_edits) > _MAX_EDITS_PER_CALL:
        warnings.append(
            f"edits truncated: {len(raw_edits) - _MAX_EDITS_PER_CALL} extra dropped "
            f"(cap is {_MAX_EDITS_PER_CALL})"
        )
        raw_edits = raw_edits[:_MAX_EDITS_PER_CALL]

    own_factions = _own_faction_ids(theater, issuer_team)
    if not own_factions:
        warnings.append("edits ignored: no factions found for your team")
        return applied, warnings

    for edit in raw_edits:
        if not isinstance(edit, dict):
            warnings.append("edit dropped: not an object")
            continue
        kind = str(edit.get("kind") or "").strip()
        try:
            if kind == "spawn_missile_range":
                result, err = _apply_spawn_missile_range(theater, edit, own_factions)
            elif kind == "spawn_unit":
                result, err = _apply_spawn_unit(theater, edit, own_factions)
            else:
                result, err = None, f"edit dropped: unknown kind {kind!r}"
        except (ValueError, TypeError) as exc:
            result, err = None, f"edit dropped ({kind}): {exc}"

        if err is not None:
            warnings.append(err)
        if result is not None:
            applied.append(result)

    return applied, warnings
