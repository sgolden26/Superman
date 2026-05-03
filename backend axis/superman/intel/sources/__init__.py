"""Runtime binding for morale pipeline input feeds (`--source` switch)."""

from superman.intel.sources.base import IntelSource
from superman.intel.sources.curated import CuratedSource
from superman.intel.sources.gdelt_snapshot import GdeltSnapshotSource
from superman.intel.sources.gdelt_live import GdeltLiveSource

__all__ = [
    "IntelSource",
    "CuratedSource",
    "GdeltSnapshotSource",
    "GdeltLiveSource",
]
