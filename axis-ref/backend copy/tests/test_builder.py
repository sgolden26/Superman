from axis.domain.faction import Allegiance
from axis.factories.scenario_builder import ScenarioBuilder
from axis.units.domain import UnitKind


def test_builder_assembles_minimal_theater():
    theater = (
        ScenarioBuilder("t1", "Test")
        .with_bbox(0.0, 0.0, 10.0, 10.0)
        .add_faction("blue", "Blue", Allegiance.BLUE, "#5aa9ff")
        .add_city("city.a", "Alpha", "blue", 1.0, 1.0, 1000, "minor")
        .add_unit(
            kind=UnitKind.INFANTRY_BRIGADE,
            id="unit.blue.inf-1",
            name="1 Inf Bde",
            faction_id="blue",
            lon=1.5,
            lat=1.5,
        )
        .build()
    )
    assert theater.id == "t1"
    assert theater.cities[0].name == "Alpha"
    assert theater.units[0].kind is UnitKind.INFANTRY_BRIGADE
