"""Registered constructors that hydrate a seeded `Theater`."""

from typing import Callable

from superman.domain.theater import Theater
from superman.scenarios import eastern_europe

ScenarioBuilderFn = Callable[[], Theater]

SCENARIOS: dict[str, ScenarioBuilderFn] = {
    "eastern_europe": eastern_europe.build,
}


def get(scenario_id: str) -> ScenarioBuilderFn:
    if scenario_id not in SCENARIOS:
        raise KeyError(
            f"Unknown scenario {scenario_id!r}. Known: {sorted(SCENARIOS)}"
        )
    return SCENARIOS[scenario_id]
