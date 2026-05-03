"""Enums for the unit taxonomy."""

from __future__ import annotations

from enum import Enum


class UnitDomain(str, Enum):
    GROUND = "ground"
    AIR = "air"
    NAVAL = "naval"


class UnitKind(str, Enum):
    INFANTRY_BRIGADE = "infantry_brigade"
    ARMOURED_BRIGADE = "armoured_brigade"
    AIR_WING = "air_wing"
    NAVAL_TASK_GROUP = "naval_task_group"
