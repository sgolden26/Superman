import json
from pathlib import Path

from axis import SCHEMA_VERSION, scenarios
from axis.serialization.snapshot import SnapshotExporter


def test_eastern_europe_snapshot_shape(tmp_path: Path):
    theater = scenarios.get("eastern_europe")()
    exporter = SnapshotExporter(theater)
    out = tmp_path / "state.json"
    exporter.write(out)

    payload = json.loads(out.read_text())
    assert payload["schema_version"] == SCHEMA_VERSION
    assert payload["scenario"]["id"] == "eastern_europe"

    faction_ids = {f["id"] for f in payload["factions"]}
    assert {"ua", "ru", "nato"} <= faction_ids

    country_ids = {c["id"] for c in payload["countries"]}
    assert {"ru", "ua", "by"} <= country_ids

    assert len(payload["cities"]) >= 20
    assert len(payload["oblasts"]) >= 25
    assert len(payload["units"]) >= 80

    for u in payload["units"]:
        assert u["domain"] in {"ground", "air", "naval"}
        for key in ("strength", "readiness", "morale"):
            assert 0.0 <= u[key] <= 1.0

    for arr in (
        "depots",
        "airfields",
        "naval_bases",
        "border_crossings",
        "supply_lines",
        "isr_coverages",
        "missile_ranges",
        "aors",
        "frontlines",
    ):
        assert arr in payload, f"missing array: {arr}"
        assert len(payload[arr]) >= 1, f"array empty: {arr}"

    # referential integrity: every entity faction_id resolves
    for arr in (
        "cities",
        "oblasts",
        "units",
        "depots",
        "airfields",
        "naval_bases",
        "border_crossings",
        "supply_lines",
        "isr_coverages",
        "missile_ranges",
        "aors",
    ):
        for item in payload[arr]:
            assert item["faction_id"] in faction_ids, (
                f"{arr}:{item['id']} references unknown faction {item['faction_id']!r}"
            )

    city_ids = {c["id"] for c in payload["cities"]}
    for c in payload["countries"]:
        cap = c.get("capital_city_id")
        if cap is not None:
            assert cap in city_ids, f"country {c['id']} capital {cap} missing"

    unit_ids = {u["id"] for u in payload["units"]}
    for a in payload["aors"]:
        f_id = a.get("formation_id")
        if f_id is not None:
            assert f_id in unit_ids
