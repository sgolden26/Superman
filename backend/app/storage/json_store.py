"""Single-file JSON persistence for demo deployments.

Repositories should read and write through this store rather than a database.
The file is created on first write with an empty document shape.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def _empty_document() -> dict[str, Any]:
    return {
        "sensors": [],
        "subjects": [],
    }


class JsonDocumentStore:
    """Load and save one JSON object keyed by aggregate name."""

    def __init__(self, path: Path) -> None:
        self._path = path

    @property
    def path(self) -> Path:
        return self._path

    def read(self) -> dict[str, Any]:
        if not self._path.exists():
            return _empty_document()
        with self._path.open(encoding="utf-8") as f:
            raw: object = json.load(f)
        if not isinstance(raw, dict):
            return _empty_document()
        base = _empty_document()
        for k, v in base.items():
            if k in raw and isinstance(raw[k], list):
                base[k] = raw[k]
        return base

    def write(self, data: dict[str, Any]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        with self._path.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str)
