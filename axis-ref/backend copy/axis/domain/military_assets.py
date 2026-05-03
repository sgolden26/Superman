"""Geospatial military and logistics assets.

These are point/line/polygon entities that complement units. Each asset is
faction-owned and optionally country-owned. They are pure data; the simulation
layer (when added) reads them but does not own them.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

from axis.domain.coordinates import Coordinate


class AssetKind(str, Enum):
    DEPOT = "depot"
    AIRFIELD = "airfield"
    NAVAL_BASE = "naval_base"
    BORDER_CROSSING = "border_crossing"


class CrossingMode(str, Enum):
    OPEN = "open"
    RESTRICTED = "restricted"
    CLOSED = "closed"


def _validate_unit_interval(name: str, value: float) -> None:
    if not 0.0 <= value <= 1.0:
        raise ValueError(f"{name} must be in [0, 1], got {value}")


@dataclass(frozen=True, slots=True)
class Depot:
    """A static logistics node (ammunition, POL, rations)."""

    id: str
    name: str
    faction_id: str
    position: Coordinate
    capacity: float = 0.5  # 0..1, normalised tonnage proxy
    fill: float = 0.5  # 0..1, current stock level
    country_id: str | None = None
    available_actions: tuple[str, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        _validate_unit_interval("capacity", self.capacity)
        _validate_unit_interval("fill", self.fill)


@dataclass(frozen=True, slots=True)
class Airfield:
    """A military or dual-use airfield."""

    id: str
    name: str
    faction_id: str
    position: Coordinate
    runway_m: int = 2400
    role: str = "tactical"  # "tactical" | "strategic" | "dispersal" | "civilian"
    based_aircraft: int = 0
    country_id: str | None = None
    available_actions: tuple[str, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        if self.runway_m < 0:
            raise ValueError("Airfield.runway_m must be non-negative")
        if self.based_aircraft < 0:
            raise ValueError("Airfield.based_aircraft must be non-negative")


@dataclass(frozen=True, slots=True)
class NavalBase:
    """A naval base or anchorage."""

    id: str
    name: str
    faction_id: str
    position: Coordinate
    pier_count: int = 1
    home_port_for: tuple[str, ...] = field(default_factory=tuple)  # unit ids
    country_id: str | None = None
    available_actions: tuple[str, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        if self.pier_count < 0:
            raise ValueError("NavalBase.pier_count must be non-negative")


@dataclass(frozen=True, slots=True)
class BorderCrossing:
    """A road/rail crossing point between two countries."""

    id: str
    name: str
    faction_id: str  # de-facto controller
    position: Coordinate
    countries: tuple[str, str]  # (a, b) country ids
    mode: CrossingMode = CrossingMode.OPEN
    rail: bool = False
    road: bool = True
    available_actions: tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True, slots=True)
class SupplyLine:
    """A polyline representing a sustainment corridor."""

    id: str
    name: str
    faction_id: str
    path: tuple[Coordinate, ...]
    health: float = 1.0  # 0..1, throughput share remaining
    mode: str = "road"  # "road" | "rail" | "sea" | "air"
    from_id: str | None = None  # depot/base/city id
    to_id: str | None = None
    available_actions: tuple[str, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        _validate_unit_interval("health", self.health)
        if len(self.path) < 2:
            raise ValueError("SupplyLine.path must have at least 2 points")


@dataclass(frozen=True, slots=True)
class IsrCoverage:
    """An ISR fan / look-volume centred on `origin`.

    A simple two-parameter model: a heading in degrees (true north = 0,
    clockwise) and a beam width. Range is the radius in km.
    """

    id: str
    name: str
    faction_id: str
    origin: Coordinate
    range_km: float
    heading_deg: float = 0.0
    beam_deg: float = 360.0
    platform: str = "satellite"  # "satellite" | "uav" | "awacs" | "ground"
    confidence: float = 0.7
    country_id: str | None = None
    available_actions: tuple[str, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        if self.range_km <= 0:
            raise ValueError("IsrCoverage.range_km must be positive")
        if not 0.0 < self.beam_deg <= 360.0:
            raise ValueError("IsrCoverage.beam_deg must be in (0, 360]")
        _validate_unit_interval("confidence", self.confidence)


@dataclass(frozen=True, slots=True)
class MissileRange:
    """A circular weapon range arc rendered as a ring (or sector).

    Used for SAM bubbles, cruise/ballistic envelopes, MLRS reach.
    """

    id: str
    name: str
    faction_id: str
    origin: Coordinate
    range_km: float
    weapon: str = "generic"  # informational
    category: str = "sam"  # "sam" | "cruise" | "ballistic" | "mlrs"
    heading_deg: float = 0.0
    beam_deg: float = 360.0
    country_id: str | None = None
    available_actions: tuple[str, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        if self.range_km <= 0:
            raise ValueError("MissileRange.range_km must be positive")
        if not 0.0 < self.beam_deg <= 360.0:
            raise ValueError("MissileRange.beam_deg must be in (0, 360]")


@dataclass(frozen=True, slots=True)
class AreaOfResponsibility:
    """A polygonal AOR for a formation (army/corps/fleet)."""

    id: str
    name: str
    faction_id: str
    polygon: tuple[tuple[Coordinate, ...], ...]
    formation_id: str | None = None  # owning unit id, optional
    country_id: str | None = None
    available_actions: tuple[str, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        if not self.polygon or not self.polygon[0]:
            raise ValueError("AOR.polygon must have at least one ring")
        for ring in self.polygon:
            if len(ring) < 3:
                raise ValueError("AOR ring must have >= 3 points")
