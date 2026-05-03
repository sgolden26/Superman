"""JSON adapters that sit beside domain objects without polluting models."""

from superman.serialization.snapshot import SnapshotExporter

__all__ = ["SnapshotExporter"]
