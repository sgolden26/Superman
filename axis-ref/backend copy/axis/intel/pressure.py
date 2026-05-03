"""Pressure rollup and decay.

`PressureEngine.advance(turn)` is the only entry point used by the sim hook.
It mutates the `Theater.pressure` field in place to reflect:

- the new turn (deadline countdown),
- a small amount of background decay back toward each faction's baseline,
- a rollup so per-faction `intensity` is influenced by the average of the
  region pressures the faction owns.

The values are deliberately simple: this is the seed for a Phase 9 demo, not
a fully-modelled political econ. A future intel adapter (GDELT-driven) can
recompute regional intensities each turn and let this engine roll them up.
"""

from __future__ import annotations

from dataclasses import replace

from axis.domain.political import (
    FactionPressure,
    PressureState,
    RegionPressure,
)
from axis.domain.theater import Theater


# Tunables.
REGION_DECAY = 0.05  # per turn, regions drift toward 0
FACTION_BASELINE_PULL = 0.04  # per turn, factions drift toward seed baseline
DEADLINE_RAMP = 0.06  # per turn closer to deadline, intensity rises
ROLLUP_REGION_WEIGHT = 0.35  # how much region rollup affects faction intensity
MIN_INTENSITY = 0.0
MAX_INTENSITY = 1.0


def _clamp01(x: float) -> float:
    return max(MIN_INTENSITY, min(MAX_INTENSITY, x))


def _deadline_intensity(deadline_turn: int | None, current_turn: int) -> float:
    if deadline_turn is None:
        return 0.0
    remaining = deadline_turn - current_turn
    if remaining <= 0:
        return 1.0
    # Closer to the deadline → larger value. Ramp at DEADLINE_RAMP per turn.
    return _clamp01(1.0 - remaining * DEADLINE_RAMP)


def _faction_region_avg(
    faction_id: str,
    *,
    regions: tuple[RegionPressure, ...],
    region_owner: dict[str, str],
) -> float | None:
    """Mean intensity of regions owned by `faction_id`, or None if no regions."""
    intensities = [
        rp.intensity for rp in regions if region_owner.get(rp.region_id) == faction_id
    ]
    if not intensities:
        return None
    return sum(intensities) / len(intensities)


class PressureEngine:
    """Owns the per-turn evolution of `Theater.pressure`.

    Holds a snapshot of the seed baseline so factions can drift back toward
    their starting intensity rather than collapsing to zero.
    """

    def __init__(self, theater: Theater) -> None:
        self._theater = theater
        # Capture seed values for baseline-pull. Indexed by faction id.
        self._baseline: dict[str, float] = {
            fp.faction_id: fp.intensity for fp in theater.pressure.factions
        }

    def advance(self, turn: int) -> PressureState:
        """Step the pressure model forward to `turn` and write back to theater."""
        ps = self._theater.pressure
        region_owner = self._region_owner_map()

        new_regions = tuple(
            replace(rp, intensity=_clamp01(rp.intensity * (1.0 - REGION_DECAY)))
            for rp in ps.regions
        )
        new_factions: list[FactionPressure] = []
        for fp in ps.factions:
            baseline = self._baseline.get(fp.faction_id, fp.intensity)
            deadline_component = _deadline_intensity(
                fp.deadline_turn or ps.global_deadline_turn, turn
            )
            region_component = _faction_region_avg(
                fp.faction_id,
                regions=new_regions,
                region_owner=region_owner,
            )

            # Blend: pull toward baseline, then add deadline ramp and a slice
            # of the region rollup. Clamp at the end.
            blended = fp.intensity + FACTION_BASELINE_PULL * (baseline - fp.intensity)
            blended = blended * (1.0 - 0.30) + deadline_component * 0.30
            if region_component is not None:
                blended = (
                    blended * (1.0 - ROLLUP_REGION_WEIGHT)
                    + region_component * ROLLUP_REGION_WEIGHT
                )
            new_factions.append(replace(fp, intensity=_clamp01(blended)))

        new_state = PressureState(
            global_deadline_turn=ps.global_deadline_turn,
            factions=tuple(new_factions),
            regions=new_regions,
        )
        self._theater.pressure = new_state
        return new_state

    def _region_owner_map(self) -> dict[str, str]:
        """Map region_id (territory or oblast id) → controlling faction_id."""
        m: dict[str, str] = {}
        for t in self._theater.territories:
            m[t.id] = t.faction_id
        for o in self._theater.oblasts:
            m[o.id] = o.faction_id
        return m
