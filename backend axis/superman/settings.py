"""Cross-scenario knobs stored in `data/backend_settings.json`.

Most notably `live_news_enabled` decides whether `--source auto` may upgrade to
GDELT live scraping or pins the pipeline to curated / frozen payloads. Paths are
lazy-created once a user persists a tweak; missing files imply defaults below.

CLI resolution:

- `auto`: honour persisted flags (`True` ⇒ try live GDELT, `False` ⇒ curated snapshot).
- Any explicit `--source NAME`: skip settings entirely."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field, fields
from pathlib import Path
from typing import Any


_REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SETTINGS_PATH = _REPO_ROOT / "data" / "backend_settings.json"


@dataclass(slots=True)
class Settings:
    """Backend runtime settings, persisted as JSON."""

    live_news_enabled: bool = False
    """Master toggle for the GDELT live source. When False, the pipeline
    stays fully offline regardless of whether the live source is available."""

    gdelt_lookback_hours: int = 48
    """How far back the live GDELT query looks. Events older than ~5 days
    decay to nothing in the morale aggregator anyway."""

    gdelt_max_records_per_region: int = 75
    """Max articles per region per fetch. GDELT DOC API caps at 250."""

    gdelt_min_abs_tone: float = 1.0
    """Articles with |tone| below this threshold are considered noise and
    dropped before classification."""

    gdelt_request_timeout_s: float = 60.0
    """HTTP timeout for individual GDELT DOC API calls. The free-tier
    endpoint's TLS handshake alone routinely takes 15-25s and occasionally
    spikes past 30s; a generous timeout lets the first handshake of a batch
    actually complete. Once it does, all remaining regions reuse the same
    connection (no further handshakes) and respond in ~2s each."""

    gdelt_cache_ttl_hours: float = 12.0
    """How long a successful live fetch is reused before we hit the API
    again. The morale aggregator decays events over ~5 days so a half-day
    cache is well within the useful window and dramatically reduces the
    chance of a transient network blip degrading the demo to curated."""

    live_fallback_source: str = "curated"
    """Source used when `live_news_enabled` is True but the live fetch
    fails (network error, API change, etc). Must be 'curated' or
    'gdelt_snapshot'."""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "Settings":
        """Create a Settings from a dict, ignoring unknown keys (forward-compat)."""
        known = {f.name for f in fields(cls)}
        filtered = {k: v for k, v in raw.items() if k in known}
        return cls(**filtered)


def load_settings(path: Path | str | None = None) -> Settings:
    """Load settings from disk, or return defaults if the file is missing.

    Malformed JSON raises so the operator is forced to fix it; missing files
    silently fall back to defaults so first-run UX is clean.
    """
    p = Path(path or DEFAULT_SETTINGS_PATH)
    if not p.exists():
        return Settings()
    raw = json.loads(p.read_text())
    if not isinstance(raw, dict):
        raise ValueError(f"settings file {p} must contain a JSON object")
    return Settings.from_dict(raw)


def save_settings(settings: Settings, path: Path | str | None = None) -> Path:
    """Persist settings to disk, returning the resolved path."""
    p = Path(path or DEFAULT_SETTINGS_PATH)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(settings.to_dict(), indent=2) + "\n")
    return p


def resolve_intel_source(
    requested: str,
    settings: Settings | None = None,
) -> str:
    """Map a user-facing --source value to a concrete source name.

    `auto` consults the live-news toggle in settings; everything else is
    passed through verbatim so explicit flags always win over settings."""
    if requested != "auto":
        return requested
    s = settings or load_settings()
    return "gdelt_live" if s.live_news_enabled else "curated"


__all__ = [
    "Settings",
    "DEFAULT_SETTINGS_PATH",
    "load_settings",
    "save_settings",
    "resolve_intel_source",
]
