"""Logging configuration."""
from __future__ import annotations

import logging
import sys

_CONFIGURED = False


def configure_logging(level: str = "info") -> None:
    """Initialise the root logger. Safe to call more than once (updates level)."""
    global _CONFIGURED
    numeric = getattr(logging, str(level).upper(), None)
    if not isinstance(numeric, int) or numeric == logging.NOTSET:
        numeric = logging.INFO

    root = logging.getLogger()
    if not _CONFIGURED:
        handler = logging.StreamHandler(sys.stderr)
        handler.setFormatter(
            logging.Formatter("%(asctime)s | %(levelname)s | %(name)s | %(message)s"),
        )
        root.addHandler(handler)
        _CONFIGURED = True
    root.setLevel(numeric)
