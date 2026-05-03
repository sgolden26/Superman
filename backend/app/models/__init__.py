"""SQLModel table definitions.

Importing this package registers all tables on `SQLModel.metadata`. Keep one
table per module so parallel work does not collide on a single file.
"""
from __future__ import annotations

from app.models.person import Person
from app.models.reading import HeartbeatReading
from app.models.sensor import Sensor

__all__ = ["Person", "HeartbeatReading", "Sensor"]
