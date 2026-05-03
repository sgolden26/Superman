"""Pluggable `Country` providers (scenario seeds call the ABC)."""

from superman.domain.countries.repository import CountryRepository
from superman.domain.countries.stub import StubCountryRepository

__all__ = ["CountryRepository", "StubCountryRepository"]
