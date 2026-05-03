"""Author-curated JSON feed with optional anchored relative timestamps."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from superman.intel.events import Event, EventCategory
from superman.intel.sources.base import IntelSource


class CuratedSource(IntelSource):
    name = "curated"

    def __init__(self, path: Path | str) -> None:
        self._path = Path(path)

    def fetch(self, now: datetime) -> list[Event]:
        if not self._path.exists():
            raise FileNotFoundError(
                f"CuratedSource: events file not found: {self._path}"
            )
        raw = json.loads(self._path.read_text())
        anchor_ts = _parse_anchor(raw.get("anchor_ts"), now)
        events_raw = raw.get("events", [])
        if not isinstance(events_raw, list):
            raise ValueError("curated events file must have a list at .events")

        events: list[Event] = []
        for item in events_raw:
            ts = _resolve_ts(item, anchor_ts, now)
            url_raw = item.get("url")
            url = (
                str(url_raw).strip()
                if isinstance(url_raw, str) and url_raw.strip()
                else None
            )
            events.append(
                Event(
                    id=str(item["id"]),
                    region_id=str(item["region_id"]),
                    ts=ts,
                    category=EventCategory(item["category"]),
                    headline=str(item["headline"]),
                    snippet=str(item.get("snippet", "")),
                    weight=float(item["weight"]),
                    source="curated",
                    url=url,
                )
            )
        return events


def _parse_anchor(value: object, now: datetime) -> datetime:
    """If anchor is provided, parse it; otherwise use `now` so offsets remain
    relative to the time the export runs (= "always feels fresh")."""
    if value is None:
        return now
    if isinstance(value, str):
        ts = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        return ts
    raise ValueError("curated anchor_ts must be a string or omitted")


def _resolve_ts(item: dict, anchor: datetime, now: datetime) -> datetime:
    if "ts" in item:
        ts = datetime.fromisoformat(str(item["ts"]).replace("Z", "+00:00"))
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        return ts
    if "offset_hours" in item:
        return anchor + timedelta(hours=float(item["offset_hours"]))
    raise ValueError(
        f"curated event {item.get('id')!r} must have either 'ts' or 'offset_hours'"
    )
