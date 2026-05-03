"""Country: a deeply-modelled sovereign state.

Countries sit beneath the alliance/coalition layer (`Faction`). A country
belongs to exactly one faction (which may be neutral). Eight nested blocks
describe the country across government, military, nuclear posture,
demographics, diplomacy, energy/logistics, public opinion and geography.

All nested types are frozen, slotted dataclasses so the whole tree is hashable
and immutable after construction. Numeric ranges are validated in
`__post_init__` where appropriate.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


def _check_unit_interval(name: str, value: float) -> None:
    if not 0.0 <= value <= 1.0:
        raise ValueError(f"{name} must be in [0, 1], got {value}")


def _check_signed_unit_interval(name: str, value: float) -> None:
    if not -1.0 <= value <= 1.0:
        raise ValueError(f"{name} must be in [-1, 1], got {value}")


# ---------------------------------------------------------------------------
# Government
# ---------------------------------------------------------------------------


class RegimeType(str, Enum):
    LIBERAL_DEMOCRACY = "liberal_democracy"
    ILLIBERAL_DEMOCRACY = "illiberal_democracy"
    HYBRID = "hybrid"
    AUTHORITARIAN = "authoritarian"
    MILITARY_JUNTA = "military_junta"


@dataclass(frozen=True, slots=True)
class CabinetMember:
    title: str
    name: str


@dataclass(frozen=True, slots=True)
class Government:
    regime_type: RegimeType
    head_of_state: str
    head_of_government: str
    cabinet: tuple[CabinetMember, ...] = field(default_factory=tuple)
    approval_rating: float = 0.5  # 0..1
    stability_index: float = 0.5  # 0..1
    last_election: str | None = None  # ISO date
    next_election: str | None = None  # ISO date

    def __post_init__(self) -> None:
        _check_unit_interval("Government.approval_rating", self.approval_rating)
        _check_unit_interval("Government.stability_index", self.stability_index)


# ---------------------------------------------------------------------------
# Military
# ---------------------------------------------------------------------------


class MilitaryPosture(str, Enum):
    DEFENSIVE = "defensive"
    DETERRENT = "deterrent"
    OFFENSIVE = "offensive"
    EXPEDITIONARY = "expeditionary"


class InventoryStatus(str, Enum):
    OPERATIONAL = "operational"
    LIMITED = "limited"
    RESERVE = "reserve"
    LEGACY = "legacy"


@dataclass(frozen=True, slots=True)
class InventoryLine:
    category: str  # e.g. "main_battle_tank", "fighter", "frigate"
    label: str  # e.g. "Leopard 2A6", "F-16C"
    count: int
    status: InventoryStatus = InventoryStatus.OPERATIONAL

    def __post_init__(self) -> None:
        if self.count < 0:
            raise ValueError(f"InventoryLine.count must be non-negative, got {self.count}")


@dataclass(frozen=True, slots=True)
class ServiceBranch:
    name: str  # e.g. "Lithuanian Land Force"
    personnel: int
    inventory: tuple[InventoryLine, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        if self.personnel < 0:
            raise ValueError("ServiceBranch.personnel must be non-negative")


@dataclass(frozen=True, slots=True)
class Military:
    active_personnel: int
    reserve_personnel: int
    paramilitary: int
    branches: tuple[ServiceBranch, ...]
    doctrine: str
    posture: MilitaryPosture
    alert_level: int  # 1..5 (5 = highest readiness)
    c2_nodes: tuple[str, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        for n, v in (
            ("active_personnel", self.active_personnel),
            ("reserve_personnel", self.reserve_personnel),
            ("paramilitary", self.paramilitary),
        ):
            if v < 0:
                raise ValueError(f"Military.{n} must be non-negative, got {v}")
        if not 1 <= self.alert_level <= 5:
            raise ValueError(f"Military.alert_level must be in [1, 5], got {self.alert_level}")


# ---------------------------------------------------------------------------
# Nuclear posture
# ---------------------------------------------------------------------------


class NuclearStatus(str, Enum):
    NWS = "nws"  # nuclear weapon state
    UMBRELLA_HOST = "umbrella_host"  # hosts allied warheads
    LATENT = "latent"  # technically capable, no declared programme
    NONE = "none"


@dataclass(frozen=True, slots=True)
class NuclearPosture:
    status: NuclearStatus
    warheads: int = 0
    delivery_systems: tuple[str, ...] = field(default_factory=tuple)
    declared_posture: str = ""
    nfu: bool | None = None  # no-first-use; None = undeclared / not applicable

    def __post_init__(self) -> None:
        if self.warheads < 0:
            raise ValueError("NuclearPosture.warheads must be non-negative")


# ---------------------------------------------------------------------------
# Demographics
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class Composition:
    label: str
    share: float  # 0..1

    def __post_init__(self) -> None:
        _check_unit_interval(f"Composition[{self.label}].share", self.share)


@dataclass(frozen=True, slots=True)
class Demographics:
    population: int
    median_age: float
    urbanisation: float  # 0..1
    ethnic_groups: tuple[Composition, ...] = field(default_factory=tuple)
    languages: tuple[Composition, ...] = field(default_factory=tuple)
    religions: tuple[Composition, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        if self.population < 0:
            raise ValueError("Demographics.population must be non-negative")
        if self.median_age < 0:
            raise ValueError("Demographics.median_age must be non-negative")
        _check_unit_interval("Demographics.urbanisation", self.urbanisation)


# ---------------------------------------------------------------------------
# Diplomacy
# ---------------------------------------------------------------------------


class RelationStatus(str, Enum):
    ALLIED = "allied"
    FRIENDLY = "friendly"
    NEUTRAL = "neutral"
    STRAINED = "strained"
    HOSTILE = "hostile"
    AT_WAR = "at_war"


@dataclass(frozen=True, slots=True)
class Treaty:
    name: str
    kind: str  # e.g. "collective_defence", "arms_control", "trade"
    parties: tuple[str, ...] = field(default_factory=tuple)
    in_force: bool = True


@dataclass(frozen=True, slots=True)
class BilateralRelation:
    other_country_id: str  # may reference a country not yet seeded; FE handles gracefully
    status: RelationStatus
    score: float  # -1..+1, signed quality of the relationship

    def __post_init__(self) -> None:
        _check_signed_unit_interval("BilateralRelation.score", self.score)


@dataclass(frozen=True, slots=True)
class Diplomacy:
    alliance_memberships: tuple[str, ...] = field(default_factory=tuple)
    treaties: tuple[Treaty, ...] = field(default_factory=tuple)
    relations: tuple[BilateralRelation, ...] = field(default_factory=tuple)


# ---------------------------------------------------------------------------
# Energy / logistics
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class EnergyLogistics:
    oil_dependence: float  # 0..1, share imported
    gas_dependence: float  # 0..1, share imported
    top_gas_supplier: str
    pipelines: tuple[str, ...] = field(default_factory=tuple)
    key_ports: tuple[str, ...] = field(default_factory=tuple)
    rail_gauge_mm: int = 1435  # 1435 standard, 1520 Russian/CIS broad
    strategic_reserves_days: int = 0

    def __post_init__(self) -> None:
        _check_unit_interval("EnergyLogistics.oil_dependence", self.oil_dependence)
        _check_unit_interval("EnergyLogistics.gas_dependence", self.gas_dependence)
        if self.rail_gauge_mm <= 0:
            raise ValueError("EnergyLogistics.rail_gauge_mm must be positive")
        if self.strategic_reserves_days < 0:
            raise ValueError("EnergyLogistics.strategic_reserves_days must be non-negative")


# ---------------------------------------------------------------------------
# Public opinion
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class PublicOpinion:
    war_support: float  # 0..1, share of public supportive of armed action
    institutional_trust: float  # 0..1
    censorship_index: float  # 0..1, higher = more state media control
    protest_intensity: float  # 0..1
    top_outlets: tuple[str, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        _check_unit_interval("PublicOpinion.war_support", self.war_support)
        _check_unit_interval("PublicOpinion.institutional_trust", self.institutional_trust)
        _check_unit_interval("PublicOpinion.censorship_index", self.censorship_index)
        _check_unit_interval("PublicOpinion.protest_intensity", self.protest_intensity)


# ---------------------------------------------------------------------------
# Geography
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class Border:
    other: str  # country id where known, otherwise display name
    length_km: int

    def __post_init__(self) -> None:
        if self.length_km < 0:
            raise ValueError("Border.length_km must be non-negative")


@dataclass(frozen=True, slots=True)
class KeyBase:
    name: str
    kind: str  # e.g. "air_base", "naval_base", "command_node", "training_ground"
    lon: float
    lat: float
    owner_country_id: str

    def __post_init__(self) -> None:
        if not -180.0 <= self.lon <= 180.0:
            raise ValueError(f"KeyBase.lon out of range: {self.lon}")
        if not -90.0 <= self.lat <= 90.0:
            raise ValueError(f"KeyBase.lat out of range: {self.lat}")


@dataclass(frozen=True, slots=True)
class Geography:
    area_km2: int
    land_borders: tuple[Border, ...] = field(default_factory=tuple)
    key_bases: tuple[KeyBase, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        if self.area_km2 < 0:
            raise ValueError("Geography.area_km2 must be non-negative")


# ---------------------------------------------------------------------------
# Country (top-level)
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class Country:
    """A sovereign state with deep nested attributes.

    `faction_id` references the alliance/coalition layer (NATO, CSTO,
    neutral). All structural numeric constraints are enforced by the nested
    dataclasses; this top-level class only checks identifier presence.
    """

    id: str
    iso_a2: str  # ISO 3166-1 alpha-2
    iso_a3: str  # ISO 3166-1 alpha-3
    name: str
    official_name: str
    faction_id: str
    flag_emoji: str
    capital_city_id: str | None
    government: Government
    military: Military
    nuclear: NuclearPosture
    demographics: Demographics
    diplomacy: Diplomacy
    energy: EnergyLogistics
    public_opinion: PublicOpinion
    geography: Geography
    available_actions: tuple[str, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        if not self.id:
            raise ValueError("Country.id must be non-empty")
        if len(self.iso_a2) != 2:
            raise ValueError(f"Country.iso_a2 must be 2 chars, got {self.iso_a2!r}")
        if len(self.iso_a3) != 3:
            raise ValueError(f"Country.iso_a3 must be 3 chars, got {self.iso_a3!r}")
