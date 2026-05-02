"""Logging configuration."""
from __future__ import annotations

import logging


def configure_logging(level: str = "info") -> None:
    """Initialise the root logger. Idempotent."""
    raise NotImplementedError
