"""Shared service utilities.

Currently empty; lives here so services consistently inherit from one place
when cross-cutting behaviour (metrics, audit logging) is added later.
"""
from __future__ import annotations


class ServiceBase:
    """Marker base class. Reserved for future cross-cutting concerns."""
