"""Intel / political layer.

Pluggable pipeline that turns event signals (curated, frozen GDELT, or live
GDELT) into per-region morale snapshots. The output shape is documented in
`docs/intel.md` and consumed verbatim by the frontend Decision Engine.

Strictly separated from `axis.sim` so the simulation can run with or without
live intel signals (deterministic replay vs. live mode).
"""

from axis.intel.credibility import CredibilityEngine, decay_track, update_track
from axis.intel.events import (
    Event,
    EventCategory,
    DEFAULT_CATEGORY_SIGN,
)
from axis.intel.leader_statements import (
    GDELTAdapter,
    LeaderStatementAdapter,
    StubAdapter,
    build_adapter,
    cameo_to_signal_type,
)
from axis.intel.morale import (
    Driver,
    RegionIntel,
    IntelSnapshot,
    aggregate_region,
    aggregate_all,
)
from axis.intel.pipeline import IntelPipeline, build_source
from axis.intel.pressure import PressureEngine

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
