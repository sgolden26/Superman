"""LLM-backed order suggester.

Takes a free-form prompt describing a player's intent for the round, plus
the live theatre, and returns a list of validated `OrderDTO`s the FE can
drop straight into its staged-orders cart.

Design points
-------------
- Stateless. The handler builds a compact "world brief" from the current
  theatre, calls OpenAI with strict JSON output, then runs every returned
  order through `OrderRegistry.decode` + `Order.validate` against the same
  theatre. Invalid orders are dropped into a `warnings` list rather than
  failing the whole call so the LLM can still produce a partial useful
  plan.
- Key from `OPENAI_API_KEY`. If missing or the SDK isn't installed the
  endpoint surfaces a 503 with a clear message rather than crashing.
- The world brief is intentionally lossy. We trim long lists and only
  include enemy units and assets within a generous detection radius of any
  friendly platform, mirroring the "fog of war" the FE already imposes.
"""

from __future__ import annotations

import json
import os
from typing import Any

from axis.domain.faction import Allegiance
from axis.domain.theater import Theater
from axis.sim.combat import (
    AIR_REBASE_RADIUS_KM,
    AIR_SORTIE_RADIUS_KM,
    NAVAL_MOVE_RADIUS_KM,
    haversine_km,
)
from axis.server.world_edits import apply_edits
from axis.sim.orders import OrderBatch, OrderRegistry


# Maximum great-circle distance from any friendly platform at which an enemy
# entity is included in the world brief. Larger than any single weapon range
# so the LLM has slightly more situational awareness than a strict
# "detected" filter (the engine still rejects undetected strikes at validate
# time).
_AWARENESS_RADIUS_KM: float = 800.0

# Cap list sizes to keep the brief under a few KB.
_MAX_OWN_UNITS: int = 60
_MAX_ENEMY_UNITS: int = 40
_MAX_ASSETS_PER_KIND: int = 30
_MAX_SUPPLY_LINES: int = 30

_TEAM_TO_ALLEGIANCE: dict[str, Allegiance] = {
    "red": Allegiance.RED,
    "blue": Allegiance.BLUE,
}


SYSTEM_PROMPT = """\
You are the staff officer for the Axis wargame. You receive a high-level
intent from the commander and produce a concrete list of orders for THIS
round. Your output is consumed directly by the simulator, so it MUST be
valid JSON in the exact shape described below. Do not invent ids that are
not present in the world brief.

Rules of engagement:
- Only suggest orders for units / platforms whose owning faction is one of
  `your_factions` in the brief. Never issue orders to enemy or neutral
  assets.
- Respect ranges in `ranges_km`. Distances are great-circle kilometres
  between the platform's position and the destination/target.
- At most ONE combat-affecting order per unit / missile platform per round
  (move, engage, sortie, naval move/strike, missile strike, interdict,
  resupply, entrench all count). The simulator will reject duplicates.
- Use existing ids from the brief verbatim. Coordinates are
  `[lon, lat]` in degrees. NEVER invent a `unit_id`, `target_id`,
  `airfield_id`, `depot_id`, `naval_base_id`, `platform_id`, or any
  other id. Every id MUST appear in the brief (or be a freshly spawned
  id from a same-response `edits` entry). The frontend silently drops
  orders with unknown ids, so a hallucinated id is a wasted slot.
- Targets for engage / strikes must belong to enemy factions and MUST
  be picked from `enemy_units_visible` or `enemy_assets_visible.*` in
  the brief. SEAD sorties must target a `missile_range` whose
  `category` is `sam` and whose id appears in
  `enemy_assets_visible.missile_ranges`. Strike sorties must target a
  unit/airfield/depot/naval_base/missile_range/supply_line/city whose
  id appears in the brief. If the commander asks for offensive action
  and the brief shows ANY visible enemy airfield, SAM, depot, or
  detected unit within sortie/strike range, USE IT - do not skip
  sorties just because the exact thing the commander named (e.g. a
  specific F-22 unit) is not listed. Strike the airfield it would fly
  from, SEAD the SAM that protects it, etc. Only skip a sortie if the
  brief is genuinely empty of viable enemy targets in range.
- Match the SCALE of the commander's intent. For broad / aggressive
  prompts ("all out attack", "full offensive", "general defence",
  "everything we have"), issue an order for AS MANY eligible platforms as
  you can — aim to use most of `your_units` and most non-SAM
  `your_assets.missile_ranges`. Twenty or thirty orders is fine if the
  intent is sweeping. For a narrow tactical instruction, a handful is
  fine. NEVER hold back units when the intent is broad.
- Don't leave platforms idle when the intent calls for action: ground
  units that can't reach an enemy this turn should `move` toward the
  fight, air wings without a target should `rebase_air` forward, depots
  with friendly units in supply should `resupply` them.
- If the commander explicitly asks for capabilities the brief lacks
  ("introduce SAMs to take down a Raptor", "stand up a Patriot battery
  near Lviv", "deploy a fresh armoured brigade at Belgorod"), and ONLY
  in that case, you may use the optional `edits` array to spawn new
  platforms BEFORE issuing orders that reference them. Edits are capped
  at 3 per call. Do not invent edits unprompted; never edit the enemy's
  side. When in doubt, omit `edits`.
- ALWAYS produce orders alongside any edits. An `edits` entry is a
  capability change for the round, not a substitute for action. After
  spawning a SAM bubble or a fresh formation, fill `orders` with the
  plays that capitalise on it: move nearby ground units to defend the
  new platform, sortie SEAD/strike against any enemy aircraft or SAM
  the player called out, missile_strike with existing platforms against
  enemy assets the new bubble now protects against, etc. A response
  with `edits` and zero `orders` is a failure.
- Briefly justify the plan in `rationale` (2-4 sentences max).

Respond with strict JSON only, matching exactly:

{
  "orders": [<order objects, see kinds above>],
  "edits":  [<edit objects, optional, max 3, ONLY when the prompt asks
              for capabilities the brief lacks>],
  "rationale": "<short prose>"
}

CRITICAL: `orders` and `edits` are DIFFERENT arrays with DIFFERENT
allowed `kind` values. Every entry above with `kind` in
{move, entrench, engage, rebase_air, air_sortie, naval_move,
naval_strike, missile_strike, resupply, interdict_supply} goes in
`orders`. Every entry below with `kind` in
{spawn_missile_range, spawn_unit} goes in `edits`. Never mix them.

Edit object shapes (spawned ids are generated by the simulator and
returned to the client; do NOT pre-pick ids):

- {"kind": "spawn_missile_range", "faction_id": "<own>",
   "name": "<short label>", "position": [lon, lat],
   "range_km": <50..400>, "category": "sam"|"cruise"|"ballistic"|"mlrs",
   "weapon": "<short label, e.g. 'S-400' or 'Patriot PAC-3'>"}
- {"kind": "spawn_unit", "faction_id": "<own>",
   "kind_unit": "infantry_brigade"|"armoured_brigade"|"air_wing"|"naval_task_group",
   "name": "<short label>", "position": [lon, lat],
   "strength": <0..1>, "readiness": <0..1>, "morale": <0..1>}

Note: in the `spawn_unit` shape the unit type field is named `kind_unit`
because the outer object already has a `kind` discriminator.

Concrete example for "introduce SAMs near Belgorod to take down the
F-22 sortie" (issuer_team=red, abbreviated):

{
  "edits": [
    {"kind": "spawn_missile_range", "faction_id": "ru",
     "name": "S-400 Belgorod", "position": [36.59, 50.59],
     "range_km": 250, "category": "sam", "weapon": "S-400"}
  ],
  "orders": [
    /* SEAD sortie against a real enemy SAM id from
       enemy_assets_visible.missile_ranges (use a real Russian air wing
       id from your_units, air domain): */
    {"order_id": "o1", "kind": "air_sortie",
     "unit_id": "<real ru air wing id from your_units>",
     "mission": "sead", "target_kind": "missile_range",
     "target_id": "<real ua SAM id from enemy_assets_visible.missile_ranges>"},
    /* Strike sortie against a real enemy airfield: */
    {"order_id": "o2", "kind": "air_sortie",
     "unit_id": "<another real ru air wing id>",
     "mission": "strike", "target_kind": "airfield",
     "target_id": "<real ua airfield id from enemy_assets_visible.airfields>"},
    /* Push every reachable own ground unit toward the new bubble: */
    {"order_id": "o3", "kind": "move",
     "unit_id": "<real id from your_units, ground domain>",
     "mode": "vehicle", "destination": [36.59, 50.59]},
    {"order_id": "o4", "kind": "entrench",
     "unit_id": "<another real ground id from your_units>"}
    /* ...one order per eligible own unit. Use REAL ids only -
       placeholders like the angle-bracket strings above are
       illustrative; replace them with actual ids from the brief. */
  ],
  "rationale": "Stand up an S-400 bubble near Belgorod to deny F-22
  approaches, push ground forces in to secure it, SEAD the Patriot
  bubble that would protect the F-22's strike package, and hit the
  airfield it would fly from."
}

Each order object uses one of these `kind`s and required fields. Optional
fields not listed must be omitted. The `order_id` is any short unique
string (the simulator uses it for replay).

- {"order_id": "...", "kind": "move", "unit_id": "...",
   "mode": "foot" | "vehicle", "destination": [lon, lat]}
- {"order_id": "...", "kind": "entrench", "unit_id": "..."}
- {"order_id": "...", "kind": "engage", "attacker_id": "...", "target_id": "..."}
- {"order_id": "...", "kind": "rebase_air", "unit_id": "...", "airfield_id": "..."}
- {"order_id": "...", "kind": "air_sortie", "unit_id": "...",
   "mission": "strike" | "sead",
   "target_kind": "unit"|"depot"|"airfield"|"naval_base"|"missile_range"|"supply_line"|"city",
   "target_id": "..."}
- {"order_id": "...", "kind": "naval_move", "unit_id": "...", "destination": [lon, lat]}
- {"order_id": "...", "kind": "naval_strike", "unit_id": "...",
   "target_kind": <as above>, "target_id": "..."}
- {"order_id": "...", "kind": "missile_strike", "platform_id": "...",
   "target_kind": <as above>, "target_id": "..."}
- {"order_id": "...", "kind": "resupply", "depot_id": "...", "unit_id": "..."}
- {"order_id": "...", "kind": "interdict_supply",
   "platform_kind": "air_wing" | "missile_range",
   "platform_id": "...", "supply_line_id": "..."}

Do not include any prose outside of the JSON object.
"""


# ---------------------------------------------------------------------------
# World brief
# ---------------------------------------------------------------------------


def _faction_team(faction: Any) -> str | None:
    a = getattr(faction, "allegiance", None)
    if a is Allegiance.RED:
        return "red"
    if a is Allegiance.BLUE:
        return "blue"
    return None


def _own_faction_ids(theater: Theater, issuer_team: str) -> set[str]:
    target = _TEAM_TO_ALLEGIANCE[issuer_team]
    return {f.id for f in theater.factions if f.allegiance is target}


def _summary_unit(u: Any) -> dict[str, Any]:
    out = {
        "id": u.id,
        "name": u.name,
        "faction_id": u.faction_id,
        "domain": u.domain.value,
        "kind": u.kind.value,
        "position": [round(u.position.lon, 4), round(u.position.lat, 4)],
        "strength": round(u.strength, 2),
        "readiness": round(u.readiness, 2),
        "morale": round(u.morale, 2),
        "entrenchment": round(u.entrenchment, 2),
    }
    if u.country_id is not None:
        out["country_id"] = u.country_id
    return out


def _summary_depot(d: Any) -> dict[str, Any]:
    out = {
        "id": d.id, "name": d.name, "faction_id": d.faction_id,
        "position": [round(d.position.lon, 4), round(d.position.lat, 4)],
        "fill": round(d.fill, 2),
    }
    if d.country_id is not None:
        out["country_id"] = d.country_id
    return out


def _summary_airfield(a: Any) -> dict[str, Any]:
    out = {
        "id": a.id, "name": a.name, "faction_id": a.faction_id,
        "position": [round(a.position.lon, 4), round(a.position.lat, 4)],
        "runway_m": a.runway_m,
    }
    if a.country_id is not None:
        out["country_id"] = a.country_id
    return out


def _summary_naval_base(n: Any) -> dict[str, Any]:
    out = {
        "id": n.id, "name": n.name, "faction_id": n.faction_id,
        "position": [round(n.position.lon, 4), round(n.position.lat, 4)],
        "pier_count": n.pier_count,
    }
    if n.country_id is not None:
        out["country_id"] = n.country_id
    return out


def _summary_missile(m: Any) -> dict[str, Any]:
    out = {
        "id": m.id, "name": m.name, "faction_id": m.faction_id,
        "origin": [round(m.origin.lon, 4), round(m.origin.lat, 4)],
        "range_km": round(m.range_km, 0),
        "category": m.category,
        "weapon": m.weapon,
    }
    if m.country_id is not None:
        out["country_id"] = m.country_id
    return out


def _summary_supply_line(s: Any) -> dict[str, Any]:
    return {
        "id": s.id, "name": s.name, "faction_id": s.faction_id,
        "health": round(s.health, 2),
        "from_id": s.from_id, "to_id": s.to_id,
    }


def _platform_origins(theater: Theater, faction_ids: set[str]) -> list[Any]:
    """All friendly point sources used to enforce the awareness radius."""
    points: list[Any] = []
    for u in theater.units:
        if u.faction_id in faction_ids:
            points.append(u.position)
    for d in theater.depots:
        if d.faction_id in faction_ids:
            points.append(d.position)
    for a in theater.airfields:
        if a.faction_id in faction_ids:
            points.append(a.position)
    for n in theater.naval_bases:
        if n.faction_id in faction_ids:
            points.append(n.position)
    for m in theater.missile_ranges:
        if m.faction_id in faction_ids:
            points.append(m.origin)
    return points


def _within_awareness(pos: Any, origins: list[Any]) -> bool:
    if not origins:
        return False
    for o in origins:
        if haversine_km(o, pos) <= _AWARENESS_RADIUS_KM:
            return True
    return False


def build_world_brief(theater: Theater, issuer_team: str) -> dict[str, Any]:
    """Compact JSON the LLM can reason over. Keep small."""
    own_factions = _own_faction_ids(theater, issuer_team)
    origins = _platform_origins(theater, own_factions)

    your_factions: list[dict[str, Any]] = []
    enemy_factions: list[dict[str, Any]] = []
    for f in theater.factions:
        entry = {"id": f.id, "name": f.name, "allegiance": f.allegiance.value}
        if f.id in own_factions:
            your_factions.append(entry)
        elif f.allegiance in (Allegiance.RED, Allegiance.BLUE):
            enemy_factions.append(entry)

    your_units = [_summary_unit(u) for u in theater.units if u.faction_id in own_factions]
    your_units = your_units[:_MAX_OWN_UNITS]

    enemy_units = [
        _summary_unit(u)
        for u in theater.units
        if u.faction_id not in own_factions and _within_awareness(u.position, origins)
    ]
    enemy_units = enemy_units[:_MAX_ENEMY_UNITS]

    your_depots = [_summary_depot(d) for d in theater.depots if d.faction_id in own_factions]
    your_airfields = [_summary_airfield(a) for a in theater.airfields if a.faction_id in own_factions]
    your_naval = [_summary_naval_base(n) for n in theater.naval_bases if n.faction_id in own_factions]
    your_missiles = [_summary_missile(m) for m in theater.missile_ranges if m.faction_id in own_factions]

    enemy_depots = [
        _summary_depot(d) for d in theater.depots
        if d.faction_id not in own_factions and _within_awareness(d.position, origins)
    ]
    enemy_airfields = [
        _summary_airfield(a) for a in theater.airfields
        if a.faction_id not in own_factions and _within_awareness(a.position, origins)
    ]
    enemy_naval = [
        _summary_naval_base(n) for n in theater.naval_bases
        if n.faction_id not in own_factions and _within_awareness(n.position, origins)
    ]
    enemy_missiles = [
        _summary_missile(m) for m in theater.missile_ranges
        if m.faction_id not in own_factions and _within_awareness(m.origin, origins)
    ]

    supply_lines = [_summary_supply_line(s) for s in theater.supply_lines][:_MAX_SUPPLY_LINES]

    pressure = theater.pressure
    political: dict[str, Any] = {
        "current_turn": theater.current_turn,
        "global_deadline_turn": pressure.global_deadline_turn if pressure else None,
    }
    if pressure:
        own_p = next(
            (fp for fp in pressure.factions if fp.faction_id in own_factions),
            None,
        )
        if own_p is not None:
            political["your_pressure"] = round(own_p.intensity, 2)
        enemy_p = [
            {"faction_id": fp.faction_id, "intensity": round(fp.intensity, 2)}
            for fp in pressure.factions
            if fp.faction_id not in own_factions
        ]
        political["enemy_pressure"] = enemy_p

    brief: dict[str, Any] = {
        "issuer_team": issuer_team,
        "scenario": {"id": theater.id, "name": theater.name, "clock": theater.clock.isoformat()},
        "your_factions": your_factions,
        "enemy_factions": enemy_factions,
        "your_units": your_units,
        "enemy_units_visible": enemy_units,
        "your_assets": {
            "depots": your_depots[:_MAX_ASSETS_PER_KIND],
            "airfields": your_airfields[:_MAX_ASSETS_PER_KIND],
            "naval_bases": your_naval[:_MAX_ASSETS_PER_KIND],
            "missile_ranges": your_missiles[:_MAX_ASSETS_PER_KIND],
        },
        "enemy_assets_visible": {
            "depots": enemy_depots[:_MAX_ASSETS_PER_KIND],
            "airfields": enemy_airfields[:_MAX_ASSETS_PER_KIND],
            "naval_bases": enemy_naval[:_MAX_ASSETS_PER_KIND],
            "missile_ranges": enemy_missiles[:_MAX_ASSETS_PER_KIND],
        },
        "supply_lines": supply_lines,
        "political": political,
        "ranges_km": {
            "ground_foot": 24.1,
            "ground_vehicle": 250.0,
            "air_rebase": AIR_REBASE_RADIUS_KM,
            "air_sortie": AIR_SORTIE_RADIUS_KM,
            "naval_move": NAVAL_MOVE_RADIUS_KM,
            "engagement_typical": 25.0,
            "missile_per_platform": "see your_assets.missile_ranges[*].range_km",
        },
    }
    return brief


# ---------------------------------------------------------------------------
# OpenAI call + validation
# ---------------------------------------------------------------------------


class AssistantUnavailable(RuntimeError):
    """Raised when the assistant cannot run (key missing, SDK missing, etc)."""


def _call_openai(prompt: str, brief: dict[str, Any], model: str) -> dict[str, Any]:
    """Call OpenAI Chat Completions with strict JSON output. Returns parsed dict."""
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise AssistantUnavailable(
            "OPENAI_API_KEY is not set. Export it before running `axis serve`."
        )
    try:
        from openai import OpenAI  # type: ignore[import-not-found]
    except ImportError as exc:
        raise AssistantUnavailable(
            "openai SDK not installed. Run `pip install -e .` in backend/."
        ) from exc

    client = OpenAI(api_key=api_key)
    user_payload = {
        "intent": prompt,
        "world_brief": brief,
    }
    completion = client.chat.completions.create(
        model=model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(user_payload, separators=(",", ":"))},
        ],
        temperature=0.3,
        max_tokens=4096,
    )
    content = completion.choices[0].message.content or "{}"
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        raise AssistantUnavailable(f"LLM returned non-JSON content: {exc}") from exc
    if not isinstance(parsed, dict):
        raise AssistantUnavailable("LLM JSON root must be an object")
    return parsed


_SPAWN_KINDS: frozenset[str] = frozenset({"spawn_missile_range", "spawn_unit"})


def _split_misplaced_spawns(
    raw_orders: list[Any],
) -> tuple[list[Any], list[dict[str, Any]]]:
    """Pull any `kind == "spawn_*"` items out of `orders` into edits.

    Returns (cleaned_orders, migrated_edits). Items that aren't dicts or
    have a non-spawn kind pass through untouched.
    """
    keep: list[Any] = []
    migrated: list[dict[str, Any]] = []
    for raw in raw_orders:
        if isinstance(raw, dict):
            kind = str(raw.get("kind") or "").strip()
            if kind in _SPAWN_KINDS:
                edit = {k: v for k, v in raw.items() if k != "order_id"}
                migrated.append(edit)
                continue
        keep.append(raw)
    return keep, migrated


def _validate_orders(
    raw_orders: list[Any],
    issuer_team: str,
    theater: Theater,
) -> tuple[list[dict[str, Any]], list[str]]:
    """Decode + validate each LLM-proposed order. Return (kept, warnings)."""
    kept: list[dict[str, Any]] = []
    warnings: list[str] = []
    seen_ids: set[str] = set()
    seq = 0

    for raw in raw_orders:
        if not isinstance(raw, dict):
            warnings.append("dropped order: not an object")
            continue
        payload = dict(raw)
        kind = payload.get("kind")
        oid = str(payload.get("order_id") or "").strip()
        if not oid or oid in seen_ids:
            seq += 1
            oid = f"llm.{kind or 'order'}.{seq}"
            payload["order_id"] = oid
        seen_ids.add(oid)
        payload["issuer_team"] = issuer_team

        try:
            order = OrderRegistry.decode(payload)
        except (ValueError, KeyError, TypeError) as exc:
            warnings.append(f"{oid}: {exc}")
            continue

        outcome = order.validate(theater)
        if not outcome.ok:
            warnings.append(f"{oid}: {outcome.message}")
            continue

        kept.append(payload)

    return kept, warnings


def suggest_orders(
    *,
    prompt: str,
    issuer_team: str,
    theater: Theater,
    model: str = "gpt-4o-mini",
) -> dict[str, Any]:
    """Ask the LLM for a round of orders. Returns {orders, rationale, warnings}."""
    if issuer_team not in _TEAM_TO_ALLEGIANCE:
        raise ValueError(f"issuer_team must be 'red' or 'blue', got {issuer_team!r}")
    text = (prompt or "").strip()
    if not text:
        raise ValueError("prompt must be a non-empty string")

    brief = build_world_brief(theater, issuer_team)
    response = _call_openai(text, brief, model=model)

    raw_orders = response.get("orders", [])
    raw_edits = response.get("edits", [])
    rationale = str(response.get("rationale") or "").strip()
    if not isinstance(raw_orders, list):
        raise AssistantUnavailable("LLM 'orders' field must be a list")
    if not isinstance(raw_edits, list):
        raw_edits = []

    # The model often conflates `orders` and `edits` and drops a spawn_*
    # object into `orders`. Migrate any such items into `edits` before
    # decoding so we don't lose them as "unknown order kind" warnings.
    raw_orders, migrated_edits = _split_misplaced_spawns(raw_orders)
    raw_edits = [*raw_edits, *migrated_edits]

    # Apply edits FIRST so any orders in the same response that reference
    # the freshly spawned ids resolve cleanly during validate().
    applied_edits, edit_warnings = apply_edits(theater, raw_edits, issuer_team)

    kept, warnings = _validate_orders(raw_orders, issuer_team, theater)
    warnings = [*edit_warnings, *warnings]

    # Final sanity: build an OrderBatch to confirm cross-order constraints (e.g.
    # one-per-unit). We only use this to surface warnings; the FE will run
    # the real OrderBatch validation again at execute time.
    batch_payload: dict[str, Any] = {"issuer_team": issuer_team, "orders": kept}
    try:
        batch = OrderBatch.from_dict(batch_payload)
        unit_orders: dict[str, list[int]] = {}
        for idx, order in enumerate(batch.orders):
            uid = getattr(order, "unit_id", None) or getattr(order, "attacker_id", None)
            if uid:
                unit_orders.setdefault(uid, []).append(idx)
        deduped: list[dict[str, Any]] = []
        for idx, order_dto in enumerate(kept):
            uid = order_dto.get("unit_id") or order_dto.get("attacker_id")
            if uid and len(unit_orders.get(uid, [])) > 1:
                if unit_orders[uid][0] != idx:
                    warnings.append(
                        f"{order_dto['order_id']}: dropped (unit {uid} already has an order this round)"
                    )
                    continue
            deduped.append(order_dto)
        kept = deduped
    except ValueError as exc:
        warnings.append(f"batch rejected: {exc}")
        kept = []

    return {
        "orders": kept,
        "edits": applied_edits,
        "rationale": rationale,
        "warnings": warnings,
    }
