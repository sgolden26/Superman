"""Factory for instantiating sensor adapters by type.

Adapter modules self-register via `SensorFactory.register`. Call sites only
ever know about `SensorBase`.
"""
from __future__ import annotations

from collections.abc import Callable

from app.domain.enums import SensorType
from app.sensors.base import SensorBase


class SensorFactory:
    """Registry + builder for `SensorBase` implementations."""

    _registry: dict[SensorType, Callable[..., SensorBase]] = {}

    @classmethod
    def register(
        cls, sensor_type: SensorType, builder: Callable[..., SensorBase]
    ) -> None:
        """Associate a builder callable with a sensor type."""
        raise NotImplementedError

    @classmethod
    def create(cls, sensor_type: SensorType, /, **config: object) -> SensorBase:
        """Construct an adapter instance for the given type."""
        raise NotImplementedError

    @classmethod
    def available(cls) -> list[SensorType]:
        """Return the registered sensor types."""
        raise NotImplementedError
