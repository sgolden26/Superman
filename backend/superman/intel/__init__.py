"""Intel and political signals.

Event feeds (curated files, frozen scrapes, or live GDELT) flow through a
replaceable source, land in morale rollups, and surface to the Decision
workspace. Shapes documented in `docs/intel.md` match what the SPA expects.

Isolation from `superman.sim` keeps deterministic replay available even when no
live news feed runs.
"""

from superman.intel.credibility import CredibilityEngine, decay_track, update_track
from superman.intel.events import (
    Event,
    EventCategory,
    DEFAULT_CATEGORY_SIGN,
)
from superman.intel.leader_statements import (
    GDELTAdapter,
    LeaderStatementAdapter,
    StubAdapter,
    build_adapter,
    cameo_to_signal_type,
)
from superman.intel.morale import (
    Driver,
    RegionIntel,
    IntelSnapshot,
    aggregate_region,
    aggregate_all,
)
from superman.intel.pipeline import IntelPipeline, build_source
from superman.intel.pressure import PressureEngine

__all__ = [
    "CredibilityEngine",
    "DEFAULT_CATEGORY_SIGN",
    "Driver",
    "Event",
    "EventCategory",
    "GDELTAdapter",
    "IntelPipeline",
    "IntelSnapshot",
    "LeaderStatementAdapter",
    "PressureEngine",
    "RegionIntel",
    "StubAdapter",
    "aggregate_region",
    "aggregate_all",
    "build_adapter",
    "build_source",
    "cameo_to_signal_type",
    "decay_track",
    "update_track",
]
