"""GdeltSnapshotSource: parse a frozen GDELT-style extract.

Reads a JSONL file (one event per line) under `data/intel/gdelt/`.
Each line:

```json
{"id": "...", "region_id": "terr.lithuania", "ts": "2026-04-25T08:30:00Z",
 "category": "protest", "headline": "...", "snippet": "...", "weight": -0.4}
```

Same shape as the curated source minus the anchor mechanism. The intent is
that this file is the output of a one-shot GDELT scrape that we commit so
the demo is reproducible offline.

`GdeltLiveSource` (separate file) is the runtime sibling that hits the GDELT
2.0 API; this snapshot variant exists so we can run the exact same FE/BE
codepath against frozen data.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from axis.intel.events import Event, EventCategory
from axis.intel.sources.base import IntelSource


class GdeltSnapshotSource(IntelSource):
    name = "gdelt_snapshot"

    def __init__(self, path: Path | str) -> None:
        self._path = Path(path)

    def fetch(self, now: datetime) -> list[Event]:  # noqa: ARG002 - now unused for frozen data
        if not self._path.exists():
            raise FileNotFoundError(
                f"GdeltSnapshotSource: extract not found: {self._path}. "
                "Drop a JSONL file there or switch to --source curated."
            )

        events: list[Event] = []
        with self._path.open("r", encoding="utf-8") as fh:
            for line_no, line in enumerate(fh, start=1):
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                try:
                    item = json.loads(line)
                except json.JSONDecodeError as exc:
                    raise ValueError(
                        f"GdeltSnapshotSource: malformed JSON at line {line_no} of {self._path}: {exc}"
                    ) from exc
                events.append(_event_from_dict(item))
        return events


def _event_from_dict(item: dict) -> Event:
    ts = datetime.fromisoformat(str(item["ts"]).replace("Z", "+00:00"))
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    url_raw = item.get("url")
    url = str(url_raw).strip() if isinstance(url_raw, str) and url_raw.strip() else None
    return Event(
        id=str(item["id"]),
        region_id=str(item["region_id"]),
        ts=ts,
        category=EventCategory(item["category"]),
        headline=str(item["headline"]),
        snippet=str(item.get("snippet", "")),
        weight=float(item["weight"]),
        source="gdelt",
        url=url,
    )
