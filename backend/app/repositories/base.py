"""Generic repository protocol."""
from __future__ import annotations

from typing import Generic, Protocol, TypeVar

T = TypeVar("T")


class Repository(Protocol, Generic[T]):
    """Minimal read surface. Extend per-aggregate when writes return."""

    async def list(self) -> list[T]: ...
