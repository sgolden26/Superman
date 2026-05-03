"""Outcome engine: fold an `Action` plus `RegionIntel` into odds and breakdown.

Side-effect free; numbers must track `docs/decision-engine.md` and the TS twin
under `frontend/src/decision/`.
"""

from superman.decision.actions import (
    Action,
    DEFAULT_ACTIONS,
    action_catalog_to_dict,
)
from superman.decision.evaluator import (
    BreakdownItem,
    Outcome,
    evaluate,
    CONTRIBUTION_DIVISOR,
    P_CEIL,
    P_FLOOR,
    SEVERITY_DIVISOR,
)

__all__ = [
    "Action",
    "DEFAULT_ACTIONS",
    "action_catalog_to_dict",
    "BreakdownItem",
    "Outcome",
    "evaluate",
    "CONTRIBUTION_DIVISOR",
    "P_CEIL",
    "P_FLOOR",
    "SEVERITY_DIVISOR",
]
