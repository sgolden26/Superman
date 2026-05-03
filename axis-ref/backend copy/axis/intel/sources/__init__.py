"""Pluggable intel sources.

All sources implement the `IntelSource` ABC and emit `Event` instances. The
pipeline selects one at runtime via the `--source` flag.
"""

from axis.intel.sources.base import IntelSource
from axis.intel.sources.curated import CuratedSource
from axis.intel.sources.gdelt_snapshot import GdeltSnapshotSource
from axis.intel.sources.gdelt_live import GdeltLiveSource

__all__ = [
    "IntelSource",
    "CuratedSource",
    "GdeltSnapshotSource",
    "GdeltLiveSource",
]
