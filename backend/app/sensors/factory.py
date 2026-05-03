"""Factory for instantiating sensor adapters by name.

Adapter modules self-register via `SensorFactory.register`. Call sites only
ever know about `SensorBase`. Names are free-form strings until a shared
enum is reintroduced.
"""
from __future__ import annotations

from collections.abc import Callable

from app.sensors.base import SensorBase


class SensorFactory:
    """Registry + builder for `SensorBase` implementations."""

    _registry: dict[str, Callable[..., SensorBase]] = {}

    @classmethod
    def register(cls, name: str, builder: Callable[..., SensorBase]) -> None:
        """Associate a builder callable with a sensor name."""
        raise NotImplementedError

    @classmethod
    def create(cls, name: str, /, **config: object) -> SensorBase:
        """Construct an adapter instance for the given name."""
        raise NotImplementedError

    @classmethod
    def available(cls) -> list[str]:
        """Return the registered sensor names."""
        raise NotImplementedError
