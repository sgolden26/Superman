"""TheaterStore: thread-safe in-memory holder for the live scenario."""

from __future__ import annotations

import threading
from typing import Any

from axis import scenarios
from axis.domain.theater import Theater
from axis.serialization.snapshot import SnapshotExporter
from axis.sim.orders import (
    ExecutionResult,
    OrderBatch,
    RoundExecutionResult,
    execute_round,
)
from axis.sim.political_engine import advance_after_batch


class TheaterStore:
    """Owns the mutable Theater that the HTTP service exposes.

    A process-wide singleton (see `get_store`) is fine for the hackathon
    single-tenant demo. The lock guards the read/mutate cycle so concurrent
    requests cannot interleave a snapshot with a partial apply.
    """

    def __init__(self, scenario_id: str = "eastern_europe") -> None:
        self._scenario_id = scenario_id
        self._theater: Theater = scenarios.get(scenario_id)()
        self._lock = threading.RLock()

    @property
    def scenario_id(self) -> str:
        return self._scenario_id

    def reset(self) -> None:
        """Rebuild the theatre from the seed scenario, discarding mutations."""
        with self._lock:
            self._theater = scenarios.get(self._scenario_id)()

    def snapshot_dict(self) -> dict[str, Any]:
        with self._lock:
            return SnapshotExporter(self._theater).to_dict()

    def with_theater(self, fn):
        """Run `fn(theater)` under the read lock and return its result.

        Used by callers (e.g. the explain endpoint) that need a coherent
        read across multiple Theater fields without exposing the internal
        lock or the mutable Theater instance.
        """
        with self._lock:
            return fn(self._theater)

    def political_dict(self) -> dict[str, Any]:
        """Slice of the snapshot containing only the political layer.

        Used by `GET /api/signals` so the FE can poll the political surface
        on a faster cadence than the full state.
        """
        with self._lock:
            full = SnapshotExporter(self._theater).to_dict()
            return {
                "schema_version": full["schema_version"],
                "current_turn": full["current_turn"],
                "pressure": full["pressure"],
                "credibility": full["credibility"],
                "leader_signals": full["leader_signals"],
            }

    def apply_batch(self, batch: OrderBatch) -> tuple[ExecutionResult, dict[str, Any]]:
        """Execute `batch` against the live theatre, returning result + snapshot.

        On success the political layer advances one turn (credibility update
        + pressure decay + deadline ramp). Failed batches do not advance the
        clock so the operator can amend and resubmit without burning a turn.
        """
        with self._lock:
            result = batch.execute(self._theater)
            if result.ok:
                advance_after_batch(self._theater, batch)
            snapshot = SnapshotExporter(self._theater).to_dict()
            return result, snapshot

    def apply_round(
        self, batches: list[OrderBatch]
    ) -> tuple[RoundExecutionResult, dict[str, Any]]:
        """Execute a hot-seat round (multiple per-team batches) atomically."""
        with self._lock:
            result = execute_round(self._theater, batches)
            snapshot = SnapshotExporter(self._theater).to_dict()
            return result, snapshot

    def with_theater(self, fn):
        """Run `fn(theater)` while holding the store lock. Returns whatever `fn` returns.

        Used by read-only consumers (e.g. the LLM order suggester) that need
        direct access to the live theatre without going through the JSON
        snapshot path.
        """
        with self._lock:
            return fn(self._theater)


_store: TheaterStore | None = None
_store_lock = threading.Lock()


def get_store() -> TheaterStore:
    """Process-wide singleton. Lazy so tests can override before first use."""
    global _store
    if _store is None:
        with _store_lock:
            if _store is None:
                _store = TheaterStore()
    return _store


def set_store(store: TheaterStore | None) -> None:
    """Inject a store (mainly for tests)."""
    global _store
    with _store_lock:
        _store = store
