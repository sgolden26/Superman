"""CountryRepository ABC."""

from __future__ import annotations

from abc import ABC, abstractmethod

from axis.domain.country import Country


class CountryRepository(ABC):
    """Source of `Country` records, addressable by id.

    Concrete implementations might:
    - read static hand-authored data (`StubCountryRepository`),
    - load from a JSON dossier file under `data/countries/`,
    - hydrate fields from external APIs (GDELT, CIA Factbook, IISS, SIPRI).

    Scenario builders only depend on this interface so the data source can
    swap without touching the scenario.
    """

    @abstractmethod
    def get(self, country_id: str) -> Country:
        """Return the country with the given id, or raise `KeyError`."""

    @abstractmethod
    def list_ids(self) -> tuple[str, ...]:
        """Return all known country ids."""

    def get_many(self, *country_ids: str) -> tuple[Country, ...]:
        return tuple(self.get(cid) for cid in country_ids)
