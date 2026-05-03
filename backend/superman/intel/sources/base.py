"""Abstract ingest surface returning `Event` rows for timestamp `now`."""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime

from superman.intel.events import Event


class IntelSource(ABC):
    """Stateless event provider."""

    name: str = "base"

    @abstractmethod
    def fetch(self, now: datetime) -> list[Event]:
        """Return all events visible at `now`.

        Implementations should filter to a reasonable lookback window
        (events older than ~5 days are decayed to nothing anyway).
        """
        raise NotImplementedError
