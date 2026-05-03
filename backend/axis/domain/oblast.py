"""Oblast (admin-1) entities.

For v0.4.0 only Ukrainian oblasts are seeded. The polygon data is loaded by
the frontend from `frontend/public/borders/admin1_ua.geojson` and merged with
metadata from this dataclass via `iso_3166_2`.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from axis.domain.coordinates import Coordinate


def _validate_unit_interval(name: str, value: float) -> None:
    if not 0.0 <= value <= 1.0:
        raise ValueError(f"{name} must be in [0, 1], got {value}")


@dataclass(frozen=True, slots=True)
class Oblast:
    """An admin-1 region.

    The frontend resolves the polygon by `iso_3166_2`. We carry only metadata
    and metric scalars here so the geojson stays the single source of truth.
    """

    id: str  # namespaced: "obl.<code-lower>" e.g. "obl.kyiv-city"
    iso_3166_2: str  # e.g. "UA-32"
    name: str
    country_id: str
    faction_id: str  # de-facto controller for choropleth shading
    capital_city_id: str | None = None
    population: int = 0
    area_km2: float = 0.0
    control: float = 1.0  # 0..1 share held by faction_id
    contested: bool = False
    morale: float = 0.7
    civil_unrest: float = 0.2
    refugees_outflow: int = 0
    available_actions: tuple[str, ...] = field(default_factory=tuple)
    centroid: Coordinate | None = None  # optional override; otherwise computed FE-side

    def __post_init__(self) -> None:
        _validate_unit_interval("control", self.control)
        _validate_unit_interval("morale", self.morale)
        _validate_unit_interval("civil_unrest", self.civil_unrest)
        if self.population < 0:
            raise ValueError("Oblast.population must be non-negative")
        if self.area_km2 < 0:
            raise ValueError("Oblast.area_km2 must be non-negative")
