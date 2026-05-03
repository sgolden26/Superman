from datetime import datetime, timedelta, timezone

from axis.intel.events import Event, EventCategory
from axis.intel.morale import (
    HISTORY_SAMPLES,
    aggregate_all,
    aggregate_region,
)


def _evt(
    *,
    id: str,
    region: str,
    category: EventCategory,
    weight: float,
    age_hours: float,
    now: datetime,
    headline: str = "headline",
) -> Event:
    return Event(
        id=id,
        region_id=region,
        ts=now - timedelta(hours=age_hours),
        category=category,
        headline=headline,
        snippet="",
        weight=weight,
        source="curated",
    )


def test_no_events_yields_neutral_score():
    now = datetime(2026, 4, 25, 12, 0, tzinfo=timezone.utc)
    intel = aggregate_region("terr.x", [], now=now)
    assert intel.morale_score == 50.0
    assert intel.morale_trend == "steady"
    assert intel.trend_delta == 0.0
    assert len(intel.history) == HISTORY_SAMPLES
    assert all(s == 50.0 for s in intel.history)
    assert intel.drivers == ()


def test_negative_events_drop_score_below_50_and_decline_trend():
    now = datetime(2026, 4, 25, 12, 0, tzinfo=timezone.utc)
    events = [
        _evt(id="e1", region="terr.x", category=EventCategory.PROTEST, weight=-0.6, age_hours=2, now=now),
        _evt(id="e2", region="terr.x", category=EventCategory.MILITARY_LOSS, weight=-0.5, age_hours=4, now=now),
    ]
    intel = aggregate_region("terr.x", events, now=now)
    assert intel.morale_score < 50.0
    assert intel.morale_trend == "declining"
    assert intel.trend_delta < 0
    assert {d.category for d in intel.drivers} == {
        EventCategory.PROTEST,
        EventCategory.MILITARY_LOSS,
    }


def test_decay_makes_old_events_negligible():
    now = datetime(2026, 4, 25, 12, 0, tzinfo=timezone.utc)
    events = [
        _evt(id="old", region="terr.x", category=EventCategory.PROTEST, weight=-1.0, age_hours=240, now=now),
    ]
    intel = aggregate_region("terr.x", events, now=now)
    assert abs(intel.morale_score - 50.0) < 0.5


def test_aggregate_all_returns_one_per_requested_region():
    now = datetime(2026, 4, 25, 12, 0, tzinfo=timezone.utc)
    events = [
        _evt(id="e1", region="terr.a", category=EventCategory.NATIONALIST_SENTIMENT, weight=0.7, age_hours=3, now=now),
    ]
    out = aggregate_all(["terr.a", "terr.b"], events, now=now)
    by_id = {r.region_id: r for r in out}
    assert set(by_id) == {"terr.a", "terr.b"}
    assert by_id["terr.a"].morale_score > 50.0
    assert by_id["terr.b"].morale_score == 50.0


def test_top_driver_picks_highest_magnitude_headline():
    now = datetime(2026, 4, 25, 12, 0, tzinfo=timezone.utc)
    events = [
        _evt(
            id="small", region="terr.x", category=EventCategory.PROTEST,
            weight=-0.2, age_hours=8, now=now, headline="small protest",
        ),
        _evt(
            id="big", region="terr.x", category=EventCategory.PROTEST,
            weight=-0.9, age_hours=2, now=now, headline="huge protest",
        ),
    ]
    intel = aggregate_region("terr.x", events, now=now)
    protest_drivers = [d for d in intel.drivers if d.category == EventCategory.PROTEST]
    assert protest_drivers
    assert protest_drivers[0].event_id == "big"
    assert protest_drivers[0].headline == "huge protest"
