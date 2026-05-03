"""IntelSource ABC.

Every source is a callable that returns a snapshot of recent events at
`now`. The pipeline does not maintain state across ticks - each source is
expected to be idempotent (frozen sources) or to handle its own caching
(live sources).
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime

from axis.intel.events import Event


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
