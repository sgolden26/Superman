"""Simulation engine.

Currently exposes the Order / OrderBatch model used by the live HTTP service
to mutate a `Theater`. Future siblings:

- `engine.py`: turn-based loop driving Theater state forward.
- `kinetics.py`: combat resolution between Units.
- `movement.py`: pathing across terrain, with domain-specific costs.
- `adjudication.py`: optional LLM-backed white-cell adjudicator.

Designed to depend only on `axis.domain` and `axis.units`. The intel layer
feeds into morale/readiness via well-defined hooks defined here later.
"""

from axis.sim.orders import (
    ExecutionResult,
    MoveOrder,
    Order,
    OrderBatch,
    OrderOutcome,
    OrderRegistry,
    PlayerTeam,
)

__all__ = [
    "ExecutionResult",
    "MoveOrder",
    "Order",
    "OrderBatch",
    "OrderOutcome",
    "OrderRegistry",
    "PlayerTeam",
]
