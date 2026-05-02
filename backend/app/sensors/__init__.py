"""Sensor adapters: one module per upstream data source.

Add a new sensor by subclassing `SensorBase` and registering it in
`SensorFactory`. Call sites should never branch on `isinstance`.
"""
from app.sensors.base import SensorBase, SensorReading
from app.sensors.factory import SensorFactory

__all__ = ["SensorBase", "SensorReading", "SensorFactory"]
