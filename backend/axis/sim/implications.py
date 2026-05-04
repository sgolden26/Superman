"""Forecast the social/political implications of a hypothetical OrderBatch.

This is the headline capability behind the "model the implications of an order"
ask in the Mission C2 brief. Pure read-only: callers pass a live `Theater`
plus a candidate `OrderBatch`, get back a structured forecast of how
credibility, pressure, and severity would shift if the batch were committed
this tick. The live theatre is never mutated.

Mechanics
---------
The political engine already encodes the rules: signal severity is the most
recent leader-signal severity from the issuer faction, action severity is the
batch's `_ORDER_SEVERITY` average, the resulting gap drives bilateral
credibility moves on the issuer's outgoing tracks, and pressure decays /
ramps with the global deadline. Rather than duplicate that arithmetic, we
deep-copy the theatre, run `advance_after_batch` on the copy, and diff. Same
code path as a real commit, zero risk of drift.

The returned forecast is plain JSON-friendly dicts so the FE can render it
without a wire-format negotiation.
"""

from __future__ import annotations

import copy
from dataclasses import dataclass, field
from typing import Any

from axis.domain.theater import Theater
from axis.sim.orders import OrderBatch
from axis.sim.political_engine import (
    advance_after_batch,
    batch_action_severity,
    issuer_faction_id,
    latest_signal_severity,
)


@dataclass(frozen=True, slots=True)
class CredibilityDelta:
    """One bilateral track's before/after pair (issuer-outgoing only)."""

    from_faction_id: str
    to_faction_id: str
    immediate_before: float
    immediate_after: float
    resolve_before: float
    resolve_after: float

    @property
    def immediate_delta(self) -> float:
        return self.immediate_after - self.immediate_before

    @property
    def resolve_delta(self) -> float:
        return self.resolve_after - self.resolve_before

    def to_dict(self) -> dict[str, Any]:
        return {
            "from_faction_id": self.from_faction_id,
            "to_faction_id": self.to_faction_id,
            "immediate_before": round(self.immediate_before, 3),
            "immediate_after": round(self.immediate_after, 3),
            "immediate_delta": round(self.immediate_delta, 3),
            "resolve_before": round(self.resolve_before, 3),
            "resolve_after": round(self.resolve_after, 3),
            "resolve_delta": round(self.resolve_delta, 3),
        }


@dataclass(frozen=True, slots=True)
class PressureDelta:
    """One faction's pressure intensity before/after."""

    faction_id: str
    intensity_before: float
    intensity_after: float

    @property
    def delta(self) -> float:
        return self.intensity_after - self.intensity_before

    def to_dict(self) -> dict[str, Any]:
        return {
            "faction_id": self.faction_id,
            "intensity_before": round(self.intensity_before, 3),
            "intensity_after": round(self.intensity_after, 3),
            "delta": round(self.delta, 3),
        }


@dataclass(frozen=True, slots=True)
class ImplicationFactor:
    """One human-readable line explaining a slice of the forecast."""

    label: str
    detail: str
    severity: str  # "info" | "warn" | "danger"

    def to_dict(self) -> dict[str, Any]:
        return {"label": self.label, "detail": self.detail, "severity": self.severity}


@dataclass(frozen=True, slots=True)
class ImplicationsForecast:
    """Full forecast envelope for a candidate OrderBatch."""

    issuer_team: str
    issuer_faction_id: str | None
    signal_severity: float
    action_severity: float
    gap: float
    credibility: tuple[CredibilityDelta, ...] = field(default_factory=tuple)
    pressure: tuple[PressureDelta, ...] = field(default_factory=tuple)
    factors: tuple[ImplicationFactor, ...] = field(default_factory=tuple)

    def to_dict(self) -> dict[str, Any]:
        return {
            "issuer_team": self.issuer_team,
            "issuer_faction_id": self.issuer_faction_id,
            "signal_severity": round(self.signal_severity, 3),
            "action_severity": round(self.action_severity, 3),
            "gap": round(self.gap, 3),
            "credibility": [c.to_dict() for c in self.credibility],
            "pressure": [p.to_dict() for p in self.pressure],
            "factors": [f.to_dict() for f in self.factors],
        }


# Threshold above which we surface a credibility/pressure swing as a "factor".
# Tuned so noise from pure decay doesn't pollute the explanation list.
_NOTABLE_DELTA: float = 0.04


def _credibility_diffs(
    before: Theater, after: Theater, issuer_id: str | None
) -> list[CredibilityDelta]:
    """Diff each track shared by both theatres. Issuer-outgoing only."""
    if issuer_id is None:
        return []
    by_pair_after = {
        (t.from_faction_id, t.to_faction_id): t for t in after.credibility
    }
    out: list[CredibilityDelta] = []
    for pre in before.credibility:
        if pre.from_faction_id != issuer_id:
            continue
        post = by_pair_after.get((pre.from_faction_id, pre.to_faction_id))
        if post is None:
            continue
        out.append(
            CredibilityDelta(
                from_faction_id=pre.from_faction_id,
                to_faction_id=pre.to_faction_id,
                immediate_before=pre.immediate,
                immediate_after=post.immediate,
                resolve_before=pre.resolve,
                resolve_after=post.resolve,
            )
        )
    return out


def _pressure_diffs(before: Theater, after: Theater) -> list[PressureDelta]:
    by_after = {fp.faction_id: fp.intensity for fp in after.pressure.factions}
    out: list[PressureDelta] = []
    for fp in before.pressure.factions:
        if fp.faction_id not in by_after:
            continue
        out.append(
            PressureDelta(
                faction_id=fp.faction_id,
                intensity_before=fp.intensity,
                intensity_after=by_after[fp.faction_id],
            )
        )
    return out


def _build_factors(
    *,
    issuer_team: str,
    signal_severity: float,
    action_severity: float,
    gap: float,
    credibility: list[CredibilityDelta],
    pressure: list[PressureDelta],
) -> list[ImplicationFactor]:
    """Produce a short, signed list of human-readable factors."""
    factors: list[ImplicationFactor] = []

    if abs(signal_severity) < 0.01 and abs(action_severity) >= 0.01:
        factors.append(
            ImplicationFactor(
                label="Action without prior signal",
                detail=(
                    f"You're acting at severity {action_severity:+.2f} with no "
                    f"recent leader signal to anchor it. Adversaries may read "
                    f"this as escalation by surprise."
                ),
                severity="warn",
            )
        )
    elif gap < -0.20:
        factors.append(
            ImplicationFactor(
                label="Action exceeds prior signal",
                detail=(
                    f"Your action ({action_severity:+.2f}) is more aggressive "
                    f"than your most recent signal ({signal_severity:+.2f}); "
                    f"gap {gap:+.2f}. Reads as escalation beyond stated intent."
                ),
                severity="danger",
            )
        )
    elif gap > 0.20:
        factors.append(
            ImplicationFactor(
                label="Action falls short of signal",
                detail=(
                    f"Your action ({action_severity:+.2f}) is softer than your "
                    f"recent signal ({signal_severity:+.2f}); gap {gap:+.2f}. "
                    f"Reads as backing down."
                ),
                severity="warn",
            )
        )

    for c in credibility:
        if abs(c.immediate_delta) < _NOTABLE_DELTA:
            continue
        direction = "up" if c.immediate_delta > 0 else "down"
        sev = "info" if c.immediate_delta > 0 else "warn"
        factors.append(
            ImplicationFactor(
                label=f"Credibility {direction}: {c.from_faction_id} -> {c.to_faction_id}",
                detail=(
                    f"Immediate-track {c.immediate_before:+.2f} -> "
                    f"{c.immediate_after:+.2f} "
                    f"({c.immediate_delta:+.2f}); resolve "
                    f"{c.resolve_before:+.2f} -> {c.resolve_after:+.2f}."
                ),
                severity=sev,
            )
        )

    for p in pressure:
        if abs(p.delta) < _NOTABLE_DELTA:
            continue
        direction = "rising" if p.delta > 0 else "easing"
        sev = "warn" if p.delta > 0 else "info"
        factors.append(
            ImplicationFactor(
                label=f"Pressure {direction}: {p.faction_id}",
                detail=(
                    f"Intensity {p.intensity_before:.2f} -> "
                    f"{p.intensity_after:.2f} ({p.delta:+.2f})."
                ),
                severity=sev,
            )
        )

    if not factors:
        factors.append(
            ImplicationFactor(
                label="Low political signal",
                detail=(
                    "No notable credibility or pressure movement is forecast "
                    "for this batch."
                ),
                severity="info",
            )
        )
    return factors


def forecast_implications(theater: Theater, batch: OrderBatch) -> ImplicationsForecast:
    """Forecast the political knock-on of `batch` without mutating `theater`.

    Runs the same political engine path a real commit would take, on a
    deep-copied theatre. Returns deltas keyed for FE consumption.
    """
    issuer_id = issuer_faction_id(theater, batch.issuer_team)
    sig_sev = latest_signal_severity(theater, issuer_id) if issuer_id else 0.0
    act_sev = batch_action_severity(batch)
    gap = act_sev - sig_sev

    sandbox = copy.deepcopy(theater)
    advance_after_batch(sandbox, batch)

    cred = _credibility_diffs(theater, sandbox, issuer_id)
    press = _pressure_diffs(theater, sandbox)
    factors = _build_factors(
        issuer_team=batch.issuer_team,
        signal_severity=sig_sev,
        action_severity=act_sev,
        gap=gap,
        credibility=cred,
        pressure=press,
    )

    return ImplicationsForecast(
        issuer_team=batch.issuer_team,
        issuer_faction_id=issuer_id,
        signal_severity=sig_sev,
        action_severity=act_sev,
        gap=gap,
        credibility=tuple(cred),
        pressure=tuple(press),
        factors=tuple(factors),
    )
