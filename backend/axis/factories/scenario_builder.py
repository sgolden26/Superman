"""ScenarioBuilder: fluent builder that assembles a Theater step by step."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Self

from axis.domain.city import City, CityImportance
from axis.domain.coordinates import BoundingBox, Coordinate
from axis.domain.country import Country
from axis.domain.faction import Allegiance, Faction
from axis.domain.frontline import Frontline
from axis.domain.military_assets import (
    Airfield,
    AreaOfResponsibility,
    BorderCrossing,
    CrossingMode,
    Depot,
    IsrCoverage,
    MissileRange,
    NavalBase,
    SupplyLine,
)
from axis.domain.oblast import Oblast
from axis.domain.political import (
    CredibilityTrack,
    FactionPressure,
    LeaderSignal,
    LeaderSignalType,
    PressureState,
    RegionPressure,
)
from axis.domain.territory import Territory
from axis.domain.theater import Theater
from axis.factories.unit_factory import UnitFactory
from axis.units.base import Unit
from axis.units.domain import UnitKind


def _coords(path: list[tuple[float, float]]) -> tuple[Coordinate, ...]:
    return tuple(Coordinate(lon=lon, lat=lat) for lon, lat in path)


class ScenarioBuilder:
    """Fluent builder for a `Theater`."""

    def __init__(self, scenario_id: str, name: str) -> None:
        self._id = scenario_id
        self._name = name
        self._classification = "UNCLASSIFIED // EXERCISE"
        self._clock: datetime = datetime.now(tz=timezone.utc)
        self._bbox: BoundingBox | None = None
        self._factions: list[Faction] = []
        self._countries: list[Country] = []
        self._cities: list[City] = []
        self._territories: list[Territory] = []
        self._oblasts: list[Oblast] = []
        self._units: list[Unit] = []
        self._depots: list[Depot] = []
        self._airfields: list[Airfield] = []
        self._naval_bases: list[NavalBase] = []
        self._border_crossings: list[BorderCrossing] = []
        self._supply_lines: list[SupplyLine] = []
        self._isr_coverages: list[IsrCoverage] = []
        self._missile_ranges: list[MissileRange] = []
        self._aors: list[AreaOfResponsibility] = []
        self._frontlines: list[Frontline] = []
        self._current_turn: int = 0
        self._global_deadline_turn: int | None = None
        self._faction_pressures: list[FactionPressure] = []
        self._region_pressures: list[RegionPressure] = []
        self._credibility: list[CredibilityTrack] = []
        self._leader_signals: list[LeaderSignal] = []

    def with_classification(self, classification: str) -> Self:
        self._classification = classification
        return self

    def with_clock(self, clock: datetime) -> Self:
        self._clock = clock
        return self

    def with_bbox(self, min_lon: float, min_lat: float, max_lon: float, max_lat: float) -> Self:
        self._bbox = BoundingBox(min_lon, min_lat, max_lon, max_lat)
        return self

    def add_faction(
        self,
        id: str,
        name: str,
        allegiance: Allegiance,
        color: str,
    ) -> Self:
        self._factions.append(Faction(id=id, name=name, allegiance=allegiance, color=color))
        return self

    def add_country(self, country: Country) -> Self:
        self._countries.append(country)
        return self

    def add_city(
        self,
        id: str,
        name: str,
        faction_id: str,
        lon: float,
        lat: float,
        population: int,
        importance: str | CityImportance,
        infrastructure: tuple[str, ...] = (),
        country_id: str | None = None,
    ) -> Self:
        imp = importance if isinstance(importance, CityImportance) else CityImportance(importance)
        self._cities.append(
            City(
                id=id,
                name=name,
                faction_id=faction_id,
                position=Coordinate(lon=lon, lat=lat),
                population=population,
                importance=imp,
                infrastructure=tuple(infrastructure),
                country_id=country_id,
            )
        )
        return self

    def add_territory(
        self,
        id: str,
        name: str,
        faction_id: str,
        ring: list[tuple[float, float]],
        control: float = 1.0,
        country_id: str | None = None,
    ) -> Self:
        self._territories.append(
            Territory(
                id=id,
                name=name,
                faction_id=faction_id,
                polygon=(_coords(ring),),
                control=control,
                country_id=country_id,
            )
        )
        return self

    def add_oblast(self, oblast: Oblast) -> Self:
        self._oblasts.append(oblast)
        return self

    def add_unit(
        self,
        *,
        kind: UnitKind,
        id: str,
        name: str,
        faction_id: str,
        lon: float,
        lat: float,
        strength: float = 1.0,
        readiness: float = 1.0,
        morale: float = 1.0,
        echelon: str | None = None,
        callsign: str = "",
        country_id: str | None = None,
        available_actions: tuple[str, ...] = (),
    ) -> Self:
        unit = UnitFactory.create(
            kind=kind,
            id=id,
            name=name,
            faction_id=faction_id,
            position=Coordinate(lon=lon, lat=lat),
            strength=strength,
            readiness=readiness,
            morale=morale,
            echelon=echelon,
            callsign=callsign,
            country_id=country_id,
            available_actions=available_actions,
        )
        self._units.append(unit)
        return self

    def add_depot(
        self,
        *,
        id: str,
        name: str,
        faction_id: str,
        lon: float,
        lat: float,
        capacity: float = 0.5,
        fill: float = 0.5,
        country_id: str | None = None,
        available_actions: tuple[str, ...] = (),
    ) -> Self:
        self._depots.append(
            Depot(
                id=id,
                name=name,
                faction_id=faction_id,
                position=Coordinate(lon=lon, lat=lat),
                capacity=capacity,
                fill=fill,
                country_id=country_id,
                available_actions=available_actions,
            )
        )
        return self

    def add_airfield(
        self,
        *,
        id: str,
        name: str,
        faction_id: str,
        lon: float,
        lat: float,
        runway_m: int = 2400,
        role: str = "tactical",
        based_aircraft: int = 0,
        country_id: str | None = None,
        available_actions: tuple[str, ...] = (),
    ) -> Self:
        self._airfields.append(
            Airfield(
                id=id,
                name=name,
                faction_id=faction_id,
                position=Coordinate(lon=lon, lat=lat),
                runway_m=runway_m,
                role=role,
                based_aircraft=based_aircraft,
                country_id=country_id,
                available_actions=available_actions,
            )
        )
        return self

    def add_naval_base(
        self,
        *,
        id: str,
        name: str,
        faction_id: str,
        lon: float,
        lat: float,
        pier_count: int = 1,
        home_port_for: tuple[str, ...] = (),
        country_id: str | None = None,
        available_actions: tuple[str, ...] = (),
    ) -> Self:
        self._naval_bases.append(
            NavalBase(
                id=id,
                name=name,
                faction_id=faction_id,
                position=Coordinate(lon=lon, lat=lat),
                pier_count=pier_count,
                home_port_for=home_port_for,
                country_id=country_id,
                available_actions=available_actions,
            )
        )
        return self

    def add_border_crossing(
        self,
        *,
        id: str,
        name: str,
        faction_id: str,
        lon: float,
        lat: float,
        countries: tuple[str, str],
        mode: str | CrossingMode = CrossingMode.OPEN,
        rail: bool = False,
        road: bool = True,
        available_actions: tuple[str, ...] = (),
    ) -> Self:
        m = mode if isinstance(mode, CrossingMode) else CrossingMode(mode)
        self._border_crossings.append(
            BorderCrossing(
                id=id,
                name=name,
                faction_id=faction_id,
                position=Coordinate(lon=lon, lat=lat),
                countries=countries,
                mode=m,
                rail=rail,
                road=road,
                available_actions=available_actions,
            )
        )
        return self

    def add_supply_line(
        self,
        *,
        id: str,
        name: str,
        faction_id: str,
        path: list[tuple[float, float]],
        health: float = 1.0,
        mode: str = "road",
        from_id: str | None = None,
        to_id: str | None = None,
        available_actions: tuple[str, ...] = (),
    ) -> Self:
        self._supply_lines.append(
            SupplyLine(
                id=id,
                name=name,
                faction_id=faction_id,
                path=_coords(path),
                health=health,
                mode=mode,
                from_id=from_id,
                to_id=to_id,
                available_actions=available_actions,
            )
        )
        return self

    def add_isr(
        self,
        *,
        id: str,
        name: str,
        faction_id: str,
        lon: float,
        lat: float,
        range_km: float,
        heading_deg: float = 0.0,
        beam_deg: float = 360.0,
        platform: str = "satellite",
        confidence: float = 0.7,
        country_id: str | None = None,
        available_actions: tuple[str, ...] = (),
    ) -> Self:
        self._isr_coverages.append(
            IsrCoverage(
                id=id,
                name=name,
                faction_id=faction_id,
                origin=Coordinate(lon=lon, lat=lat),
                range_km=range_km,
                heading_deg=heading_deg,
                beam_deg=beam_deg,
                platform=platform,
                confidence=confidence,
                country_id=country_id,
                available_actions=available_actions,
            )
        )
        return self

    def add_missile_range(
        self,
        *,
        id: str,
        name: str,
        faction_id: str,
        lon: float,
        lat: float,
        range_km: float,
        weapon: str = "generic",
        category: str = "sam",
        heading_deg: float = 0.0,
        beam_deg: float = 360.0,
        country_id: str | None = None,
        available_actions: tuple[str, ...] = (),
    ) -> Self:
        self._missile_ranges.append(
            MissileRange(
                id=id,
                name=name,
                faction_id=faction_id,
                origin=Coordinate(lon=lon, lat=lat),
                range_km=range_km,
                weapon=weapon,
                category=category,
                heading_deg=heading_deg,
                beam_deg=beam_deg,
                country_id=country_id,
                available_actions=available_actions,
            )
        )
        return self

    def add_aor(
        self,
        *,
        id: str,
        name: str,
        faction_id: str,
        ring: list[tuple[float, float]],
        formation_id: str | None = None,
        country_id: str | None = None,
        available_actions: tuple[str, ...] = (),
    ) -> Self:
        self._aors.append(
            AreaOfResponsibility(
                id=id,
                name=name,
                faction_id=faction_id,
                polygon=(_coords(ring),),
                formation_id=formation_id,
                country_id=country_id,
                available_actions=available_actions,
            )
        )
        return self

    def add_frontline(
        self,
        *,
        id: str,
        name: str,
        path: list[tuple[float, float]],
        buffer_km: float = 8.0,
        updated_at: datetime | None = None,
        notes: str = "",
        available_actions: tuple[str, ...] = (),
    ) -> Self:
        self._frontlines.append(
            Frontline(
                id=id,
                name=name,
                path=_coords(path),
                buffer_km=buffer_km,
                updated_at=updated_at,
                notes=notes,
                available_actions=available_actions,
            )
        )
        return self

    # ------------------------------------------------------------------
    # Political layer (Phase 9)
    # ------------------------------------------------------------------

    def with_current_turn(self, turn: int) -> Self:
        if turn < 0:
            raise ValueError("current_turn must be non-negative")
        self._current_turn = turn
        return self

    def with_global_deadline(self, turn: int | None) -> Self:
        self._global_deadline_turn = turn
        return self

    def add_faction_pressure(
        self,
        *,
        faction_id: str,
        intensity: float,
        deadline_turn: int | None = None,
        drivers: tuple[str, ...] = (),
        team_goal: str | None = None,
    ) -> Self:
        self._faction_pressures.append(
            FactionPressure(
                faction_id=faction_id,
                intensity=intensity,
                deadline_turn=deadline_turn,
                drivers=drivers,
                team_goal=team_goal,
            )
        )
        return self

    def add_region_pressure(
        self,
        *,
        region_id: str,
        intensity: float,
        drivers: tuple[str, ...] = (),
    ) -> Self:
        self._region_pressures.append(
            RegionPressure(
                region_id=region_id,
                intensity=intensity,
                drivers=drivers,
            )
        )
        return self

    def add_credibility(
        self,
        *,
        from_faction_id: str,
        to_faction_id: str,
        immediate: float = 0.0,
        resolve: float = 0.0,
        last_updated_turn: int = 0,
    ) -> Self:
        self._credibility.append(
            CredibilityTrack(
                from_faction_id=from_faction_id,
                to_faction_id=to_faction_id,
                immediate=immediate,
                resolve=resolve,
                last_updated_turn=last_updated_turn,
            )
        )
        return self

    def add_leader_signal(
        self,
        *,
        id: str,
        timestamp: datetime,
        speaker_faction_id: str,
        type: LeaderSignalType | str,
        severity: float,
        text: str,
        target_faction_id: str | None = None,
        region_id: str | None = None,
        cameo_code: str | None = None,
        goldstein: float | None = None,
        source: str = "stub",
        source_url: str | None = None,
        turn: int | None = None,
    ) -> Self:
        sig_type = type if isinstance(type, LeaderSignalType) else LeaderSignalType(type)
        self._leader_signals.append(
            LeaderSignal(
                id=id,
                timestamp=timestamp,
                speaker_faction_id=speaker_faction_id,
                type=sig_type,
                severity=severity,
                text=text,
                target_faction_id=target_faction_id,
                region_id=region_id,
                cameo_code=cameo_code,
                goldstein=goldstein,
                source=source,
                source_url=source_url,
                turn=turn,
            )
        )
        return self

    def build(self) -> Theater:
        if self._bbox is None:
            raise ValueError("ScenarioBuilder: bbox must be set via with_bbox()")
        pressure = PressureState(
            global_deadline_turn=self._global_deadline_turn,
            factions=tuple(self._faction_pressures),
            regions=tuple(self._region_pressures),
        )
        theater = Theater(
            id=self._id,
            name=self._name,
            classification=self._classification,
            clock=self._clock,
            bbox=self._bbox,
            factions=list(self._factions),
            countries=list(self._countries),
            cities=list(self._cities),
            territories=list(self._territories),
            oblasts=list(self._oblasts),
            units=list(self._units),
            depots=list(self._depots),
            airfields=list(self._airfields),
            naval_bases=list(self._naval_bases),
            border_crossings=list(self._border_crossings),
            supply_lines=list(self._supply_lines),
            isr_coverages=list(self._isr_coverages),
            missile_ranges=list(self._missile_ranges),
            aors=list(self._aors),
            frontlines=list(self._frontlines),
            current_turn=self._current_turn,
            pressure=pressure,
            credibility=list(self._credibility),
            leader_signals=list(self._leader_signals),
        )
        theater.validate()
        return theater
