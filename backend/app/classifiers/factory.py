"""Classifier factory + registry."""
from __future__ import annotations

from collections.abc import Callable

from app.classifiers.base import ClassifierBase


class ClassifierFactory:
    """Resolve a classifier by name."""

    _registry: dict[str, Callable[..., ClassifierBase]] = {}

    @classmethod
    def register(cls, name: str, builder: Callable[..., ClassifierBase]) -> None:
        raise NotImplementedError

    @classmethod
    def create(cls, name: str, /, **config: object) -> ClassifierBase:
        raise NotImplementedError

    @classmethod
    def default(cls) -> ClassifierBase:
        """Return the configured default classifier (rule-based for now)."""
        raise NotImplementedError

    @classmethod
    def available(cls) -> list[str]:
        raise NotImplementedError
