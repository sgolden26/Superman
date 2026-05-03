"""Theater: the aggregate root that owns all entities for a single scenario."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING

from axis.domain.city import City
from axis.domain.coordinates import BoundingBox
from axis.domain.country import Country
from axis.domain.faction import Faction
from axis.domain.frontline import Frontline
from axis.domain.military_assets import (
    Airfield,
    AreaOfResponsibility,
    BorderCrossing,
    Depot,
    IsrCoverage,
    MissileRange,
    NavalBase,
    SupplyLine,
)
from axis.domain.oblast import Oblast
from axis.domain.political import CredibilityTrack, LeaderSignal, PressureState
from axis.domain.territory import Territory

if TYPE_CHECKING:
    from axis.units.base import Unit


@dataclass(slots=True)
class Theater:
    """The world state for a scenario at a point in time."""

    id: str
    name: str
    classification: str
    clock: datetime
    bbox: BoundingBox
    factions: list[Faction] = field(default_factory=list)
    countries: list[Country] = field(default_factory=list)
    cities: list[City] = field(default_factory=list)
    territories: list[Territory] = field(default_factory=list)
    oblasts: list[Oblast] = field(default_factory=list)
    units: "list[Unit]" = field(default_factory=list)
    depots: list[Depot] = field(default_factory=list)
    airfields: list[Airfield] = field(default_factory=list)
    naval_bases: list[NavalBase] = field(default_factory=list)
    border_crossings: list[BorderCrossing] = field(default_factory=list)
    supply_lines: list[SupplyLine] = field(default_factory=list)
    isr_coverages: list[IsrCoverage] = field(default_factory=list)
    missile_ranges: list[MissileRange] = field(default_factory=list)
    aors: list[AreaOfResponsibility] = field(default_factory=list)
    frontlines: list[Frontline] = field(default_factory=list)
    current_turn: int = 0
    pressure: PressureState = field(default_factory=PressureState)
    credibility: list[CredibilityTrack] = field(default_factory=list)
    leader_signals: list[LeaderSignal] = field(default_factory=list)

    def faction(self, faction_id: str) -> Faction:
        for f in self.factions:
            if f.id == faction_id:
                return f
        raise KeyError(f"Unknown faction: {faction_id}")

    def country(self, country_id: str) -> Country:
        for c in self.countries:
            if c.id == country_id:
                return c
        raise KeyError(f"Unknown country: {country_id}")

    def validate(self) -> None:
        """Check referential integrity. Raises on first inconsistency."""
        faction_ids = {f.id for f in self.factions}
        country_ids = {c.id for c in self.countries}
        city_ids = {c.id for c in self.cities}
        unit_ids = {u.id for u in self.units}
        region_ids = {t.id for t in self.territories} | {o.id for o in self.oblasts}

        for country in self.countries:
            if country.faction_id not in faction_ids:
                raise ValueError(
                    f"Country {country.id} references unknown faction {country.faction_id}"
                )
            if country.capital_city_id is not None and country.capital_city_id not in city_ids:
                raise ValueError(
                    f"Country {country.id} capital_city_id {country.capital_city_id} "
                    "is not in cities"
                )
        for city in self.cities:
            if city.faction_id not in faction_ids:
                raise ValueError(f"City {city.id} references unknown faction {city.faction_id}")
            if city.country_id is not None and city.country_id not in country_ids:
                raise ValueError(
                    f"City {city.id} references unknown country {city.country_id}"
                )
        for terr in self.territories:
            if terr.faction_id not in faction_ids:
                raise ValueError(
                    f"Territory {terr.id} references unknown faction {terr.faction_id}"
                )
            if terr.country_id is not None and terr.country_id not in country_ids:
                raise ValueError(
                    f"Territory {terr.id} references unknown country {terr.country_id}"
                )
        for unit in self.units:
            if unit.faction_id not in faction_ids:
                raise ValueError(f"Unit {unit.id} references unknown faction {unit.faction_id}")
            if unit.country_id is not None and unit.country_id not in country_ids:
                raise ValueError(
                    f"Unit {unit.id} references unknown country {unit.country_id}"
                )
        for o in self.oblasts:
            if o.country_id not in country_ids:
                raise ValueError(f"Oblast {o.id} references unknown country {o.country_id}")
            if o.faction_id not in faction_ids:
                raise ValueError(f"Oblast {o.id} references unknown faction {o.faction_id}")
            if o.capital_city_id is not None and o.capital_city_id not in city_ids:
                raise ValueError(
                    f"Oblast {o.id} capital_city_id {o.capital_city_id} is not in cities"
                )
        for assets, label in (
            (self.depots, "Depot"),
            (self.airfields, "Airfield"),
            (self.naval_bases, "NavalBase"),
            (self.border_crossings, "BorderCrossing"),
            (self.supply_lines, "SupplyLine"),
            (self.isr_coverages, "IsrCoverage"),
            (self.missile_ranges, "MissileRange"),
            (self.aors, "AOR"),
        ):
            for a in assets:
                if a.faction_id not in faction_ids:
                    raise ValueError(f"{label} {a.id} unknown faction {a.faction_id}")
                country_id = getattr(a, "country_id", None)
                if country_id is not None and country_id not in country_ids:
                    raise ValueError(f"{label} {a.id} unknown country {country_id}")
        for cr in self.border_crossings:
            for cid in cr.countries:
                if cid not in country_ids:
                    raise ValueError(
                        f"BorderCrossing {cr.id} references unknown country {cid}"
                    )
        for aor in self.aors:
            if aor.formation_id is not None and aor.formation_id not in unit_ids:
                raise ValueError(
                    f"AOR {aor.id} formation_id {aor.formation_id} is not a unit"
                )

        for fp in self.pressure.factions:
            if fp.faction_id not in faction_ids:
                raise ValueError(
                    f"FactionPressure references unknown faction {fp.faction_id}"
                )
        for rp in self.pressure.regions:
            if rp.region_id not in region_ids:
                raise ValueError(
                    f"RegionPressure references unknown region {rp.region_id}"
                )
        for track in self.credibility:
            if track.from_faction_id not in faction_ids:
                raise ValueError(
                    f"CredibilityTrack from_faction {track.from_faction_id} is unknown"
                )
            if track.to_faction_id not in faction_ids:
                raise ValueError(
                    f"CredibilityTrack to_faction {track.to_faction_id} is unknown"
                )
        for sig in self.leader_signals:
            if sig.speaker_faction_id not in faction_ids:
                raise ValueError(
                    f"LeaderSignal {sig.id} speaker {sig.speaker_faction_id} is unknown"
                )
            if (
                sig.target_faction_id is not None
                and sig.target_faction_id not in faction_ids
            ):
                raise ValueError(
                    f"LeaderSignal {sig.id} target {sig.target_faction_id} is unknown"
                )
            if sig.region_id is not None and sig.region_id not in region_ids:
                raise ValueError(
                    f"LeaderSignal {sig.id} region {sig.region_id} is unknown"
                )
