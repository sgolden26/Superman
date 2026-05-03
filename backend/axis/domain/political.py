"""Political layer: pressure, leader signals, bilateral credibility.

Data shapes for Phase 9. Pure value types. Live mutation/computation lives in
`axis.intel.pressure` and `axis.intel.credibility` (added in later steps).

Design notes
------------
- Severity is signed `[-1, +1]`, aligned with GDELT's Goldstein scale (raw
  Goldstein is `-10..+10`; we divide by 10 at ingest). This keeps a single
  signed scale across morale events, signal events, and action aggressiveness.
- Pressure is modelled at three scopes (per the Phase 9 spec):
    1. global scenario clock (`PressureState.global_deadline_turn`),
    2. per-faction (`FactionPressure`),
    3. per-region (`RegionPressure`).
  Per-faction intensity is expected to be derived (later) from the regions a
  faction owns plus the global clock; we store the derived value here so the
  frontend can read it without recomputing.
- Credibility is bilateral and two-track, mirroring Paper 2 (Payne 2026):
    - `immediate`: rolling signal-action consistency
    - `resolve`: long-range follow-through on stated objectives
  Both are signed `[-1, +1]`. `history` retains recent gap observations so the
  HUD can show provenance.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


def _check_unit_interval(name: str, value: float) -> None:
    if not 0.0 <= value <= 1.0:
        raise ValueError(f"{name} must be in [0, 1], got {value}")


def _check_signed_unit_interval(name: str, value: float) -> None:
    if not -1.0 <= value <= 1.0:
        raise ValueError(f"{name} must be in [-1, 1], got {value}")


# ---------------------------------------------------------------------------
# Leader signals
# ---------------------------------------------------------------------------


class LeaderSignalType(str, Enum):
    """Curated Axis-native taxonomy mapped from CAMEO codes at ingest.

    Kept narrow on purpose; CAMEO has hundreds of granular codes that we fold
    into these six categories before the FE sees them.
    """

    ULTIMATUM = "ultimatum"
    COMMITMENT = "commitment"
    THREAT = "threat"
    DENIAL = "denial"
    REASSURANCE = "reassurance"
    DEMAND = "demand"


@dataclass(frozen=True, slots=True)
class LeaderSignal:
    """A single public statement attributed to a faction.

    Stub data and the GDELT adapter both produce records of this shape; the
    `source` field flags provenance.
    """

    id: str  # namespaced "sig.<source>.<n>"
    timestamp: datetime
    speaker_faction_id: str
    type: LeaderSignalType
    severity: float  # -1..+1, signed (Goldstein/10)
    text: str
    target_faction_id: str | None = None
    region_id: str | None = None
    cameo_code: str | None = None
    goldstein: float | None = None  # raw -10..+10 if from GDELT
    source: str = "stub"  # "stub" | "gdelt" | "manual"
    source_url: str | None = None
    turn: int | None = None  # turn at which the signal lands; None if pre-game

    def __post_init__(self) -> None:
        _check_signed_unit_interval("LeaderSignal.severity", self.severity)
        if self.goldstein is not None and not -10.0 <= self.goldstein <= 10.0:
            raise ValueError(
                f"LeaderSignal.goldstein must be in [-10, 10], got {self.goldstein}"
            )


# ---------------------------------------------------------------------------
# Pressure
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class RegionPressure:
    """Pressure scalar attached to a region (territory or oblast id)."""

    region_id: str
    intensity: float  # 0..1
    drivers: tuple[str, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        _check_unit_interval("RegionPressure.intensity", self.intensity)


@dataclass(frozen=True, slots=True)
class FactionPressure:
    """Pressure scalar attached to a faction.

    `intensity` is treated as the derived rollup (regions + scenario deadline).
    Storing it explicitly lets the frontend read a stable per-tick value rather
    than recomputing.

    `team_goal` follows the NATO Wargaming Handbook (HQ SACT, 2023) Fig. 7
    convention of expressing time-bound team goals (e.g. "Keep your leader
    alive until turn 5"). Stored as a verb phrase ending in its preposition
    ("...by" / "...through"); the HUD appends the live `T-N` countdown so the
    rendered string stays synced with `deadline_turn`.
    """

    faction_id: str
    intensity: float  # 0..1
    deadline_turn: int | None = None
    drivers: tuple[str, ...] = field(default_factory=tuple)
    team_goal: str | None = None

    def __post_init__(self) -> None:
        _check_unit_interval("FactionPressure.intensity", self.intensity)


@dataclass(frozen=True, slots=True)
class PressureState:
    """Aggregate political pressure state for the whole theatre."""

    global_deadline_turn: int | None = None
    factions: tuple[FactionPressure, ...] = field(default_factory=tuple)
    regions: tuple[RegionPressure, ...] = field(default_factory=tuple)

    def faction(self, faction_id: str) -> FactionPressure | None:
        for fp in self.factions:
            if fp.faction_id == faction_id:
                return fp
        return None

    def region(self, region_id: str) -> RegionPressure | None:
        for rp in self.regions:
            if rp.region_id == region_id:
                return rp
        return None


# ---------------------------------------------------------------------------
# Credibility
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class GapEvent:
    """Single signal-vs-action gap observation feeding credibility.

    `gap` is `action_severity - signal_severity`. Positive means the actor
    exceeded their stated intent (Claude-style escalation beyond signal);
    negative means they fell short of it.
    """

    turn: int
    signal_severity: float
    action_severity: float
    gap: float
    source: str  # "cart_vs_execute" | "broken_commitment" | "scripted"
    note: str = ""

    def __post_init__(self) -> None:
        _check_signed_unit_interval("GapEvent.signal_severity", self.signal_severity)
        _check_signed_unit_interval("GapEvent.action_severity", self.action_severity)
        if not -2.0 <= self.gap <= 2.0:
            raise ValueError(f"GapEvent.gap must be in [-2, 2], got {self.gap}")


@dataclass(frozen=True, slots=True)
class CredibilityTrack:
    """Bilateral two-track credibility from one faction to another.

    Mirrors Paper 2 (Payne 2026). `immediate` decays/updates fast, `resolve`
    moves slowly with cumulative follow-through.
    """

    from_faction_id: str
    to_faction_id: str
    immediate: float = 0.0  # -1..+1
    resolve: float = 0.0  # -1..+1
    last_updated_turn: int = 0
    history: tuple[GapEvent, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        _check_signed_unit_interval("CredibilityTrack.immediate", self.immediate)
        _check_signed_unit_interval("CredibilityTrack.resolve", self.resolve)
        if self.from_faction_id == self.to_faction_id:
            raise ValueError(
                f"CredibilityTrack: from and to factions must differ, got "
                f"{self.from_faction_id!r}"
            )
