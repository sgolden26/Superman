"""Political-layer sim hook.

Called by `TheaterStore.apply_batch` after a successful `OrderBatch.execute`.
Responsibilities:

1. Advance `theater.current_turn` by one.
2. Compute the issuer faction's `signal_severity` from the most-recent signal
   they emitted (or 0 if absent).
3. Compute `action_severity` for the batch from a per-order severity table.
   Currently `MoveOrder` contributes a fixed nominal aggression value; new
   order kinds register their severity in `_ORDER_SEVERITY` below.
4. Update bilateral credibility from the issuer to every other faction via
   `CredibilityEngine`.
5. Step `PressureEngine` to apply decay + deadline ramp.

The hook is intentionally tolerant: missing signals, no orders, or an
unmapped issuer faction all collapse to "decay only" with no exception.
"""

from __future__ import annotations

from typing import Literal

from axis.domain.faction import Allegiance
from axis.domain.theater import Theater
from axis.intel.credibility import CredibilityEngine
from axis.intel.pressure import PressureEngine
from axis.sim.orders import MoveOrder, OrderBatch


PlayerTeam = Literal["red", "blue"]

_TEAM_TO_ALLEGIANCE: dict[PlayerTeam, Allegiance] = {
    "red": Allegiance.RED,
    "blue": Allegiance.BLUE,
}

# Per-order nominal action severity. Negative = aggressive; the magnitudes
# are demo-tuned. Add new order kinds here when they ship.
_ORDER_SEVERITY: dict[str, float] = {
    "move": -0.30,
}


def issuer_faction_id(theater: Theater, team: PlayerTeam) -> str | None:
    """Pick the primary faction for `team`: first faction with matching allegiance."""
    target = _TEAM_TO_ALLEGIANCE[team]
    for f in theater.factions:
        if f.allegiance is target:
            return f.id
    return None


def latest_signal_severity(theater: Theater, faction_id: str) -> float:
    """Return the most-recent leader signal severity from this faction, or 0."""
    candidates = [s for s in theater.leader_signals if s.speaker_faction_id == faction_id]
    if not candidates:
        return 0.0
    candidates.sort(key=lambda s: s.timestamp, reverse=True)
    return candidates[0].severity


def batch_action_severity(batch: OrderBatch) -> float:
    """Aggregate the executed batch into a signed severity in [-1, +1]."""
    if not batch.orders:
        return 0.0
    contributions: list[float] = []
    for order in batch.orders:
        if isinstance(order, MoveOrder):
            contributions.append(_ORDER_SEVERITY["move"])
        else:
            kind = getattr(order, "kind", None)
            if isinstance(kind, str) and kind in _ORDER_SEVERITY:
                contributions.append(_ORDER_SEVERITY[kind])
    if not contributions:
        return 0.0
    avg = sum(contributions) / len(contributions)
    # Clamp; one batch should not saturate the scale.
    return max(-1.0, min(1.0, avg))


def advance_after_batch(theater: Theater, batch: OrderBatch) -> int:
    """Advance the political layer one turn in response to an executed batch.

    Returns the new `theater.current_turn`. Mutates `theater` in place.
    """
    new_turn = theater.current_turn + 1
    theater.current_turn = new_turn

    issuer_id = issuer_faction_id(theater, batch.issuer_team)
    signal_sev = latest_signal_severity(theater, issuer_id) if issuer_id else 0.0
    action_sev = batch_action_severity(batch)

    if issuer_id is not None:
        CredibilityEngine(theater).record_action(
            issuer_faction_id=issuer_id,
            signal_severity=signal_sev,
            action_severity=action_sev,
            turn=new_turn,
            source="cart_vs_execute",
            note=f"batch of {len(batch.orders)} order(s)",
        )

    PressureEngine(theater).advance(new_turn)
    return new_turn
