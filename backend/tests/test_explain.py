"""Tests for the decision-engine row explainer."""

from __future__ import annotations

from datetime import datetime, timezone

from axis.decision.actions import DEFAULT_ACTIONS
from axis.decision.explain import build_explanation, region_from_dict
from axis.intel.morale import aggregate_region
from axis.scenarios import eastern_europe


def _action(id_: str):
    for a in DEFAULT_ACTIONS:
        if a.id == id_:
            return a
    raise KeyError(id_)


def _empty_region(rid: str = "terr.x"):
    """A region with no events. Predictable evaluator output: just base + morale."""
    return aggregate_region(rid, [], now=datetime(2026, 4, 25, 12, 0, tzinfo=timezone.utc))


def test_build_explanation_emits_one_row_per_breakdown_item():
    theater = eastern_europe.build()
    deploy = _action("deploy_troops")
    region = _empty_region("terr.kyiv")

    payload = build_explanation(theater, deploy, region, "blue")

    assert payload["action_id"] == "deploy_troops"
    assert payload["issuer_team"] == "blue"
    assert payload["action_note"]  # non-empty wargame note
    assert "outcome" in payload and "rows" in payload

    outcome_rows = payload["outcome"]["breakdown"]
    rows = payload["rows"]
    assert len(rows) == len(outcome_rows)

    # Every row must have the required fields the FE relies on.
    for row in rows:
        assert "key" in row and row["key"]
        assert "label" in row
        assert "delta" in row
        assert "summary" in row and row["summary"]
        assert "math" in row
        assert isinstance(row.get("sources", []), list)


def test_explanation_includes_political_rows_and_data():
    theater = eastern_europe.build()
    deploy = _action("deploy_troops")
    region = _empty_region("terr.kyiv")

    payload = build_explanation(theater, deploy, region, "blue")
    rows_by_key = {r["key"]: r for r in payload["rows"]}

    # The Russia/Ukraine seed scenario configures ua deadline + bilateral
    # credibility, so deploy_troops (positive bias + positive cred weight)
    # should produce both political rows.
    assert "pressure" in rows_by_key, "expected a pressure row"
    pressure_row = rows_by_key["pressure"]
    assert "issuer_pressure" in pressure_row["math"] or "issuer" in pressure_row["math"].lower() or "intensity" in pressure_row["math"].lower() or "pressure" in pressure_row["math"].lower()
    assert pressure_row["data"]["intensity"] is not None
    assert "pressure_drivers" in pressure_row["data"]
    # Pressure is a scenario assumption: must carry a disclaimer.
    assert pressure_row.get("disclaimer")

    if "credibility" in rows_by_key:
        cred_row = rows_by_key["credibility"]
        assert cred_row["data"]["immediate"] is not None
        assert "recent_signals" in cred_row["data"]
        assert "gap_history" in cred_row["data"]
        # Source list always present; either real signals or a placeholder note.
        assert isinstance(cred_row["sources"], list)


def test_region_from_dict_roundtrips_minimal_fields():
    theater = eastern_europe.build()
    surveil = _action("conduct_surveillance")
    region = _empty_region("terr.kyiv")

    region_dict = region.to_dict()
    rebuilt = region_from_dict(region_dict)

    assert rebuilt.region_id == region.region_id
    assert rebuilt.morale_score == region.morale_score
    # Round trip should not crash the explain builder.
    payload = build_explanation(theater, surveil, rebuilt, "blue")
    assert payload["action_id"] == "conduct_surveillance"


def test_action_catalog_now_carries_wargame_note():
    for action in DEFAULT_ACTIONS:
        assert action.wargame_note, f"{action.id} missing wargame_note"
        assert len(action.wargame_note) <= 200


def test_breakdown_item_keys_are_stable():
    theater = eastern_europe.build()
    deploy = _action("deploy_troops")
    region = _empty_region("terr.kyiv")
    payload = build_explanation(theater, deploy, region, "blue")
    keys = {r["key"] for r in payload["rows"]}
    assert "base" in keys
    assert "morale" in keys
