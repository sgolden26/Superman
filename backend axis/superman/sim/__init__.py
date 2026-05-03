"""Simulation package.

Right now this re-exports order models the HTTP API uses to mutate a `Theater`.
Planned siblings might include a turn driver, richer kinetics, routers, and an
optional adjudicator.

Must stay free of intel imports; dependency direction is `superman.domain` /
`superman.units` only before optional morale hooks arrive.
"""

from superman.sim.orders import (
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
