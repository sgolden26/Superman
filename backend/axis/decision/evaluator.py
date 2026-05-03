"""Decision evaluator.

Pure function: `evaluate(action, region) -> Outcome`. The TS mirror in
`frontend/src/decision/evaluator.ts` MUST produce the same numbers; both
read the same Action blob (shipped via `state.json`) and the same
RegionIntel blob (shipped via `intel.json`).

Formula and constants are documented in `docs/decision-engine.md`.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Literal

from axis.decision.actions import Action
from axis.intel.events import EventCategory
from axis.intel.morale import RegionIntel

SEVERITY_DIVISOR = 12.0
CONTRIBUTION_DIVISOR = 8.0
P_FLOOR = 0.05
P_CEIL = 0.95
SIGNIFICANT_DELTA = 0.015
# Group-level scalars applied at evaluation time. Intel-side contributions
# (morale, trend, severity, category drivers) are dampened; political-side
# contributions (pressure, credibility) are amplified, so political context
# outweighs morale by roughly 3:1 in per-action max swing. The TS mirror in
# `frontend/src/decision/evaluator.ts` MUST keep the same values.
MORALE_SCALE = 1.0 / 3.0
POLITICAL_SCALE = 3.0


BreakdownKind = Literal["base", "modifier", "category"]


@dataclass(frozen=True, slots=True)
class BreakdownItem:
    label: str
    kind: BreakdownKind
    delta: float  # contribution to probability, signed
    # Stable identifier the explain endpoint uses to attach a payload to a
    # specific row. Examples: "base", "morale", "trend", "severity",
    # "cat:protest", "pressure", "credibility". Optional for legacy callers.
    key: str = ""

    def to_dict(self) -> dict[str, object]:
        d: dict[str, object] = {
            "label": self.label,
            "kind": self.kind,
            "delta": round(self.delta, 4),
        }
        if self.key:
            d["key"] = self.key
        return d


@dataclass(frozen=True, slots=True)
class Outcome:
    action_id: str
    region_id: str
    probability: float
    breakdown: tuple[BreakdownItem, ...]
    explanation: str

    def to_dict(self) -> dict[str, object]:
        return {
            "action_id": self.action_id,
            "region_id": self.region_id,
            "probability": round(self.probability, 4),
            "breakdown": [b.to_dict() for b in self.breakdown],
            "explanation": self.explanation,
        }


def _clamp(x: float, lo: float, hi: float) -> float:
    if x < lo:
        return lo
    if x > hi:
        return hi
    return x


def _trend_signed(label: str) -> float:
    if label == "rising":
        return 1.0
    if label == "declining":
        return -1.0
    return 0.0


@dataclass(frozen=True, slots=True)
class PoliticalContext:
    """Political layer scalars the evaluator factors into probability.

    All fields are optional; absent values are treated as zero so legacy
    callers and intel-only contexts still work.
    """

    issuer_pressure: float | None = None  # 0..1 issuer faction pressure
    issuer_deadline_turns_remaining: int | None = None  # informational only
    bilateral_credibility_immediate: float | None = None  # -1..+1
    bilateral_credibility_resolve: float | None = None  # -1..+1
    issuer_faction_id: str | None = None
    target_faction_id: str | None = None


def evaluate(
    action: Action,
    region: RegionIntel,
    political: PoliticalContext | None = None,
) -> Outcome:
    morale_norm = (region.morale_score - 50.0) / 50.0
    p_morale = morale_norm * action.morale_weight * MORALE_SCALE

    trend_signed = _trend_signed(region.morale_trend)
    p_trend = trend_signed * action.trend_weight * MORALE_SCALE

    severity_sum = sum(d.contribution for d in region.drivers)
    severity_norm = _clamp(severity_sum / SEVERITY_DIVISOR, -1.0, 1.0)
    p_severity = severity_norm * action.severity_weight * MORALE_SCALE

    category_items: list[BreakdownItem] = []
    for d in region.drivers:
        sensitivity = action.category_sensitivities.get(d.category, 0.0)
        if sensitivity == 0.0:
            continue
        # Intensity is loudness (always non-negative); the catalog's signed
        # sensitivity decides whether this category helps or hurts the action.
        intensity = _clamp(abs(d.contribution) / CONTRIBUTION_DIVISOR, 0.0, 1.0)
        delta = sensitivity * intensity * MORALE_SCALE
        if abs(delta) < SIGNIFICANT_DELTA:
            continue
        category_items.append(
            BreakdownItem(
                label=_category_label(d.category, d.contribution),
                kind="category",
                delta=delta,
                key=f"cat:{d.category.value}",
            )
        )

    p_categories = sum(item.delta for item in category_items)

    p_pressure, pressure_label = _pressure_delta(action, political)
    p_credibility, credibility_label = _credibility_delta(action, political)
    p_pressure *= POLITICAL_SCALE
    p_credibility *= POLITICAL_SCALE

    raw = (
        action.base_rate
        + p_morale
        + p_trend
        + p_severity
        + p_categories
        + p_pressure
        + p_credibility
    )
    probability = _clamp(raw, P_FLOOR, P_CEIL)

    breakdown: list[BreakdownItem] = [
        BreakdownItem(
            label="base rate", kind="base", delta=action.base_rate, key="base"
        ),
        BreakdownItem(
            label=_morale_label(morale_norm),
            kind="modifier",
            delta=p_morale,
            key="morale",
        ),
    ]
    if abs(p_trend) >= SIGNIFICANT_DELTA:
        breakdown.append(
            BreakdownItem(
                label=f"{region.morale_trend} trend",
                kind="modifier",
                delta=p_trend,
                key="trend",
            )
        )
    if abs(p_severity) >= SIGNIFICANT_DELTA:
        breakdown.append(
            BreakdownItem(
                label="recent event severity",
                kind="modifier",
                delta=p_severity,
                key="severity",
            )
        )
    breakdown.extend(category_items)
    if abs(p_pressure) >= SIGNIFICANT_DELTA and pressure_label:
        breakdown.append(
            BreakdownItem(
                label=pressure_label,
                kind="modifier",
                delta=p_pressure,
                key="pressure",
            )
        )
    if abs(p_credibility) >= SIGNIFICANT_DELTA and credibility_label:
        breakdown.append(
            BreakdownItem(
                label=credibility_label,
                kind="modifier",
                delta=p_credibility,
                key="credibility",
            )
        )

    explanation = _build_explanation(
        action=action,
        region=region,
        probability=probability,
        breakdown=breakdown,
    )

    return Outcome(
        action_id=action.id,
        region_id=region.region_id,
        probability=probability,
        breakdown=tuple(breakdown),
        explanation=explanation,
    )


def _pressure_delta(
    action: Action, political: PoliticalContext | None
) -> tuple[float, str | None]:
    """Aggression bias scaled by issuer pressure.

    Returns `(delta, label)`. Label is None when the contribution is below the
    significance threshold (the caller still sums delta, the row is dropped).
    """
    if political is None or political.issuer_pressure is None:
        return 0.0, None
    if action.pressure_aggression_bias == 0.0:
        return 0.0, None
    delta = action.pressure_aggression_bias * political.issuer_pressure
    if political.issuer_deadline_turns_remaining is not None:
        label = (
            f"deadline pressure (T-{political.issuer_deadline_turns_remaining})"
        )
    else:
        label = "deadline pressure"
    return delta, label


def _credibility_delta(
    action: Action, political: PoliticalContext | None
) -> tuple[float, str | None]:
    """Coercion-strength multiplier from issuer's outgoing credibility.

    Uses `immediate` (recent signal/action consistency) since coercive
    affordances depend on near-term reputation. We keep the math simple: delta
    = credibility_weight * immediate, so positive credibility helps coercive
    actions and negative credibility hurts them.
    """
    if political is None or political.bilateral_credibility_immediate is None:
        return 0.0, None
    if action.credibility_weight == 0.0:
        return 0.0, None
    delta = action.credibility_weight * political.bilateral_credibility_immediate
    src = political.issuer_faction_id or "issuer"
    dst = political.target_faction_id or "target"
    band = "low credibility" if political.bilateral_credibility_immediate < 0 else "credibility"
    label = f"{band} ({src.upper()}→{dst.upper()})"
    return delta, label


def _morale_label(morale_norm: float) -> str:
    if morale_norm >= 0.4:
        return "high morale"
    if morale_norm <= -0.4:
        return "low morale"
    return "neutral morale"


_CATEGORY_PHRASE: dict[EventCategory, tuple[str, str]] = {
    EventCategory.PROTEST: ("protest activity", "protest activity"),
    EventCategory.MILITARY_LOSS: ("recent military setbacks", "improving military posture"),
    EventCategory.ECONOMIC_STRESS: ("economic stress", "easing economic stress"),
    EventCategory.POLITICAL_INSTABILITY: ("political instability", "political stabilisation"),
    EventCategory.NATIONALIST_SENTIMENT: ("subdued nationalist sentiment", "rising nationalist sentiment"),
}


def _category_label(category: EventCategory, contribution: float) -> str:
    negative_phrase, positive_phrase = _CATEGORY_PHRASE.get(
        category, (category.value, category.value)
    )
    return negative_phrase if contribution < 0 else positive_phrase


def _build_explanation(
    *,
    action: Action,
    region: RegionIntel,
    probability: float,
    breakdown: Iterable[BreakdownItem],
) -> str:
    modifiers = [b for b in breakdown if b.kind != "base"]
    modifiers.sort(key=lambda b: abs(b.delta), reverse=True)
    top = modifiers[:2]
    pct = round(probability * 100)
    base_pct = round(action.base_rate * 100)
    if not top:
        return f"{action.name} in {region.region_id}: {pct}% (baseline)."

    direction = "Reduced" if probability < action.base_rate else "Boosted"
    if abs(probability - action.base_rate) < 0.005:
        direction = "Held at"

    phrases = [_phrase_for(item) for item in top]
    joined = " and ".join(p for p in phrases if p)
    return (
        f"{direction} from {base_pct}% baseline to {pct}% by {joined}."
        if joined
        else f"{action.name}: {pct}%."
    )


def _phrase_for(item: BreakdownItem) -> str:
    if item.delta == 0:
        return ""
    sign = "−" if item.delta < 0 else "+"
    pct = round(abs(item.delta) * 100)
    return f"{item.label} ({sign}{pct}%)"
