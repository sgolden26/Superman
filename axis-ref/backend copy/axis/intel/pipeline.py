"""IntelPipeline: orchestrate source -> aggregator -> snapshot."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from axis import INTEL_SCHEMA_VERSION
from axis.intel.events import Event
from axis.intel.morale import IntelSnapshot, aggregate_all
from axis.intel.sources import (
    CuratedSource,
    GdeltLiveSource,
    GdeltSnapshotSource,
    IntelSource,
)
from axis.settings import Settings, load_settings, resolve_intel_source

log = logging.getLogger(__name__)


@dataclass(slots=True)
class IntelPipeline:
    """Build an IntelSnapshot for a fixed set of regions."""

    source: IntelSource
    region_ids: tuple[str, ...]

    def run(self, *, now: datetime | None = None, tick_seq: int = 0) -> IntelSnapshot:
        now = now or datetime.now(tz=timezone.utc)
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)
        events = self.source.fetch(now)
        regions = aggregate_all(self.region_ids, events, now=now)
        return IntelSnapshot(
            intel_schema_version=INTEL_SCHEMA_VERSION,
            generated_at=now,
            source=self.source.name,
            tick_seq=tick_seq,
            regions=tuple(regions),
        )

    def write(
        self,
        path: Path | str,
        *,
        now: datetime | None = None,
        tick_seq: int = 0,
        indent: int = 2,
    ) -> Path:
        snapshot = self.run(now=now, tick_seq=tick_seq)
        out = Path(path)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(snapshot.to_dict(), indent=indent) + "\n")
        return out


_DEFAULT_DATA_DIR = Path(__file__).resolve().parents[3] / "data" / "intel"


class _FallbackSource(IntelSource):
    """Try `primary`; if it raises, log and delegate to `fallback`.

    Used for `gdelt_live` so a network blip doesn't take down a long-running
    `intel tick` loop. The snapshot's `source` field reports which source
    actually produced the events for this run.
    """

    def __init__(self, primary: IntelSource, fallback: IntelSource) -> None:
        self._primary = primary
        self._fallback = fallback
        self.name = primary.name

    def fetch(self, now: datetime) -> list[Event]:
        try:
            events = self._primary.fetch(now)
            self.name = self._primary.name
            return events
        except Exception as exc:  # noqa: BLE001 - fallback by design
            log.warning(
                "intel: primary source %r failed (%s); falling back to %r",
                self._primary.name,
                exc,
                self._fallback.name,
            )
            self.name = f"{self._fallback.name} (fallback from {self._primary.name})"
            return self._fallback.fetch(now)


def build_source(
    kind: str,
    *,
    data_dir: Path | None = None,
    settings: Settings | None = None,
) -> IntelSource:
    """Construct a concrete IntelSource by name.

    `kind` may be `auto`, in which case the active settings file decides
    between live and curated. When live is selected (either explicitly via
    `gdelt_live` or implicitly via `auto`), the source is wrapped in a
    fallback so transient network failures fall back to a known-good source
    without crashing the tick loop.
    """
    base = data_dir or _DEFAULT_DATA_DIR
    s = settings or load_settings()
    resolved = resolve_intel_source(kind, s)

    if resolved == "curated":
        return CuratedSource(base / "curated_events.json")
    if resolved == "gdelt_snapshot":
        return GdeltSnapshotSource(base / "gdelt" / "events.jsonl")
    if resolved == "gdelt_live":
        live = GdeltLiveSource(
            lookback_hours=s.gdelt_lookback_hours,
            max_records_per_region=s.gdelt_max_records_per_region,
            min_abs_tone=s.gdelt_min_abs_tone,
            timeout_s=s.gdelt_request_timeout_s,
            cache_path=base / "gdelt" / "live_cache.json",
            cache_ttl_hours=s.gdelt_cache_ttl_hours,
        )
        fallback_kind = s.live_fallback_source
        if fallback_kind not in ("curated", "gdelt_snapshot"):
            log.warning(
                "intel: invalid live_fallback_source %r in settings; using 'curated'.",
                fallback_kind,
            )
            fallback_kind = "curated"
        fallback = build_source(fallback_kind, data_dir=base, settings=s)
        return _FallbackSource(live, fallback)

    raise ValueError(
        f"Unknown intel source {kind!r}. Expected one of: auto, curated, "
        "gdelt_snapshot, gdelt_live."
    )


def default_region_ids() -> Iterable[str]:
    """Region ids the eastern_europe scenario expects intel for.

    The Russia-Ukraine theatre seeds 27 Ukrainian admin-1 oblasts plus a few
    contested territory shells. We watch a selection of frontline / strategic
    oblasts and the headline territory shells.
    """
    return (
        "obl.30",   # Kyiv City
        "obl.63",   # Kharkiv
        "obl.14",   # Donetsk
        "obl.09",   # Luhansk
        "obl.23",   # Zaporizhzhia
        "obl.65",   # Kherson
        "obl.51",   # Odesa
        "obl.43",   # AR Crimea
        "obl.59",   # Sumy
        "obl.74",   # Chernihiv
        "terr.donbas-occ",
        "terr.crimea-occ",
        "terr.south-occ",
        "terr.ukraine-free",
    )
