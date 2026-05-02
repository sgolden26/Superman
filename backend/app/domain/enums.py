"""Enumerations shared across the domain.

Add a new value here only when at least two modules need it. View-local
enumerations belong next to the code that uses them.
"""
from __future__ import annotations

from enum import Enum


class SensorType(str, Enum):
    GHOST_MURMUR = "ghost_murmur"
    SATELLITE = "satellite"
    DRONE = "drone"


class SensorStatus(str, Enum):
    ONLINE = "online"
    DEGRADED = "degraded"
    OFFLINE = "offline"


class Classification(str, Enum):
    UNKNOWN = "unknown"
    CIVILIAN = "civilian"
    COMBATANT = "combatant"


class ThreatLevel(str, Enum):
    NONE = "none"
    LOW = "low"
    ELEVATED = "elevated"
    HIGH = "high"
    CRITICAL = "critical"


class AlertKind(str, Enum):
    PROXIMITY = "proximity"
    CLASSIFICATION_CHANGE = "classification_change"
    SENSOR_FAILURE = "sensor_failure"
    LOST_TRACK = "lost_track"


class MissionStatus(str, Enum):
    PLANNED = "planned"
    ACTIVE = "active"
    COMPLETED = "completed"
    ABORTED = "aborted"
