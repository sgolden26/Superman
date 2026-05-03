"""GdeltLiveSource: real-time GDELT 2.0 DOC API client.

Hits the public DOC 2.0 API (no key required) once per region, classifies
each returned article into our `EventCategory` taxonomy from its title,
and converts the result into a signed weight in [-1, 1].

API reference: https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/

Design notes:

- Pure stdlib (`http.client` + `urllib.parse`) so we don't pull in `requests`.
  We use a persistent `HTTPSConnection` across the per-region calls because
  GDELT's free-tier endpoint has a slow TLS handshake; reusing one socket
  amortises that cost over the whole batch.
- Per-region queries with country/keyword filters; English-language only
  to keep the classifier simple.
- The classifier is a small regex word list. Articles whose titles don't
  hit any pattern are dropped (the API returns a lot of off-topic noise).
- Weight: GDELT's `ArtList` JSON mode does not expose per-article tone, so
  we map category -> signed magnitude using `DEFAULT_CATEGORY_SIGN` and
  bump magnitude when titles contain high-severity keywords. If a future
  API revision starts returning `tone`, we use it directly.
"""

from __future__ import annotations

import hashlib
import http.client
import json
import logging
import re
import time
import urllib.parse
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable

from axis.intel.events import DEFAULT_CATEGORY_SIGN, Event, EventCategory
from axis.intel.sources.base import IntelSource

log = logging.getLogger(__name__)

GDELT_DOC_API = "https://api.gdeltproject.org/api/v2/doc/doc"
_GDELT_PARSED = urllib.parse.urlsplit(GDELT_DOC_API)
_GDELT_HOST = _GDELT_PARSED.hostname or "api.gdeltproject.org"
_GDELT_PORT = _GDELT_PARSED.port or 443
_GDELT_PATH = _GDELT_PARSED.path or "/api/v2/doc/doc"
USER_AGENT = "axis-wargame/0.2 (+https://github.com/sgolden26/Axis)"

# Network errors we treat as transient and worth one retry. http.client raises
# its own HTTPException family for protocol-level issues (RemoteDisconnected,
# BadStatusLine, etc.); ssl/socket failures land in OSError.
_TRANSIENT_NET_ERRORS: tuple[type[BaseException], ...] = (
    TimeoutError,
    http.client.HTTPException,
    OSError,
)
_RETRY_BACKOFF_S = 1.0

# Brief pause between consecutive region queries on the shared connection.
# GDELT's free-tier endpoint enforces a per-IP rate limit (we observed HTTP
# 429s and TLS-level resets on back-to-back requests). 1.5s is conservative
# enough to clear it while keeping a 14-region batch under ~25s of cumulative
# pacing overhead, which is well inside the 12h cache TTL anyway.
_INTER_REGION_DELAY_S = 1.5


@dataclass(frozen=True, slots=True)
class _RegionQuery:
    """How to ask GDELT for news about one of our scenario regions."""

    region_id: str
    query: str  # GDELT DOC query string


# Hand-tuned per-region queries. Keep these tight - the DOC API will OR
# everything inside the parens and AND with the language filter. Adding too
# many keywords flips the API into "everything" mode.
DEFAULT_REGION_QUERIES: tuple[_RegionQuery, ...] = (
    _RegionQuery(
        region_id="obl.30",
        query='(Kyiv OR Kiev OR "Ukraine government" OR Bankova)',
    ),
    _RegionQuery(
        region_id="obl.63",
        query='(Kharkiv OR Kharkov OR Vovchansk OR Kupiansk)',
    ),
    _RegionQuery(
        region_id="obl.14",
        query='(Donetsk OR Bakhmut OR Avdiivka OR Pokrovsk OR Mariupol)',
    ),
    _RegionQuery(
        region_id="obl.09",
        query='(Luhansk OR Lugansk OR Severodonetsk OR Lyman OR Kreminna)',
    ),
    _RegionQuery(
        region_id="obl.23",
        query='(Zaporizhzhia OR Zaporozhye OR Tokmak OR Melitopol OR Robotyne)',
    ),
    _RegionQuery(
        region_id="obl.65",
        query='(Kherson OR "Dnipro estuary" OR Kakhovka OR "left bank")',
    ),
    _RegionQuery(
        region_id="obl.51",
        query='(Odesa OR Odessa OR "Black Sea grain" OR Izmail)',
    ),
    _RegionQuery(
        region_id="obl.43",
        query='(Crimea OR Simferopol OR Sevastopol OR "Kerch bridge" OR Dzhankoi)',
    ),
    _RegionQuery(
        region_id="obl.59",
        query='(Sumy OR "Sumy oblast" OR "Russian border")',
    ),
    _RegionQuery(
        region_id="obl.74",
        query='(Chernihiv OR "Chernihiv oblast")',
    ),
    _RegionQuery(
        region_id="terr.donbas-occ",
        query='(Donbas OR "occupied Donetsk" OR "occupied Luhansk")',
    ),
    _RegionQuery(
        region_id="terr.crimea-occ",
        query='(Crimea OR "occupied Crimea" OR Sevastopol)',
    ),
    _RegionQuery(
        region_id="terr.south-occ",
        query='("southern Ukraine" OR Melitopol OR Berdiansk OR "land bridge")',
    ),
    _RegionQuery(
        region_id="terr.ukraine-free",
        query='(Ukraine OR Kyiv OR Lviv OR Dnipro)',
    ),
)


# Word-list classifier. Order matters: we walk categories top to bottom and
# take the first hit. military_loss is checked before protest because "attack
# on protest" should still register as kinetic.
_CATEGORY_PATTERNS: tuple[tuple[EventCategory, re.Pattern[str]], ...] = (
    (
        EventCategory.MILITARY_LOSS,
        re.compile(
            r"\b("
            r"killed|casualt(?:y|ies)|wounded|destroyed|missile|drone|strike|"
            r"airstrike|shelling|shelled|explos\w+|sabotage|downed|shot down|"
            r"attack|attacked|combat|incursion|fire(?:fight)?|skirmish|"
            r"deserter|desertion|mobiliz\w+|conscript\w+"
            r")\b",
            re.IGNORECASE,
        ),
    ),
    (
        EventCategory.PROTEST,
        re.compile(
            r"\b("
            r"protest\w*|demonstrat\w+|rally|rallies|march(?:es|ed|ing)?|"
            r"strike(?:s|rs)?|riot\w*|sit-?in|walkout|blockade|picket"
            r")\b",
            re.IGNORECASE,
        ),
    ),
    (
        EventCategory.ECONOMIC_STRESS,
        re.compile(
            r"\b("
            r"inflation|sanction\w*|recession|crisis|crash|"
            r"price\s+(?:rise|hike|surge|jump)|"
            r"currency|ruble|rouble|zloty|euro|"
            r"unemploy\w+|layoff\w*|shortage|fuel|energy"
            r")\b",
            re.IGNORECASE,
        ),
    ),
    (
        EventCategory.POLITICAL_INSTABILITY,
        re.compile(
            r"\b("
            r"resign\w*|coup|no[- ]confidence|scandal|corrupt\w+|"
            r"reshuffle|ous(?:t|ted|ter)|impeach\w+|disput\w+|"
            r"crackdown|detained|arrest\w*"
            r")\b",
            re.IGNORECASE,
        ),
    ),
    (
        EventCategory.NATIONALIST_SENTIMENT,
        re.compile(
            r"\b("
            r"defen[cs]e\s+spending|recruit\w+|parade|patriot\w+|"
            r"pride|alliance|NATO|allied|reinforc\w+|"
            r"deploy\w+|reservist\w*|volunteer\w*|standup|stand[- ]up|"
            r"summit"
            r")\b",
            re.IGNORECASE,
        ),
    ),
)


@dataclass(frozen=True, slots=True)
class _CacheEntry:
    """In-memory representation of a successful prior fetch."""

    fetched_at: datetime
    lookback_hours: int
    region_ids: tuple[str, ...]
    events: tuple[Event, ...]


class _ConnState:
    """Holds a single persistent HTTPS connection across region fetches.

    GDELT's free-tier API does a slow TLS handshake (often 10s+ on its own).
    Reusing the connection turns 14 handshakes per batch into 1; on any
    network/protocol error we drop the socket so the next request gets a
    fresh one. The class is intentionally not thread-safe; one instance per
    `fetch()` call.
    """

    __slots__ = ("_host", "_port", "_timeout_s", "_conn")

    def __init__(self, host: str, port: int, timeout_s: float) -> None:
        self._host = host
        self._port = port
        self._timeout_s = timeout_s
        self._conn: http.client.HTTPSConnection | None = None

    def get(self) -> http.client.HTTPSConnection:
        if self._conn is None:
            self._conn = http.client.HTTPSConnection(
                self._host, self._port, timeout=self._timeout_s
            )
        return self._conn

    def reset(self) -> None:
        if self._conn is not None:
            try:
                self._conn.close()
            except Exception:  # noqa: BLE001 - close is best-effort
                pass
            self._conn = None

    def close(self) -> None:
        self.reset()


class GdeltLiveSource(IntelSource):
    name = "gdelt_live"

    def __init__(
        self,
        *,
        lookback_hours: int = 48,
        max_records_per_region: int = 75,
        min_abs_tone: float = 1.0,
        timeout_s: float = 30.0,
        region_queries: Iterable[_RegionQuery] | None = None,
        cache_path: Path | str | None = None,
        cache_ttl_hours: float = 12.0,
    ) -> None:
        self._lookback_hours = max(1, int(lookback_hours))
        self._max_records = min(250, max(10, int(max_records_per_region)))
        self._min_abs_tone = float(min_abs_tone)
        self._timeout_s = float(timeout_s)
        self._regions = tuple(region_queries) if region_queries is not None else DEFAULT_REGION_QUERIES
        self._cache_path = Path(cache_path) if cache_path else None
        self._cache_ttl = timedelta(hours=max(0.0, float(cache_ttl_hours)))

    def fetch(self, now: datetime) -> list[Event]:
        # Cache lookup: if we have a hit whose config matches and is younger
        # than the TTL, skip the network entirely. Half a day of staleness
        # is well inside the morale aggregator's ~5-day decay window.
        cached = self._load_cache()
        if cached is not None and self._cache_is_fresh(cached, now):
            log.info(
                "gdelt_live: cache hit (%d events, age=%.1fh, ttl=%.1fh)",
                len(cached.events),
                (now - cached.fetched_at).total_seconds() / 3600.0,
                self._cache_ttl.total_seconds() / 3600.0,
            )
            return list(cached.events)

        # GDELT routinely returns the same wire story syndicated across many
        # domains. Dedupe per (region, normalized title) keeping the earliest
        # publication time so the morale aggregator sees one signal per story.
        seen: dict[tuple[str, str], Event] = {}
        n_ok = 0
        n_fail = 0
        state = _ConnState(_GDELT_HOST, _GDELT_PORT, self._timeout_s)
        try:
            for i, rq in enumerate(self._regions):
                if i > 0:
                    # Pace requests to stay under GDELT's per-IP throttle.
                    time.sleep(_INTER_REGION_DELAY_S)
                try:
                    articles = self._fetch_region(rq, state)
                except RuntimeError as exc:
                    # Per-region failure must not poison the rest of the batch:
                    # log it, count it, and move on. The wider _FallbackSource
                    # only kicks in when every region fails AND we have no
                    # cache to fall back to.
                    n_fail += 1
                    log.warning("%s", exc)
                    continue
                n_ok += 1
                for art in articles:
                    ev = self._article_to_event(rq.region_id, art)
                    if ev is None:
                        continue
                    key = (rq.region_id, _norm_title(ev.headline))
                    prev = seen.get(key)
                    if prev is None or ev.ts < prev.ts:
                        seen[key] = ev
        finally:
            state.close()

        events = sorted(seen.values(), key=lambda e: e.ts, reverse=True)
        log.info(
            "gdelt_live: fetched %d unique events across %d/%d regions (lookback=%dh)",
            len(events),
            n_ok,
            len(self._regions),
            self._lookback_hours,
        )

        if n_ok > 0:
            self._save_cache(events, now)
            return events

        # Total network failure. Prefer a stale cache over a fallback source
        # because stale GDELT > curated for live-feel.
        if cached is not None:
            log.warning(
                "gdelt_live: all %d region fetches failed; serving stale cache "
                "from %s (%d events)",
                n_fail,
                cached.fetched_at.isoformat(),
                len(cached.events),
            )
            return list(cached.events)

        raise RuntimeError(
            f"gdelt_live: all {n_fail} region fetches failed and no cache available"
        )

    def _fetch_region(self, rq: _RegionQuery, state: _ConnState) -> list[dict]:
        """GET one region's articles, retrying once on a transient failure.

        Reuses `state`'s persistent HTTPS connection so the slow TLS handshake
        is amortised across the whole batch. On any network/protocol error
        we close the connection (it may be half-open) so the next attempt
        starts clean."""
        params = {
            "query": f"{rq.query} sourcelang:eng",
            "mode": "ArtList",
            "format": "json",
            "timespan": f"{self._lookback_hours}h",
            "maxrecords": str(self._max_records),
            "sort": "HybridRel",
        }
        path = f"{_GDELT_PATH}?{urllib.parse.urlencode(params)}"
        headers = {
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
            "Connection": "keep-alive",
        }

        last_exc: BaseException | None = None
        last_status: int | None = None
        for attempt in range(2):  # one try + one retry
            if attempt > 0:
                time.sleep(_RETRY_BACKOFF_S)
                # The previous attempt may have left the connection in a
                # half-open state; force a fresh socket for the retry.
                state.reset()
            try:
                conn = state.get()
                conn.request("GET", path, headers=headers)
                resp = conn.getresponse()
                body = resp.read().decode("utf-8", errors="replace")
                status = resp.status
            except _TRANSIENT_NET_ERRORS as exc:
                last_exc = exc
                state.reset()
                continue

            # Treat 429 / 5xx as retryable and re-handshake. Other 4xx are
            # definitive (bad query, etc) and don't benefit from a retry.
            if status == 429 or status >= 500:
                last_exc = RuntimeError(f"HTTP {status}")
                last_status = status
                state.reset()
                continue
            if status >= 400:
                raise RuntimeError(
                    f"gdelt_live: region {rq.region_id!r} HTTP {status}"
                )

            if not body.strip():
                return []
            try:
                payload = json.loads(body)
            except json.JSONDecodeError as exc:
                raise RuntimeError(
                    f"gdelt_live: malformed JSON for region {rq.region_id!r}: {exc}"
                ) from exc

            articles = payload.get("articles") if isinstance(payload, dict) else None
            if not isinstance(articles, list):
                return []
            return articles

        suffix = (
            f"HTTP {last_status}"
            if last_status is not None
            else f"{type(last_exc).__name__}: {last_exc}"
        )
        raise RuntimeError(
            f"gdelt_live: failed to fetch region {rq.region_id!r} after retry ({suffix})"
        )

    def _article_to_event(self, region_id: str, art: dict) -> Event | None:
        title = str(art.get("title") or "").strip()
        if not title:
            return None

        seen = art.get("seendate")
        ts = _parse_seendate(seen)
        if ts is None:
            return None

        category = _classify(title)
        if category is None:
            return None

        tone = _safe_float(art.get("tone"))
        if tone is not None:
            if abs(tone) < self._min_abs_tone:
                return None
            weight = _tone_to_weight(tone)
        else:
            weight = _category_to_weight(category, title)
        if weight == 0.0:
            return None

        url = str(art.get("url") or "").strip()
        ev_id = _stable_event_id(url or title, seen=str(seen))

        # GDELT URLs are sometimes protocol-relative or otherwise malformed;
        # the Event ctor will reject anything that isn't http(s)://, so guard
        # here to keep the article rather than drop it for a bad link.
        clean_url = url if url.startswith(("http://", "https://")) else None

        return Event(
            id=ev_id,
            region_id=region_id,
            ts=ts,
            category=category,
            headline=title[:200],
            snippet=str(art.get("domain") or "")[:120],
            weight=weight,
            source="gdelt",
            url=clean_url,
        )

    # ---------- cache ----------

    def _cache_is_fresh(self, entry: _CacheEntry, now: datetime) -> bool:
        if self._cache_ttl.total_seconds() <= 0:
            return False
        if entry.lookback_hours != self._lookback_hours:
            return False
        if entry.region_ids != tuple(rq.region_id for rq in self._regions):
            return False
        return (now - entry.fetched_at) < self._cache_ttl

    def _load_cache(self) -> _CacheEntry | None:
        if self._cache_path is None or not self._cache_path.exists():
            return None
        try:
            raw = json.loads(self._cache_path.read_text())
        except (OSError, json.JSONDecodeError) as exc:
            log.warning("gdelt_live: ignoring unreadable cache %s: %s", self._cache_path, exc)
            return None
        try:
            fetched_at = datetime.fromisoformat(str(raw["fetched_at"]))
            if fetched_at.tzinfo is None:
                fetched_at = fetched_at.replace(tzinfo=timezone.utc)
            lookback_hours = int(raw["lookback_hours"])
            region_ids = tuple(str(r) for r in raw.get("region_ids", ()))
            events = tuple(_event_from_cache_dict(d) for d in raw.get("events", ()))
        except (KeyError, TypeError, ValueError) as exc:
            log.warning("gdelt_live: ignoring malformed cache %s: %s", self._cache_path, exc)
            return None
        return _CacheEntry(
            fetched_at=fetched_at,
            lookback_hours=lookback_hours,
            region_ids=region_ids,
            events=events,
        )

    def _save_cache(self, events: list[Event], now: datetime) -> None:
        if self._cache_path is None:
            return
        payload = {
            "fetched_at": now.isoformat(),
            "lookback_hours": self._lookback_hours,
            "region_ids": [rq.region_id for rq in self._regions],
            "events": [e.to_dict() for e in events],
        }
        try:
            self._cache_path.parent.mkdir(parents=True, exist_ok=True)
            self._cache_path.write_text(json.dumps(payload, indent=2) + "\n")
        except OSError as exc:
            log.warning("gdelt_live: failed to write cache %s: %s", self._cache_path, exc)


def _event_from_cache_dict(raw: dict) -> Event:
    """Inverse of `Event.to_dict` for our cache file. Mirrors gdelt_snapshot's
    parser but lives here so the cache format stays a private contract."""
    ts = datetime.fromisoformat(str(raw["ts"]).replace("Z", "+00:00"))
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    url_raw = raw.get("url")
    url = str(url_raw).strip() if isinstance(url_raw, str) and url_raw.strip() else None
    return Event(
        id=str(raw["id"]),
        region_id=str(raw["region_id"]),
        ts=ts,
        category=EventCategory(raw["category"]),
        headline=str(raw["headline"]),
        snippet=str(raw.get("snippet", "")),
        weight=float(raw["weight"]),
        source=str(raw.get("source", "gdelt")),
        url=url,
    )


def _safe_float(value: object) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _parse_seendate(value: object) -> datetime | None:
    """Parse GDELT's compact `YYYYMMDDTHHMMSSZ` timestamp."""
    if not isinstance(value, str) or len(value) < 15:
        return None
    try:
        ts = datetime.strptime(value, "%Y%m%dT%H%M%SZ")
        return ts.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _classify(title: str) -> EventCategory | None:
    """Map an article title to an EventCategory. Returns None when nothing
    matches; the caller should drop the article so we don't pollute the
    aggregator with off-topic wire copy."""
    for category, pattern in _CATEGORY_PATTERNS:
        if pattern.search(title):
            return category
    return None


def _tone_to_weight(tone: float) -> float:
    """Map GDELT tone (~[-10, 10]) onto our signed weight in [-1, 1]."""
    w = tone / 5.0
    if w > 1.0:
        return 1.0
    if w < -1.0:
        return -1.0
    return round(w, 3)


# High-severity keywords that bump magnitude regardless of category.
_INTENSIFIER = re.compile(
    r"\b(killed|dead|deaths|massive|destroyed|major|crisis|unprecedented|"
    r"emergency|coup|invasion|war|critical|severe)\b",
    re.IGNORECASE,
)

# Per-category baseline magnitudes when GDELT doesn't expose tone.
_CATEGORY_BASE_MAG: dict[EventCategory, float] = {
    EventCategory.MILITARY_LOSS: 0.50,
    EventCategory.PROTEST: 0.40,
    EventCategory.POLITICAL_INSTABILITY: 0.35,
    EventCategory.ECONOMIC_STRESS: 0.30,
    EventCategory.NATIONALIST_SENTIMENT: 0.30,
}


def _category_to_weight(category: EventCategory, title: str) -> float:
    """Fallback weighting when no per-article tone is available.

    Sign comes from `DEFAULT_CATEGORY_SIGN`; magnitude is a category baseline
    bumped slightly when the headline contains high-severity keywords."""
    sign = DEFAULT_CATEGORY_SIGN.get(category, -1)
    mag = _CATEGORY_BASE_MAG.get(category, 0.30)
    if _INTENSIFIER.search(title):
        mag = min(1.0, mag + 0.20)
    return round(sign * mag, 3)


def _stable_event_id(seed: str, *, seen: str) -> str:
    h = hashlib.sha1(f"{seed}|{seen}".encode("utf-8")).hexdigest()[:12]
    return f"gdelt.live.{h}"


def _norm_title(title: str) -> str:
    """Lowercase + collapse whitespace + strip punctuation. Used as a dedup
    key so syndicated copies of the same wire story collapse into one event."""
    return re.sub(r"[^a-z0-9]+", " ", title.lower()).strip()
