"""Generic repository protocol."""
from __future__ import annotations

from typing import Generic, Protocol, TypeVar
from uuid import UUID

T = TypeVar("T")


class Repository(Protocol, Generic[T]):
    async def get(self, id_: UUID) -> T | None: ...
    async def add(self, entity: T) -> T: ...
    async def update(self, entity: T) -> T: ...
    async def delete(self, id_: UUID) -> None: ...
