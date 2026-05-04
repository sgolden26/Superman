"""Tests for the implications forecaster.

Forecasts must be pure: invoking `forecast_implications` against a live
theatre must never mutate it, and must agree (modulo float precision) with
what `advance_after_batch` would write if the same batch were committed.
"""

from __future__ import annotations

import copy

from axis.domain.coordinates import Coordinate
from axis.scenarios import eastern_europe
from axis.sim.implications import forecast_implications
from axis.sim.orders import MoveOrder, OrderBatch
from axis.sim.political_engine import advance_after_batch


def _blue_ground_unit(theater):
    for unit in theater.units:
        faction = theater.faction(unit.faction_id)
        if faction.allegiance.value == "blue" and unit.domain.value == "ground":
            return unit
    raise AssertionError("no blue ground unit in seed")


def _move_batch(theater) -> OrderBatch:
    unit = _blue_ground_unit(theater)
    dest = Coordinate(lon=unit.position.lon + 0.01, lat=unit.position.lat)
    return OrderBatch(
        issuer_team="blue",
        orders=[
            MoveOrder(
                order_id="o1",
                issuer_team="blue",
                unit_id=unit.id,
                mode="foot",
                destination=dest,
            )
        ],
    )


def test_forecast_does_not_mutate_theater():
    theater = eastern_europe.build()
    initial_turn = theater.current_turn
    initial_credibility = copy.deepcopy(theater.credibility)
    initial_pressure = copy.deepcopy(theater.pressure)

    forecast_implications(theater, _move_batch(theater))

    assert theater.current_turn == initial_turn
    assert theater.credibility == initial_credibility
    assert theater.pressure == initial_pressure


def test_forecast_agrees_with_real_advance():
    """Forecast should report the same deltas a real commit would produce."""
    theater = eastern_europe.build()
    batch = _move_batch(theater)

    forecast = forecast_implications(theater, batch)

    twin = copy.deepcopy(theater)
    advance_after_batch(twin, batch)

    issuer = forecast.issuer_faction_id
    assert issuer is not None

    # Issuer-outgoing immediate values must match the real engine's writes.
    real_by_pair = {
        (t.from_faction_id, t.to_faction_id): t for t in twin.credibility
    }
    for c in forecast.credibility:
        real = real_by_pair[(c.from_faction_id, c.to_faction_id)]
        assert abs(real.immediate - c.immediate_after) < 1e-9
        assert abs(real.resolve - c.resolve_after) < 1e-9


def test_forecast_surfaces_action_severity_for_move():
    theater = eastern_europe.build()
    forecast = forecast_implications(theater, _move_batch(theater))

    assert forecast.action_severity < 0.0  # `move` is signed-aggressive
    assert forecast.gap == forecast.action_severity - forecast.signal_severity


def test_forecast_includes_at_least_one_factor():
    theater = eastern_europe.build()
    forecast = forecast_implications(theater, _move_batch(theater))
    assert len(forecast.factors) >= 1
    for f in forecast.factors:
        assert f.severity in {"info", "warn", "danger"}


def test_forecast_to_dict_is_json_friendly():
    theater = eastern_europe.build()
    forecast = forecast_implications(theater, _move_batch(theater))
    payload = forecast.to_dict()

    assert payload["issuer_team"] == "blue"
    assert isinstance(payload["credibility"], list)
    assert isinstance(payload["pressure"], list)
    assert isinstance(payload["factors"], list)
    for c in payload["credibility"]:
        assert "immediate_delta" in c
        assert "resolve_delta" in c
