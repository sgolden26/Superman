"""Action catalog.

Static for v0.2 - shipped inside `state.json` so the FE evaluator and BE
evaluator share the same blob. To add an action: append here, no schema bump.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Mapping

from axis.intel.events import EventCategory


@dataclass(frozen=True, slots=True)
class Action:
    id: str
    name: str
    description: str
    base_rate: float  # 0..1 baseline P(success)
    morale_weight: float  # signed multiplier on (score-50)/50
    trend_weight: float  # signed multiplier on trend (-1|0|+1)
    severity_weight: float  # signed multiplier on net recent severity
    category_sensitivities: Mapping[EventCategory, float] = field(default_factory=dict)
    # Phase 9 political weights:
    # - aggression_bias: signed bias the action picks up under deadline pressure.
    #   Aggressive actions (deploy, escalate) take a positive value so high
    #   issuer pressure boosts their probability; restrained actions (sanctions,
    #   surveillance) take a negative value so the same pressure suppresses them.
    # - credibility_weight: signed multiplier on the issuer's outgoing
    #   `immediate` credibility toward the target faction. Coercive actions take
    #   a positive value (low credibility hurts them); diplomatic/non-kinetic
    #   actions take a smaller magnitude.
    pressure_aggression_bias: float = 0.0
    credibility_weight: float = 0.0
    # One-sentence wargame-context note. Surfaced in the FE on action hover and
    # echoed verbatim in the explain endpoint. Keep <= 140 chars and write for a
    # non-technical reader.
    wargame_note: str = ""

    def to_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "base_rate": self.base_rate,
            "morale_weight": self.morale_weight,
            "trend_weight": self.trend_weight,
            "severity_weight": self.severity_weight,
            "category_sensitivities": {
                cat.value: w for cat, w in self.category_sensitivities.items()
            },
            "pressure_aggression_bias": self.pressure_aggression_bias,
            "credibility_weight": self.credibility_weight,
            "wargame_note": self.wargame_note,
        }


DEFAULT_ACTIONS: tuple[Action, ...] = (
    Action(
        id="deploy_troops",
        name="Deploy Troops",
        description="Move kinetic forces into the region.",
        base_rate=0.65,
        morale_weight=0.30,
        trend_weight=0.10,
        severity_weight=0.15,
        category_sensitivities={
            EventCategory.PROTEST: -0.15,
            EventCategory.MILITARY_LOSS: -0.20,
            EventCategory.ECONOMIC_STRESS: -0.05,
            EventCategory.POLITICAL_INSTABILITY: -0.10,
            EventCategory.NATIONALIST_SENTIMENT: 0.10,
        },
        pressure_aggression_bias=0.18,
        credibility_weight=0.12,
        wargame_note=(
            "Signals commitment and shifts ground control, but locks units forward "
            "and raises the cost of backing off."
        ),
    ),
    Action(
        id="escalate_conflict",
        name="Escalate Conflict",
        description="Authorise kinetic strikes and raise the alert posture.",
        base_rate=0.50,
        morale_weight=0.25,
        trend_weight=0.10,
        severity_weight=0.20,
        category_sensitivities={
            EventCategory.PROTEST: -0.20,
            EventCategory.MILITARY_LOSS: -0.25,
            EventCategory.ECONOMIC_STRESS: -0.05,
            EventCategory.POLITICAL_INSTABILITY: -0.05,
            EventCategory.NATIONALIST_SENTIMENT: 0.20,
        },
        pressure_aggression_bias=0.25,
        credibility_weight=0.18,
        wargame_note=(
            "Authorises kinetic strikes; can break a stalemate but burns "
            "credibility fast if you back off mid-campaign."
        ),
    ),
    Action(
        id="impose_sanctions",
        name="Impose Sanctions",
        description="Apply targeted economic pressure on the region.",
        base_rate=0.60,
        morale_weight=-0.30,
        trend_weight=-0.10,
        severity_weight=-0.20,
        category_sensitivities={
            EventCategory.PROTEST: 0.15,
            EventCategory.MILITARY_LOSS: 0.05,
            EventCategory.ECONOMIC_STRESS: 0.20,
            EventCategory.POLITICAL_INSTABILITY: 0.15,
            EventCategory.NATIONALIST_SENTIMENT: -0.10,
        },
        pressure_aggression_bias=-0.10,
        credibility_weight=0.08,
        wargame_note=(
            "Non-kinetic pressure; slow but politically defensible to allied "
            "audiences and hard for the target to reciprocate symmetrically."
        ),
    ),
    Action(
        id="conduct_surveillance",
        name="Conduct Surveillance",
        description="Increase ISR coverage; non-kinetic, hard to refuse.",
        base_rate=0.80,
        morale_weight=0.05,
        trend_weight=0.05,
        severity_weight=0.05,
        category_sensitivities={
            EventCategory.PROTEST: 0.05,
            EventCategory.MILITARY_LOSS: 0.05,
            EventCategory.ECONOMIC_STRESS: 0.0,
            EventCategory.POLITICAL_INSTABILITY: 0.05,
            EventCategory.NATIONALIST_SENTIMENT: -0.05,
        },
        pressure_aggression_bias=-0.05,
        credibility_weight=0.02,
        wargame_note=(
            "Hard-to-refuse ISR uplift; preserves options without committing "
            "forces, but rarely changes the situation on its own."
        ),
    ),
)


def action_catalog_to_dict(catalog: tuple[Action, ...] = DEFAULT_ACTIONS) -> list[dict]:
    return [a.to_dict() for a in catalog]
