"""Decision engine: maps an Action against a RegionIntel to a probability.

Pure functions; no I/O. Mirrored on the FE in `frontend/src/decision/`.
The constants here MUST stay in lock-step with `docs/decision-engine.md`
and the TS implementation.
"""

from axis.decision.actions import (
    Action,
    DEFAULT_ACTIONS,
    action_catalog_to_dict,
)
from axis.decision.evaluator import (
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
