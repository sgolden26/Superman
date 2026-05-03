"""Phase 9 political-layer tests.

Covers:

- Domain dataclasses validate their numeric ranges.
- Backend evaluator produces extra breakdown rows under pressure / credibility
  context, and the probability shifts in the expected direction.
- Sim hook records a `GapEvent` on the issuer's outgoing tracks and advances
  pressure when a batch executes successfully.
- Stub leader-statement adapter loads the seeded JSON.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from axis.decision.actions import DEFAULT_ACTIONS
from axis.decision.evaluator import PoliticalContext, evaluate
from axis.domain.coordinates import Coordinate
from axis.domain.political import (
    CredibilityTrack,
    FactionPressure,
    GapEvent,
    LeaderSignal,
    LeaderSignalType,
    PressureState,
    RegionPressure,
)
from axis.intel.credibility import CredibilityEngine, update_track
from axis.intel.leader_statements import StubAdapter, cameo_to_signal_type
from axis.intel.morale import aggregate_region
from axis.scenarios import eastern_europe
from axis.sim.orders import MoveOrder, OrderBatch
from axis.sim.political_engine import advance_after_batch


def _action(id_: str):
    for a in DEFAULT_ACTIONS:
        if a.id == id_:
            return a
    raise KeyError(id_)


# ---------------------------------------------------------------------------
# Domain validation
# ---------------------------------------------------------------------------


def test_faction_pressure_range_validation():
    with pytest.raises(ValueError):
        FactionPressure(faction_id="ru", intensity=1.5)
    fp = FactionPressure(faction_id="ru", intensity=0.5, deadline_turn=8)
    assert fp.intensity == 0.5


def test_region_pressure_range_validation():
    with pytest.raises(ValueError):
        RegionPressure(region_id="terr.x", intensity=-0.1)


def test_leader_signal_severity_and_goldstein_validation():
    base = dict(
        id="sig.x",
        timestamp=datetime(2026, 4, 24, tzinfo=timezone.utc),
        speaker_faction_id="ru",
        type=LeaderSignalType.THREAT,
        text="x",
    )
    with pytest.raises(ValueError):
        LeaderSignal(severity=1.5, **base)
    with pytest.raises(ValueError):
        LeaderSignal(severity=0.0, goldstein=12.0, **base)
    sig = LeaderSignal(severity=-0.5, goldstein=-5.0, **base)
    assert sig.severity == -0.5


def test_credibility_track_self_reference_rejected():
    with pytest.raises(ValueError):
        CredibilityTrack(from_faction_id="ru", to_faction_id="ru")


def test_pressure_state_lookup_helpers():
    fps = (FactionPressure(faction_id="ru", intensity=0.6),)
    rps = (RegionPressure(region_id="terr.x", intensity=0.4),)
    p = PressureState(global_deadline_turn=10, factions=fps, regions=rps)
    assert p.faction("ru") is fps[0]
    assert p.faction("missing") is None
    assert p.region("terr.x") is rps[0]
    assert p.region("missing") is None


# ---------------------------------------------------------------------------
# Evaluator: political context
# ---------------------------------------------------------------------------


def test_evaluator_pressure_context_pushes_aggressive_action_higher():
    now = datetime(2026, 4, 25, 12, 0, tzinfo=timezone.utc)
    region = aggregate_region("terr.x", [], now=now)
    deploy = _action("deploy_troops")

    base = evaluate(deploy, region)
    pressured = evaluate(
        deploy,
        region,
        PoliticalContext(
            issuer_pressure=0.8,
            issuer_deadline_turns_remaining=2,
            issuer_faction_id="ru",
        ),
    )
    assert pressured.probability > base.probability
    assert any("deadline pressure" in b.label for b in pressured.breakdown)


def test_evaluator_negative_credibility_lowers_coercive_action():
    now = datetime(2026, 4, 25, 12, 0, tzinfo=timezone.utc)
    region = aggregate_region("terr.x", [], now=now)
    deploy = _action("deploy_troops")

    base = evaluate(deploy, region)
    bad = evaluate(
        deploy,
        region,
        PoliticalContext(
            bilateral_credibility_immediate=-0.6,
            issuer_faction_id="ru",
            target_faction_id="ua",
        ),
    )
    assert bad.probability < base.probability
    assert any("credibility" in b.label.lower() for b in bad.breakdown)


# ---------------------------------------------------------------------------
# Credibility update math
# ---------------------------------------------------------------------------


def test_update_track_perfect_consistency_pulls_immediate_up():
    t0 = CredibilityTrack(from_faction_id="ru", to_faction_id="ua")
    t1 = update_track(
        t0,
        signal_severity=-0.5,
        action_severity=-0.5,
        turn=1,
        source="test",
    )
    assert t1.immediate > t0.immediate
    assert t1.last_updated_turn == 1
    assert len(t1.history) == 1
    assert isinstance(t1.history[0], GapEvent)
    assert t1.history[0].gap == pytest.approx(0.0)


def test_update_track_inconsistent_action_pushes_immediate_down():
    t0 = CredibilityTrack(from_faction_id="ru", to_faction_id="ua", immediate=0.5)
    t1 = update_track(
        t0,
        signal_severity=-0.9,  # threatened
        action_severity=0.0,   # backed off
        turn=1,
        source="test",
    )
    assert t1.immediate < t0.immediate


# ---------------------------------------------------------------------------
# Sim hook end-to-end
# ---------------------------------------------------------------------------


def test_apply_batch_advances_political_layer():
    theater = eastern_europe.build()
    initial_turn = theater.current_turn

    # Pick the first ground unit we can find that belongs to a blue faction.
    blue_unit = None
    for unit in theater.units:
        faction = theater.faction(unit.faction_id)
        if faction.allegiance.value == "blue" and unit.domain.value == "ground":
            blue_unit = unit
            break
    assert blue_unit is not None, "expected at least one blue ground unit in seed"

    # Move 1 km to the east; well within foot range.
    dest = Coordinate(lon=blue_unit.position.lon + 0.01, lat=blue_unit.position.lat)
    order = MoveOrder(
        order_id="o1",
        issuer_team="blue",
        unit_id=blue_unit.id,
        mode="foot",
        destination=dest,
    )
    batch = OrderBatch(issuer_team="blue", orders=[order])
    result = batch.execute(theater)
    assert result.ok, result.outcomes

    new_turn = advance_after_batch(theater, batch)
    assert new_turn == initial_turn + 1
    assert theater.current_turn == new_turn

    # The blue primary faction (`ua`) must have at least one outgoing track
    # whose history grew or whose `last_updated_turn` matches the new turn.
    ua_outgoing = [t for t in theater.credibility if t.from_faction_id == "ua"]
    assert any(t.last_updated_turn == new_turn for t in ua_outgoing)


def test_failed_batch_does_not_advance_turn():
    """Validation failure must leave the political clock untouched."""
    from axis.server.state import TheaterStore

    store = TheaterStore()
    initial = store.snapshot_dict()["current_turn"]

    bad_batch_payload = {
        "issuer_team": "blue",
        "orders": [
            {
                "order_id": "bad",
                "kind": "move",
                "issuer_team": "blue",
                "unit_id": "unit.does-not-exist",
                "mode": "foot",
                "destination": [30.0, 50.0],
            }
        ],
    }
    batch = OrderBatch.from_dict(bad_batch_payload)
    result, snap = store.apply_batch(batch)
    assert result.ok is False
    assert snap["current_turn"] == initial


# ---------------------------------------------------------------------------
# CredibilityEngine: only issuer's tracks get the update; others decay
# ---------------------------------------------------------------------------


def test_credibility_engine_decays_other_factions():
    theater = eastern_europe.build()

    # Snapshot pre-existing nato→ru immediate value.
    pre = next(
        t for t in theater.credibility if t.from_faction_id == "nato" and t.to_faction_id == "ru"
    )

    CredibilityEngine(theater).record_action(
        issuer_faction_id="ua",
        signal_severity=-0.5,
        action_severity=-0.5,
        turn=1,
    )

    post = next(
        t for t in theater.credibility if t.from_faction_id == "nato" and t.to_faction_id == "ru"
    )
    # Decay pulls toward 0; pre is negative so post should be greater (closer to 0).
    assert post.immediate > pre.immediate
    assert post.last_updated_turn == 1


# ---------------------------------------------------------------------------
# Leader-statement adapter
# ---------------------------------------------------------------------------


def test_stub_adapter_loads_seeded_signals():
    adapter = StubAdapter()
    sigs = adapter.fetch()
    assert len(sigs) >= 1
    assert all(isinstance(s, LeaderSignal) for s in sigs)
    assert all(-1.0 <= s.severity <= 1.0 for s in sigs)


def test_cameo_to_signal_type_known_codes():
    assert cameo_to_signal_type("172") == LeaderSignalType.ULTIMATUM
    assert cameo_to_signal_type("138") == LeaderSignalType.THREAT
    assert cameo_to_signal_type("057") == LeaderSignalType.REASSURANCE
    assert cameo_to_signal_type(None) == LeaderSignalType.COMMITMENT
    assert cameo_to_signal_type("999") == LeaderSignalType.COMMITMENT
