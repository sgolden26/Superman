"""Country repository: pluggable data sources for `Country` instances.

The scenario seed pulls countries from a `CountryRepository`; v1 ships a
`StubCountryRepository` with hand-authored values. Future adapters
(GDELT-driven, CIA Factbook ingest, IISS Military Balance loader) drop in
behind the same ABC without touching the scenario code.
"""

from axis.domain.countries.repository import CountryRepository
from axis.domain.countries.stub import StubCountryRepository

__all__ = ["CountryRepository", "StubCountryRepository"]
