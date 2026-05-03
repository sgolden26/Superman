"""Leader-statement adapters.

Two implementations behind a small ABC:

- `StubAdapter` reads a hand-curated `data/leader_statements.json` file. It is
  the demo default and the unit-test fixture path.
- `GDELTAdapter` queries the public GDELT 2.0 GKG / Events API for verbal
  events whose `Actor1` matches a faction's leader name and folds the result
  into `LeaderSignal` records using the CAMEO → `LeaderSignalType` map below.

Both yield `LeaderSignal` instances. The adapter does *not* mutate the
`Theater`; the caller appends the records (typically capped) to
`theater.leader_signals` so the snapshot exporter picks them up.

Severity is always signed `[-1, +1]`. The GDELT adapter divides Goldstein by
10 and stores the raw value in `goldstein` for traceability.
"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from axis.domain.political import LeaderSignal, LeaderSignalType


# CAMEO root code → LeaderSignalType mapping. Folds hundreds of granular
# CAMEO codes into Axis's six narrow categories; we use the first 2 chars
# of the code for the lookup.
CAMEO_TO_TYPE: dict[str, LeaderSignalType] = {
    "05": LeaderSignalType.REASSURANCE,  # consult / express intent to cooperate
    "06": LeaderSignalType.COMMITMENT,  # engage in material cooperation
    "10": LeaderSignalType.DEMAND,  # demand
    "11": LeaderSignalType.DENIAL,  # disapprove / reject
    "12": LeaderSignalType.DEMAND,  # reject demand
    "13": LeaderSignalType.THREAT,  # threaten
    "14": LeaderSignalType.DEMAND,  # protest officially
    "16": LeaderSignalType.ULTIMATUM,  # reduce relations / give ultimatum
    "17": LeaderSignalType.ULTIMATUM,  # coerce
    "18": LeaderSignalType.THREAT,  # assault
    "19": LeaderSignalType.THREAT,  # fight
    "20": LeaderSignalType.THREAT,  # use unconventional mass violence
}


def cameo_to_signal_type(cameo_code: str | None) -> LeaderSignalType:
    """Best-effort fold from a CAMEO event code into our narrow taxonomy."""
    if not cameo_code:
        return LeaderSignalType.COMMITMENT
    root = cameo_code[:2]
    return CAMEO_TO_TYPE.get(root, LeaderSignalType.COMMITMENT)


class LeaderStatementAdapter(ABC):
    """Plug-in source for `LeaderSignal` records."""

    name: str

    @abstractmethod
    def fetch(self) -> list[LeaderSignal]:
        """Return the latest signals available to this adapter."""


# ---------------------------------------------------------------------------
# StubAdapter
# ---------------------------------------------------------------------------


class StubAdapter(LeaderStatementAdapter):
    """Read pre-curated signals from `data/leader_statements.json`.

    The shape is:
        {
            "signals": [
                {
                    "id": "sig.stub.001",
                    "timestamp": "2026-04-24T09:00:00Z",
                    "speaker_faction_id": "ru",
                    "type": "ultimatum",
                    "severity": -0.85,
                    "text": "...",
                    "target_faction_id": "ua",
                    "cameo_code": "172",
                    "goldstein": -8.5
                },
                ...
            ]
        }
    """

    name = "stub"

    def __init__(self, path: Path | str | None = None) -> None:
        self._path = Path(path) if path is not None else _default_stub_path()

    def fetch(self) -> list[LeaderSignal]:
        if not self._path.exists():
            return []
        raw = json.loads(self._path.read_text())
        signals_raw: Iterable[dict[str, Any]] = raw.get("signals", [])
        return [_decode_signal(d) for d in signals_raw]


def _default_stub_path() -> Path:
    # Default: <repo>/data/leader_statements.json (two levels up from this
    # file's package: backend/axis/intel/...).
    here = Path(__file__).resolve()
    return here.parents[3] / "data" / "leader_statements.json"


def _decode_signal(d: dict[str, Any]) -> LeaderSignal:
    sig_type = d["type"]
    if not isinstance(sig_type, LeaderSignalType):
        sig_type = LeaderSignalType(sig_type)
    timestamp = d["timestamp"]
    if isinstance(timestamp, str):
        timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    return LeaderSignal(
        id=str(d["id"]),
        timestamp=timestamp,
        speaker_faction_id=str(d["speaker_faction_id"]),
        type=sig_type,
        severity=float(d["severity"]),
        text=str(d["text"]),
        target_faction_id=d.get("target_faction_id"),
        region_id=d.get("region_id"),
        cameo_code=d.get("cameo_code"),
        goldstein=d.get("goldstein"),
        source=str(d.get("source", "stub")),
        source_url=d.get("source_url"),
        turn=d.get("turn"),
    )


# ---------------------------------------------------------------------------
# GDELTAdapter
# ---------------------------------------------------------------------------


class GDELTAdapter(LeaderStatementAdapter):
    """Pull verbal events from the public GDELT 2.0 Events API.

    Hackathon-grade: a single best-effort query per call, no pagination,
    `urllib` only so the backend doesn't grow a `requests` dependency. If the
    HTTP fetch fails, we return an empty list and log to stdout (the caller
    falls back to whatever signals are already on the theater).

    `actor_to_faction` is a curated map from Actor1Name (raw GDELT value, e.g.
    `"PUTIN"`, `"ZELENSKY"`) → faction id. Anything not in the map is dropped.
    """

    name = "gdelt"

    BASE_URL = (
        "https://api.gdeltproject.org/api/v2/doc/doc?"
        "format=json&mode=ArtList&maxrecords=50&sort=DateDesc"
    )

    def __init__(
        self,
        *,
        actor_to_faction: dict[str, str],
        query: str,
        timespan: str = "24h",
        signal_id_prefix: str = "sig.gdelt",
    ) -> None:
        self._actor_to_faction = actor_to_faction
        self._query = query
        self._timespan = timespan
        self._prefix = signal_id_prefix

    def fetch(self) -> list[LeaderSignal]:
        """Fetch and decode. Returns [] on any failure."""
        try:
            payload = self._http_get_json()
        except Exception as exc:  # pragma: no cover - network error path
            print(f"[GDELTAdapter] fetch failed: {exc}")
            return []
        articles = payload.get("articles", []) if isinstance(payload, dict) else []
        out: list[LeaderSignal] = []
        for i, art in enumerate(articles):
            try:
                sig = self._decode_article(i, art)
            except (KeyError, ValueError) as exc:  # pragma: no cover
                print(f"[GDELTAdapter] skip {i}: {exc}")
                continue
            if sig is not None:
                out.append(sig)
        return out

    def _http_get_json(self) -> dict[str, Any]:
        """Issue the HTTP request via stdlib only."""
        from urllib.parse import urlencode
        from urllib.request import Request, urlopen

        params = {"query": self._query, "timespan": self._timespan}
        url = f"{self.BASE_URL}&{urlencode(params)}"
        req = Request(url, headers={"User-Agent": "axis-hackathon/0.5"})
        with urlopen(req, timeout=10) as resp:  # nosec - public API
            data = resp.read()
        return json.loads(data.decode("utf-8"))

    def _decode_article(self, idx: int, art: dict[str, Any]) -> LeaderSignal | None:
        """Convert a single article record into a `LeaderSignal`.

        GDELT GKG records expose `actor1name`, `cameoeventcode`, `goldstein`
        on Events API responses; the Doc API surfaces a sparser article body
        with a `tone` and `seendate` plus the source URL. We accept either
        shape; missing fields fall back to neutral defaults.
        """
        actor = (art.get("actor1name") or art.get("source", "")).upper().strip()
        faction_id = self._actor_to_faction.get(actor)
        if faction_id is None:
            return None

        cameo = art.get("cameoeventcode")
        sig_type = cameo_to_signal_type(cameo)

        # Goldstein scale is -10..+10. Doc API uses tone (-100..+100); fall
        # back to that if Goldstein is absent.
        if (goldstein_raw := art.get("goldstein")) is not None:
            goldstein = float(goldstein_raw)
            severity = max(-1.0, min(1.0, goldstein / 10.0))
        elif (tone_raw := art.get("tone")) is not None:
            tone = float(tone_raw)
            goldstein = tone / 10.0
            severity = max(-1.0, min(1.0, tone / 100.0))
        else:
            goldstein = None
            severity = 0.0

        seen = art.get("seendate") or art.get("date")
        timestamp = _parse_gdelt_timestamp(seen)
        return LeaderSignal(
            id=f"{self._prefix}.{idx:04d}",
            timestamp=timestamp,
            speaker_faction_id=faction_id,
            type=sig_type,
            severity=severity,
            text=str(art.get("title") or art.get("text") or "")[:280],
            target_faction_id=self._actor_to_faction.get(
                str(art.get("actor2name", "")).upper().strip(), None
            ),
            cameo_code=str(cameo) if cameo is not None else None,
            goldstein=goldstein,
            source="gdelt",
            source_url=art.get("url"),
        )


def _parse_gdelt_timestamp(raw: str | None) -> datetime:
    """Parse GDELT's `YYYYMMDDHHMMSS` or `YYYYMMDD` formats; UTC default."""
    if not raw:
        return datetime.now(tz=timezone.utc)
    s = str(raw)
    fmt = "%Y%m%d%H%M%S" if len(s) >= 14 else "%Y%m%d"
    try:
        return datetime.strptime(s[: len(fmt) // 2 * 2], fmt).replace(tzinfo=timezone.utc)
    except ValueError:
        return datetime.now(tz=timezone.utc)


# ---------------------------------------------------------------------------
# Convenience factory
# ---------------------------------------------------------------------------


def build_adapter(kind: str = "stub", **kwargs: Any) -> LeaderStatementAdapter:
    """Return a configured adapter by name.

    Mirrors the `axis.intel.pipeline.build_source` pattern.
    """
    if kind == "stub":
        return StubAdapter(path=kwargs.get("path"))
    if kind == "gdelt":
        return GDELTAdapter(
            actor_to_faction=kwargs.get("actor_to_faction", {}),
            query=kwargs.get("query", ""),
            timespan=kwargs.get("timespan", "24h"),
            signal_id_prefix=kwargs.get("signal_id_prefix", "sig.gdelt"),
        )
    raise ValueError(f"unknown leader-statement adapter: {kind!r}")
