from datetime import datetime, timedelta, timezone

from axis.decision.actions import DEFAULT_ACTIONS
from axis.decision.evaluator import P_CEIL, P_FLOOR, evaluate
from axis.intel.events import Event, EventCategory
from axis.intel.morale import aggregate_region


def _action(id_: str):
    for a in DEFAULT_ACTIONS:
        if a.id == id_:
            return a
    raise KeyError(id_)


def _events_for(category: EventCategory, *, weight: float, count: int, now: datetime, region: str = "terr.x"):
    return [
        Event(
            id=f"e{i}",
            region_id=region,
            ts=now - timedelta(hours=2 + i),
            category=category,
            headline=f"event {i}",
            snippet="",
            weight=weight,
            source="curated",
        )
        for i in range(count)
    ]


def test_baseline_when_no_events():
    now = datetime(2026, 4, 25, 12, 0, tzinfo=timezone.utc)
    region = aggregate_region("terr.x", [], now=now)
    out = evaluate(_action("deploy_troops"), region)
    assert P_FLOOR <= out.probability <= P_CEIL
    assert abs(out.probability - 0.65) < 1e-6
    assert out.breakdown[0].kind == "base"


def test_protests_lower_deploy_troops_probability():
    now = datetime(2026, 4, 25, 12, 0, tzinfo=timezone.utc)
    events = _events_for(EventCategory.PROTEST, weight=-0.7, count=4, now=now)
    region = aggregate_region("terr.x", events, now=now)
    out = evaluate(_action("deploy_troops"), region)
    assert out.probability < 0.65
    assert any(b.kind == "category" and b.delta < 0 for b in out.breakdown)


def test_protests_raise_impose_sanctions_probability():
    now = datetime(2026, 4, 25, 12, 0, tzinfo=timezone.utc)
    events = _events_for(EventCategory.PROTEST, weight=-0.7, count=4, now=now)
    region = aggregate_region("terr.x", events, now=now)
    out = evaluate(_action("impose_sanctions"), region)
    assert out.probability > 0.60


def test_probability_clamped_within_floor_and_ceil():
    now = datetime(2026, 4, 25, 12, 0, tzinfo=timezone.utc)
    bad = _events_for(EventCategory.MILITARY_LOSS, weight=-1.0, count=20, now=now)
    region = aggregate_region("terr.x", bad, now=now)
    out = evaluate(_action("escalate_conflict"), region)
    assert out.probability >= P_FLOOR

    good = _events_for(EventCategory.NATIONALIST_SENTIMENT, weight=1.0, count=20, now=now)
    region = aggregate_region("terr.x", good, now=now)
    out = evaluate(_action("conduct_surveillance"), region)
    assert out.probability <= P_CEIL


def test_explanation_mentions_probability():
    now = datetime(2026, 4, 25, 12, 0, tzinfo=timezone.utc)
    events = _events_for(EventCategory.PROTEST, weight=-0.7, count=3, now=now)
    region = aggregate_region("terr.x", events, now=now)
    out = evaluate(_action("deploy_troops"), region)
    assert "%" in out.explanation
