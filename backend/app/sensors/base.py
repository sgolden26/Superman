"""Sensor adapter interface.

A sensor adapter wraps an upstream data source and exposes a normalised
lifecycle. Reduced to the bare interface for now; readings will return as a
concrete data shape when a real adapter is implemented.
"""
from __future__ import annotations

from abc import ABC, abstractmethod


class SensorBase(ABC):
    """Abstract base for all sensor adapters."""

    name: str

    @abstractmethod
    async def open(self) -> None:
        """Establish any persistent connection."""

    @abstractmethod
    async def close(self) -> None:
        """Release resources."""

    @abstractmethod
    async def healthcheck(self) -> bool:
        """Return True if the upstream is reachable and authenticated."""
