"""Morale aggregator.

Turns a list of `Event`s into a `RegionIntel` snapshot. Pure functions; no
I/O. Mirrored on the FE only for visualisation - the canonical numbers come
from this module.

Formula (must match `docs/intel.md`):

    raw       = sum(event.weight * exp(-(now - event.ts) / half_life))
    score_raw = clamp(50 + raw * SCALE, 0, 100)

with `half_life = 24h` and `SCALE = 20.0`. Trend is derived from the same
formula evaluated at `now - WINDOW`. History is the last 6 samples at the
same `WINDOW` cadence.
"""

from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Iterable, Sequence

from axis.intel.events import Event, EventCategory

HALF_LIFE_HOURS = 24.0
SCALE = 20.0
WINDOW_HOURS = 12.0
HISTORY_SAMPLES = 6
TREND_RISING_THRESHOLD = 1.5
TREND_DECLINING_THRESHOLD = -1.5
TOP_DRIVERS = 3
RECENT_EVENTS_PER_REGION = 6


@dataclass(frozen=True, slots=True)
class Driver:
    """One category's net contribution to a region's morale at `now`."""

    category: EventCategory
    contribution: float  # signed score units (already scaled by SCALE)
    headline: str
    event_id: str

    def to_dict(self) -> dict[str, object]:
        return {
            "category": self.category.value,
            "contribution": round(self.contribution, 3),
            "headline": self.headline,
            "event_id": self.event_id,
        }


@dataclass(frozen=True, slots=True)
class RegionIntel:
    region_id: str
    morale_score: float  # 0..100
    morale_trend: str  # rising | steady | declining
    trend_delta: float  # signed score units
    history: tuple[float, ...]  # oldest -> newest, len == HISTORY_SAMPLES
    drivers: tuple[Driver, ...]
    recent_events: tuple[Event, ...]

    def to_dict(self) -> dict[str, object]:
        return {
            "region_id": self.region_id,
            "morale_score": round(self.morale_score, 1),
            "morale_trend": self.morale_trend,
            "trend_delta": round(self.trend_delta, 2),
            "history": [round(s, 1) for s in self.history],
            "drivers": [d.to_dict() for d in self.drivers],
            "recent_events": [e.to_dict() for e in self.recent_events],
        }


@dataclass(frozen=True, slots=True)
class IntelSnapshot:
    intel_schema_version: str
    generated_at: datetime
    source: str
    tick_seq: int
    regions: tuple[RegionIntel, ...]

    def to_dict(self) -> dict[str, object]:
        return {
            "intel_schema_version": self.intel_schema_version,
            "generated_at": self.generated_at.isoformat(),
            "source": self.source,
            "tick_seq": self.tick_seq,
            "regions": [r.to_dict() for r in self.regions],
        }


def _decay(age_hours: float) -> float:
    """exp(-age / half_life). Events that haven't happened yet (age < 0)
    contribute zero - this matters for trend, where we re-evaluate the
    aggregator at `now - WINDOW`."""
    if age_hours < 0:
        return 0.0
    return math.exp(-age_hours / HALF_LIFE_HOURS)


def _score_raw_at(events: Sequence[Event], now: datetime) -> float:
    """Compute the *normalised* morale score (0..100) at a given `now`."""
    raw = 0.0
    for e in events:
        age_hours = (now - e.ts).total_seconds() / 3600.0
        raw += e.weight * _decay(age_hours)
    return _clamp(50.0 + raw * SCALE, 0.0, 100.0)


def _clamp(x: float, lo: float, hi: float) -> float:
    if x < lo:
        return lo
    if x > hi:
        return hi
    return x


def _trend_label(delta: float) -> str:
    if delta >= TREND_RISING_THRESHOLD:
        return "rising"
    if delta <= TREND_DECLINING_THRESHOLD:
        return "declining"
    return "steady"


def aggregate_region(
    region_id: str,
    events: Sequence[Event],
    *,
    now: datetime,
) -> RegionIntel:
    """Aggregate events for a single region into a RegionIntel snapshot."""
    score_now = _score_raw_at(events, now)
    score_then = _score_raw_at(events, now - timedelta(hours=WINDOW_HOURS))
    trend_delta = score_now - score_then
    trend = _trend_label(trend_delta)

    history: list[float] = []
    for k in range(HISTORY_SAMPLES - 1, -1, -1):
        sample_now = now - timedelta(hours=WINDOW_HOURS * k)
        history.append(_score_raw_at(events, sample_now))

    drivers = _top_drivers(events, now)
    recent = _select_recent_events(events, now)

    return RegionIntel(
        region_id=region_id,
        morale_score=score_now,
        morale_trend=trend,
        trend_delta=trend_delta,
        history=tuple(history),
        drivers=tuple(drivers),
        recent_events=tuple(recent),
    )


def _top_drivers(events: Sequence[Event], now: datetime) -> list[Driver]:
    """Sum decay-weighted contributions by category; pick top |contribution|."""
    by_cat: dict[EventCategory, float] = defaultdict(float)
    leader: dict[EventCategory, tuple[float, Event]] = {}
    for e in events:
        age = (now - e.ts).total_seconds() / 3600.0
        contribution = e.weight * _decay(age) * SCALE
        by_cat[e.category] += contribution
        prev = leader.get(e.category)
        if prev is None or abs(contribution) > abs(prev[0]):
            leader[e.category] = (contribution, e)

    ranked = sorted(by_cat.items(), key=lambda kv: abs(kv[1]), reverse=True)
    drivers: list[Driver] = []
    for category, contribution in ranked[:TOP_DRIVERS]:
        if abs(contribution) < 0.1:
            continue
        _, hero = leader[category]
        drivers.append(
            Driver(
                category=category,
                contribution=contribution,
                headline=hero.headline,
                event_id=hero.id,
            )
        )
    return drivers


def _select_recent_events(events: Sequence[Event], now: datetime) -> list[Event]:
    """Pick the events with the largest decay-weighted absolute weight."""
    scored: list[tuple[float, Event]] = []
    for e in events:
        age = (now - e.ts).total_seconds() / 3600.0
        scored.append((abs(e.weight) * _decay(age), e))
    scored.sort(key=lambda x: x[0], reverse=True)
    top = [e for _, e in scored[:RECENT_EVENTS_PER_REGION]]
    top.sort(key=lambda e: e.ts, reverse=True)
    return top


def aggregate_all(
    region_ids: Iterable[str],
    events: Sequence[Event],
    *,
    now: datetime,
) -> list[RegionIntel]:
    """Aggregate per-region intel for every requested region (even empty ones)."""
    by_region: dict[str, list[Event]] = defaultdict(list)
    for e in events:
        by_region[e.region_id].append(e)

    out: list[RegionIntel] = []
    for rid in region_ids:
        out.append(aggregate_region(rid, by_region.get(rid, []), now=now))
    return out
