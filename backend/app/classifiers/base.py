"""Classifier interface.

A classifier maps an observation context to a decision. The concrete context
and result types will be reintroduced when classification ships; the abstract
surface lives here so the factory has something to bind against.
"""
from __future__ import annotations

from abc import ABC, abstractmethod


class ClassifierBase(ABC):
    """Abstract base for all classifiers."""

    name: str

    @abstractmethod
    async def classify(self, context: object) -> object:
        """Return a classification for the given context."""
