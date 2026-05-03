"""Decision-engine row explainer.

For a given `(action, region, team)`, produces a structured payload the
frontend renders inline below each breakdown row in the Decision Workspace.

Designed so the FE never has to compute the explanation itself: we re-run
the evaluator here to get the canonical `Outcome`, then attach a per-row
`summary` (plain-English narrative), `math` (formula), `sources` (clickable
provenance), and a row-typed `data` block for the political layer.

Inputs and outputs are plain dicts so the HTTP endpoint can serialise them
without knowing about evaluator internals.

Public API:
    `build_explanation(theater, action, region, team) -> dict`
    `region_from_dict(d) -> RegionIntel`  (helper for the HTTP layer)

Conventions:
- `summary` is qualitative-first; numbers appear only when decisive.
- `sources[].kind` is one of: "intel_event" | "leader_signal" |
  "action_catalog" | "scenario_assumption".
- A row may carry `disclaimer` when its inputs are demo / stub data.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Iterable, Sequence

from axis.decision.actions import Action
from axis.decision.evaluator import (
    BreakdownItem,
    PoliticalContext,
    SEVERITY_DIVISOR,
    evaluate,
)
from axis.domain.political import CredibilityTrack, LeaderSignal
from axis.domain.theater import Theater
from axis.intel.events import Event, EventCategory
from axis.intel.morale import Driver, RegionIntel
from axis.sim.political_engine import issuer_faction_id


# ---------------------------------------------------------------------------
# Region deserialisation
# ---------------------------------------------------------------------------


def region_from_dict(d: dict[str, Any]) -> RegionIntel:
    """Reconstruct a RegionIntel from its FE-side JSON shape.

    Tolerates missing optional fields (history / recent_events). Required
    fields are `region_id`, `morale_score`, `morale_trend`, `drivers[]`.
    """
    drivers: list[Driver] = []
    for dr in d.get("drivers", []) or []:
        drivers.append(
            Driver(
                category=EventCategory(dr["category"]),
                contribution=float(dr["contribution"]),
                headline=dr.get("headline", ""),
                event_id=dr.get("event_id", ""),
            )
        )

    events: list[Event] = []
    for ev in d.get("recent_events", []) or []:
        try:
            ts = _parse_ts(ev["ts"])
        except Exception:
            continue
        try:
            events.append(
                Event(
                    id=ev["id"],
                    region_id=ev.get("region_id", d["region_id"]),
                    ts=ts,
                    category=EventCategory(ev["category"]),
                    headline=ev.get("headline", ""),
                    snippet=ev.get("snippet", ""),
                    weight=float(ev.get("weight", 0.0)),
                    source=ev.get("source", "curated"),
                    url=ev.get("url"),
                )
            )
        except (KeyError, ValueError):
            continue

    history = tuple(float(x) for x in d.get("history", []) or [])

    return RegionIntel(
        region_id=str(d["region_id"]),
        morale_score=float(d["morale_score"]),
        morale_trend=str(d.get("morale_trend", "steady")),
        trend_delta=float(d.get("trend_delta", 0.0)),
        history=history,
        drivers=tuple(drivers),
        recent_events=tuple(events),
    )


def _parse_ts(raw: str) -> datetime:
    s = raw.replace("Z", "+00:00") if raw.endswith("Z") else raw
    return datetime.fromisoformat(s)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


def build_explanation(
    theater: Theater,
    action: Action,
    region: RegionIntel,
    team: str,
) -> dict[str, Any]:
    """Compute the canonical `Outcome` and attach per-row explanations."""
    political, target_faction_id = _political_for(theater, team, region.region_id)
    outcome = evaluate(action, region, political)

    issuer_id = political.issuer_faction_id if political else None
    issuer_name = _faction_name(theater, issuer_id) if issuer_id else None
    target_name = _faction_name(theater, target_faction_id) if target_faction_id else None
    region_name = _region_name(theater, region.region_id)

    rows: list[dict[str, Any]] = []
    for item in outcome.breakdown:
        rows.append(
            _row_for(
                item=item,
                action=action,
                region=region,
                region_name=region_name,
                political=political,
                theater=theater,
                issuer_id=issuer_id,
                issuer_name=issuer_name,
                target_id=target_faction_id,
                target_name=target_name,
            )
        )

    return {
        "action_id": action.id,
        "region_id": region.region_id,
        "region_name": region_name,
        "issuer_team": team,
        "issuer_faction_id": issuer_id,
        "target_faction_id": target_faction_id,
        "action_note": action.wargame_note,
        "action": {
            "id": action.id,
            "name": action.name,
            "description": action.description,
        },
        "outcome": outcome.to_dict(),
        "rows": rows,
    }


# ---------------------------------------------------------------------------
# Political context resolution (mirrors FE buildPoliticalContext)
# ---------------------------------------------------------------------------


def _political_for(
    theater: Theater, team: str, region_id: str
) -> tuple[PoliticalContext | None, str | None]:
    issuer_id = issuer_faction_id(theater, team)  # type: ignore[arg-type]
    if issuer_id is None:
        return None, None

    target_id = _region_controller(theater, region_id)
    fp = theater.pressure.faction(issuer_id)
    intensity = fp.intensity if fp else None
    deadline = (
        fp.deadline_turn if (fp and fp.deadline_turn is not None) else theater.pressure.global_deadline_turn
    )
    remaining = max(0, deadline - theater.current_turn) if deadline is not None else None

    track = _credibility_track(theater, issuer_id, target_id) if target_id and target_id != issuer_id else None

    ctx = PoliticalContext(
        issuer_pressure=intensity,
        issuer_deadline_turns_remaining=remaining,
        bilateral_credibility_immediate=track.immediate if track else None,
        bilateral_credibility_resolve=track.resolve if track else None,
        issuer_faction_id=issuer_id,
        target_faction_id=target_id,
    )
    return ctx, target_id


def _region_controller(theater: Theater, region_id: str) -> str | None:
    for t in theater.territories:
        if t.id == region_id:
            return t.faction_id
    for o in theater.oblasts:
        if o.id == region_id:
            return o.faction_id
    return None


def _credibility_track(
    theater: Theater, from_id: str, to_id: str | None
) -> CredibilityTrack | None:
    if to_id is None:
        return None
    for t in theater.credibility:
        if t.from_faction_id == from_id and t.to_faction_id == to_id:
            return t
    return None


def _faction_name(theater: Theater, faction_id: str | None) -> str | None:
    if faction_id is None:
        return None
    for f in theater.factions:
        if f.id == faction_id:
            return f.name
    return faction_id


def _region_name(theater: Theater, region_id: str) -> str:
    for t in theater.territories:
        if t.id == region_id:
            return t.name
    for o in theater.oblasts:
        if o.id == region_id:
            return o.name
    return region_id


# ---------------------------------------------------------------------------
# Per-row builders
# ---------------------------------------------------------------------------


def _row_for(
    *,
    item: BreakdownItem,
    action: Action,
    region: RegionIntel,
    region_name: str,
    political: PoliticalContext | None,
    theater: Theater,
    issuer_id: str | None,
    issuer_name: str | None,
    target_id: str | None,
    target_name: str | None,
) -> dict[str, Any]:
    key = item.key or _infer_key(item)
    base = {
        "key": key,
        "label": item.label,
        "delta": round(item.delta, 4),
        "kind": item.kind,
    }

    if key == "base":
        return {
            **base,
            "summary": (
                f"{action.name}'s baseline odds, before any local intel or "
                f"political factors. The catalog assigns {round(action.base_rate * 100)}% "
                f"as a doctrinal starting point for this kind of move."
            ),
            "math": f"base_rate = {action.base_rate:.2f}",
            "sources": [
                {
                    "label": "Action catalog",
                    "kind": "action_catalog",
                    "url": None,
                    "note": action.description,
                }
            ],
        }

    if key == "morale":
        return _morale_row(item, action, region, region_name)
    if key == "trend":
        return _trend_row(item, action, region, region_name)
    if key == "severity":
        return _severity_row(item, action, region, region_name)
    if key.startswith("cat:"):
        return _category_row(item, action, region, region_name, key)
    if key == "pressure":
        return _pressure_row(item, action, political, theater, issuer_id, issuer_name)
    if key == "credibility":
        return _credibility_row(
            item, action, political, theater, issuer_id, issuer_name, target_id, target_name
        )

    # Unknown key: still return a usable row.
    return {
        **base,
        "summary": item.label,
        "math": "",
        "sources": [],
    }


def _infer_key(item: BreakdownItem) -> str:
    if item.kind == "base":
        return "base"
    return item.label.replace(" ", "_")


# --- intel rows ------------------------------------------------------------


def _morale_row(
    item: BreakdownItem, action: Action, region: RegionIntel, region_name: str
) -> dict[str, Any]:
    score = round(region.morale_score)
    norm = (region.morale_score - 50.0) / 50.0
    band = (
        "high (population behind the controlling faction)"
        if norm >= 0.4
        else "low (population restless or hostile)"
        if norm <= -0.4
        else "neutral (neither rallying nor turning)"
    )
    direction = "supports" if (item.delta >= 0 and action.morale_weight >= 0) or (item.delta < 0 and action.morale_weight < 0) else "works against"
    summary = (
        f"Local population sentiment in {region_name} reads {score}/100, "
        f"which the morale model classifies as {band}. {action.name} treats "
        f"morale with a weight of {action.morale_weight:+.2f}, which {direction} "
        f"this action in this region."
    )
    math = (
        f"morale_norm = (score - 50) / 50 = {norm:+.2f}; "
        f"contribution = morale_norm × {action.morale_weight:+.2f} = {item.delta:+.3f}"
    )
    return {
        "key": item.key or "morale",
        "label": item.label,
        "delta": round(item.delta, 4),
        "kind": item.kind,
        "summary": summary,
        "math": math,
        "sources": _events_to_sources(_top_events(region.recent_events, 3)),
        "data": {
            "morale_score": region.morale_score,
            "morale_norm": norm,
            "morale_weight": action.morale_weight,
            "morale_trend": region.morale_trend,
            "history": list(region.history),
        },
    }


def _trend_row(
    item: BreakdownItem, action: Action, region: RegionIntel, region_name: str
) -> dict[str, Any]:
    summary = (
        f"Morale in {region_name} is {region.morale_trend} (delta "
        f"{region.trend_delta:+.1f} score points over the last window). "
        f"{action.name} weights trend at {action.trend_weight:+.2f}, "
        f"so a {region.morale_trend} trend nudges the odds "
        f"{'up' if item.delta >= 0 else 'down'}."
    )
    math = (
        f"trend_signed × {action.trend_weight:+.2f} = {item.delta:+.3f}"
    )
    return {
        "key": item.key or "trend",
        "label": item.label,
        "delta": round(item.delta, 4),
        "kind": item.kind,
        "summary": summary,
        "math": math,
        "sources": _events_to_sources(_top_events(region.recent_events, 3)),
        "data": {
            "morale_trend": region.morale_trend,
            "trend_delta": region.trend_delta,
            "trend_weight": action.trend_weight,
        },
    }


def _severity_row(
    item: BreakdownItem, action: Action, region: RegionIntel, region_name: str
) -> dict[str, Any]:
    severity_sum = sum(d.contribution for d in region.drivers)
    severity_norm = max(-1.0, min(1.0, severity_sum / SEVERITY_DIVISOR))
    summary = (
        f"Recent classified events in {region_name} net out to a severity "
        f"of {severity_sum:+.1f} score units. {action.name} responds to "
        f"this kind of churn with weight {action.severity_weight:+.2f}, so "
        f"the cumulative effect is {item.delta:+.1%}."
    )
    math = (
        f"severity_sum = sum(driver.contribution) = {severity_sum:+.2f}; "
        f"severity_norm = clamp(severity_sum / {SEVERITY_DIVISOR:.1f}) = {severity_norm:+.2f}; "
        f"contribution = severity_norm × {action.severity_weight:+.2f} = {item.delta:+.3f}"
    )
    return {
        "key": item.key or "severity",
        "label": item.label,
        "delta": round(item.delta, 4),
        "kind": item.kind,
        "summary": summary,
        "math": math,
        "sources": _events_to_sources(_top_events(region.recent_events, 5)),
        "data": {
            "severity_sum": severity_sum,
            "severity_norm": severity_norm,
            "severity_weight": action.severity_weight,
            "drivers": [d.to_dict() for d in region.drivers],
        },
    }


def _category_row(
    item: BreakdownItem, action: Action, region: RegionIntel, region_name: str, key: str
) -> dict[str, Any]:
    cat_value = key.split(":", 1)[1]
    try:
        category = EventCategory(cat_value)
    except ValueError:
        category = None
    sensitivity = action.category_sensitivities.get(category, 0.0) if category else 0.0
    driver = next((d for d in region.drivers if category and d.category is category), None)
    cat_label = category.value.replace("_", " ") if category else cat_value

    summary = (
        f"\"{item.label}\" came up as a top driver in {region_name}: an event "
        f"in the {cat_label} category contributed {driver.contribution:+.1f} "
        f"to local morale. {action.name} is sensitive to this category at "
        f"{sensitivity:+.2f}, which translates into a {item.delta:+.1%} effect "
        f"on the success estimate."
    ) if driver else (
        f"The {cat_label} category influences {action.name} at sensitivity "
        f"{sensitivity:+.2f}, contributing {item.delta:+.1%} in {region_name}."
    )

    math = f"sign(category) × intensity × {sensitivity:+.2f} = {item.delta:+.3f}"

    sources: list[dict[str, Any]] = []
    if driver:
        ev = next((e for e in region.recent_events if e.id == driver.event_id), None)
        if ev:
            sources.append(_event_to_source(ev))
        elif driver.headline:
            sources.append({"label": driver.headline, "url": None, "kind": "intel_event"})

    return {
        "key": key,
        "label": item.label,
        "delta": round(item.delta, 4),
        "kind": item.kind,
        "summary": summary,
        "math": math,
        "sources": sources,
        "data": {
            "category": cat_value,
            "sensitivity": sensitivity,
            "driver": driver.to_dict() if driver else None,
        },
    }


# --- political rows --------------------------------------------------------


def _pressure_row(
    item: BreakdownItem,
    action: Action,
    political: PoliticalContext | None,
    theater: Theater,
    issuer_id: str | None,
    issuer_name: str | None,
) -> dict[str, Any]:
    fp = theater.pressure.faction(issuer_id) if issuer_id else None
    drivers = list(fp.drivers) if fp else []
    intensity = fp.intensity if fp else (political.issuer_pressure if political else 0.0)
    deadline = fp.deadline_turn if (fp and fp.deadline_turn is not None) else theater.pressure.global_deadline_turn
    remaining = political.issuer_deadline_turns_remaining if political else None
    bias = action.pressure_aggression_bias

    deadline_phrase = (
        f"with {remaining} turn{'s' if remaining != 1 else ''} until the "
        f"scenario deadline (T-{remaining})"
        if remaining is not None
        else "with no fixed scenario deadline"
    )

    drivers_phrase = (
        f"Pressure is being driven by: {', '.join(drivers)}." if drivers else
        "No specific drivers attached to this pressure entry."
    )

    aggressive = bias > 0
    direction = "boosts" if (item.delta >= 0) else "suppresses"
    summary = (
        f"{issuer_name or 'Your faction'} is operating at {round(intensity * 100)}% "
        f"political pressure {deadline_phrase}. {drivers_phrase} {action.name} carries "
        f"an aggression bias of {bias:+.2f} on this scale, which means the model "
        f"{direction} the success estimate by {abs(item.delta):.1%} under the "
        f"current pressure load. In wargaming terms: leaders under a hard clock "
        f"reach for the action they've already signalled, even when the local "
        f"signals are mixed."
    )
    math = f"aggression_bias × issuer_pressure = {bias:+.2f} × {intensity:.2f} = {item.delta:+.3f}"

    sources = [
        {
            "label": "Faction pressure (scenario)",
            "kind": "scenario_assumption",
            "url": None,
            "note": "Seeded from the scenario; will be replaced by the live political signal pipeline.",
        }
    ]

    return {
        "key": item.key or "pressure",
        "label": item.label,
        "delta": round(item.delta, 4),
        "kind": item.kind,
        "summary": summary,
        "math": math,
        "sources": sources,
        "disclaimer": (
            "Pressure intensity and drivers are scenario assumptions for the "
            "current demo; the live news pipeline will replace them."
        ),
        "data": {
            "issuer_faction_id": issuer_id,
            "issuer_faction_name": issuer_name,
            "intensity": intensity,
            "deadline_turn": deadline,
            "deadline_remaining": remaining,
            "current_turn": theater.current_turn,
            # Renamed from `drivers` to disambiguate from intel drivers in the
            # FE's row-data type.
            "pressure_drivers": drivers,
            "aggression_bias": bias,
            "wargame_note": (
                "Time pressure narrows option space and rewards pre-committed "
                "courses of action; restraint gets harder as the clock runs."
            ),
        },
    }


def _credibility_row(
    item: BreakdownItem,
    action: Action,
    political: PoliticalContext | None,
    theater: Theater,
    issuer_id: str | None,
    issuer_name: str | None,
    target_id: str | None,
    target_name: str | None,
) -> dict[str, Any]:
    track = _credibility_track(theater, issuer_id, target_id) if issuer_id else None
    immediate = track.immediate if track else (political.bilateral_credibility_immediate if political else 0.0)
    resolve = track.resolve if track else (political.bilateral_credibility_resolve if political else 0.0)
    weight = action.credibility_weight

    band = (
        "your faction is currently seen as following through on its statements"
        if immediate >= 0.2
        else "your faction has burned recent credibility (statements have not "
        "been matched by actions)"
        if immediate <= -0.2
        else "your faction's statements and actions are roughly in balance"
    )

    direction = (
        "boosts" if item.delta >= 0 else "drags down"
    )

    issuer = issuer_name or "your faction"
    target = target_name or "the target faction"

    summary = (
        f"From {issuer} toward {target}, {band} (immediate track {immediate:+.2f} "
        f"on a -1..+1 scale; long-range resolve {resolve:+.2f}). {action.name} "
        f"is a coercive move, which the model weights at {weight:+.2f} against "
        f"the immediate track. The net effect {direction} the success estimate "
        f"by {abs(item.delta):.1%}. In wargaming terms: targets discount "
        f"threats from issuers who've previously bluffed, and over-react to "
        f"those who've consistently delivered."
    )
    math = f"credibility_weight × immediate = {weight:+.2f} × {immediate:+.2f} = {item.delta:+.3f}"

    gap_history: list[dict[str, Any]] = []
    if track:
        for g in list(track.history)[-5:]:
            gap_history.append(
                {
                    "turn": g.turn,
                    "signal_severity": g.signal_severity,
                    "action_severity": g.action_severity,
                    "gap": g.gap,
                    "source": g.source,
                    "note": g.note,
                }
            )

    issuer_signals = _recent_signals_from(theater.leader_signals, issuer_id, limit=5)
    sources = [_signal_to_source(s) for s in issuer_signals]
    if not sources:
        sources.append(
            {
                "label": "No recent leader signals on file for this faction",
                "kind": "leader_signal",
                "url": None,
                "note": None,
            }
        )

    all_stub = bool(issuer_signals) and all(s.source == "stub" for s in issuer_signals)
    disclaimer = (
        "All recent leader signals are demo / stub data; treat the credibility "
        "math as illustrative until live signals are connected."
        if all_stub
        else None
    )

    return {
        "key": item.key or "credibility",
        "label": item.label,
        "delta": round(item.delta, 4),
        "kind": item.kind,
        "summary": summary,
        "math": math,
        "sources": sources,
        "disclaimer": disclaimer,
        "data": {
            "issuer_faction_id": issuer_id,
            "issuer_faction_name": issuer_name,
            "target_faction_id": target_id,
            "target_faction_name": target_name,
            "immediate": immediate,
            "resolve": resolve,
            "credibility_weight": weight,
            # Renamed from `history` to disambiguate from intel `history` in
            # the FE's row-data type.
            "gap_history": gap_history,
            "recent_signals": [_signal_to_dict(s) for s in issuer_signals],
            "wargame_note": (
                "Credibility compounds: an audience that has seen you back down "
                "discounts the next threat; one that has seen you follow through "
                "over-reacts."
            ),
        },
    }


# ---------------------------------------------------------------------------
# Source helpers
# ---------------------------------------------------------------------------


def _events_to_sources(events: Sequence[Event]) -> list[dict[str, Any]]:
    return [_event_to_source(e) for e in events]


def _event_to_source(e: Event) -> dict[str, Any]:
    return {
        "label": e.headline or e.id,
        "url": e.url,
        "kind": "intel_event",
        "note": f"{e.category.value} · weight {e.weight:+.2f} · {e.source}",
        "id": e.id,
        "category": e.category.value,
        "weight": e.weight,
        "ts": e.ts.isoformat(),
        "snippet": e.snippet,
    }


def _signal_to_source(s: LeaderSignal) -> dict[str, Any]:
    return {
        "label": _short_text(s.text, 110),
        "url": s.source_url,
        "kind": "leader_signal",
        "note": (
            f"{s.type.value} · severity {s.severity:+.2f} · {s.source}"
            f"{f' · turn {s.turn}' if s.turn is not None else ''}"
        ),
        "id": s.id,
        "type": s.type.value,
        "severity": s.severity,
        "ts": s.timestamp.isoformat(),
        "source": s.source,
    }


def _signal_to_dict(s: LeaderSignal) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": s.id,
        "ts": s.timestamp.isoformat(),
        "type": s.type.value,
        "severity": s.severity,
        "text": s.text,
        "source": s.source,
    }
    if s.target_faction_id is not None:
        out["target_faction_id"] = s.target_faction_id
    if s.region_id is not None:
        out["region_id"] = s.region_id
    if s.source_url is not None:
        out["source_url"] = s.source_url
    if s.turn is not None:
        out["turn"] = s.turn
    return out


def _recent_signals_from(
    signals: Iterable[LeaderSignal], faction_id: str | None, *, limit: int
) -> list[LeaderSignal]:
    if faction_id is None:
        return []
    matching = [s for s in signals if s.speaker_faction_id == faction_id]
    matching.sort(key=lambda s: s.timestamp, reverse=True)
    return matching[:limit]


def _top_events(events: Sequence[Event], limit: int) -> list[Event]:
    ranked = sorted(events, key=lambda e: abs(e.weight), reverse=True)
    return list(ranked[:limit])


def _short_text(text: str, max_chars: int) -> str:
    text = text.strip()
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 1].rstrip() + "…"
