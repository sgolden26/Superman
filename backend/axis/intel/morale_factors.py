"""Troop-morale factor dataset.

This module owns Axis's *secondary* intel surface: a 15-row table per region
that breaks "morale" down into the canonical drivers a planner cares about
(casualties, supply, pay, desertion, recruitment, social-media chatter,
local protest, leadership trust, battlefield momentum, unit cohesion,
state propaganda, media censorship, economic stress, ethnic/regional
composition of units, veteran/family complaints).

Compared to `intel.json`, this dataset:

- Is *wide*, not deep: one row per data type per region, not a time series.
- Multi-label: a single article can populate several rows (a strike at a
  defence plant feeds both `local_protest_unrest` and `supply_logistics`),
  unlike the morale aggregator which assigns one category per Event.
- Is intentionally honest about what public news *cannot* tell us. Three
  rows are flagged as not-derivable-from-news and emit `score: null` plus
  a `note` explaining what data source would unblock them.

Pipeline

    For each region:
        For each KEYWORD_BATCH (3 batches covering all 12 scorable factors):
            GDELT DOC 2.0 with query: (region_geo) AND (batch_kw)
            -> articles for that region, narrowed to the batch's keywords
        merge & dedupe articles across batches
        -> multi-label classify each title across ALL 12 patterns
        -> per (region, factor): score / 3-sentence summary / top sources
    -> data/morale_factors.json

Why batched rather than one-shot or per-factor:

- One-shot ORing all ~70 keywords blows past GDELT's silent query-length
  limit (~250-300 chars / OR-clause cap), and the API returns 0 articles
  with no error.
- Per-factor (48 calls) trips GDELT's free-tier rate limiter and stacks
  timeouts that turn a 60s pull into 25 minutes.
- Batched (12 calls of ~250 char queries each) sits in the sweet spot:
  short enough that GDELT actually answers, few enough calls that we
  stay well under any rate limit.

The pull is one-shot. A future "live mode" path can re-run this on a
5-minute cooldown when the user clicks a region; that wiring lives in the
CLI and the FE, not here.
"""

from __future__ import annotations

import json
import logging
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Iterable

from axis.intel.sources.gdelt_live import (
    DEFAULT_REGION_QUERIES,
    GDELT_DOC_API,
    USER_AGENT,
)

log = logging.getLogger(__name__)

MORALE_FACTORS_SCHEMA_VERSION = "0.1.0"

# Score scale. 50 is "no signal either way"; one negative match removes
# ~`PER_HIT_MAGNITUDE` points (clamped 0..100), one positive match adds the
# same. Tuned so a region with ~5 morale-relevant articles in a row lands
# in the 20s/30s (or 70s/80s) instead of staying near baseline.
PER_HIT_MAGNITUDE = 6.0
INTENSIFIER_BONUS = 3.0
MAX_SOURCES_PER_CELL = 5

# GDELT politeness: free DOC API rate-limits on burst, and connections
# can be slow under load. Defaults aim at the 90th-percentile case.
DEFAULT_INTER_CALL_DELAY_S = 2.0
DEFAULT_RECORDS_PER_BATCH = 75
DEFAULT_TIMEOUT_S = 90.0

# Region display labels. Kept in this module so the dataset is fully
# self-contained; if regions move around in state.json they can also be
# overridden via build_dataset(region_labels=...).
DEFAULT_REGION_LABELS: dict[str, str] = {
    "terr.lithuania": "Lithuania",
    "terr.poland_ne": "Northeast Poland",
    "terr.kaliningrad": "Kaliningrad",
    "terr.belarus_w": "Western Belarus",
}


# ---------------------------------------------------------------------------
# Factor taxonomy
# ---------------------------------------------------------------------------


class MoraleFactor(str, Enum):
    """The 15 rows of the troop-morale table."""

    CASUALTY_REPORTS = "casualty_reports"
    SUPPLY_LOGISTICS = "supply_logistics"
    PAY_BENEFITS = "pay_benefits"
    DESERTION_SURRENDER = "desertion_surrender"
    RECRUITMENT_MOBILIZATION = "recruitment_mobilization"
    SOCIAL_MEDIA_SOLDIERS = "social_media_soldiers"
    LOCAL_PROTEST_UNREST = "local_protest_unrest"
    LEADERSHIP_TRUST = "leadership_trust"
    BATTLEFIELD_MOMENTUM = "battlefield_momentum"
    UNIT_COHESION = "unit_cohesion"
    PROPAGANDA_MESSAGING = "propaganda_messaging"
    MEDIA_CENSORSHIP = "media_censorship"
    ECONOMIC_STRESS = "economic_stress"
    ETHNIC_REGIONAL_COMPOSITION = "ethnic_regional_composition"
    VETERAN_FAMILY_COMPLAINTS = "veteran_family_complaints"


@dataclass(frozen=True, slots=True)
class FactorSpec:
    """Static metadata + classifier for a morale factor.

    `pattern is None` means the factor cannot be scored from public news
    headlines alone; build_dataset emits it with score=null and a `note`.
    `gdelt_keywords` is a tuple of OR-keywords contributed to the
    region/batch-level GDELT AND-clause; an empty tuple means this factor
    doesn't pull articles from news. `sign` is +1 if a hit raises morale
    and -1 if a hit lowers it.
    """

    factor: MoraleFactor
    label: str
    description: str
    sign: int
    pattern: re.Pattern[str] | None
    gdelt_keywords: tuple[str, ...] = ()
    note: str | None = None


_FACTOR_SPECS: tuple[FactorSpec, ...] = (
    FactorSpec(
        MoraleFactor.CASUALTY_REPORTS,
        "Casualty reports",
        "High losses usually reduce morale, especially if repeated or unexplained.",
        sign=-1,
        pattern=re.compile(
            r"\b("
            r"killed|dead|deaths|fatalit\w+|casualt\w+|wounded|injured|"
            r"losses|body bag|body count|combat death|killed in action|kia"
            r")\b",
            re.IGNORECASE,
        ),
        gdelt_keywords=("killed", "casualties", "wounded", "fatalities"),
    ),
    FactorSpec(
        MoraleFactor.SUPPLY_LOGISTICS,
        "Supply / logistics indicators",
        "Food, fuel, ammo, medical shortages are huge morale killers.",
        sign=-1,
        pattern=re.compile(
            r"\b("
            r"shortage\w*|ration\w*|ammo|ammunition|fuel|diesel|"
            r"medical supply|medical supplies|logistic\w*|stockpile\w*|"
            r"depot|convoy|resupply|out of stock|spare parts"
            r")\b",
            re.IGNORECASE,
        ),
        gdelt_keywords=("shortage", "ammunition", "logistics", "stockpile"),
    ),
    FactorSpec(
        MoraleFactor.PAY_BENEFITS,
        "Pay / benefits issues",
        "Unpaid soldiers, delayed compensation, family support problems.",
        sign=-1,
        pattern=re.compile(
            r"\b("
            r"unpaid|back pay|wage\w*|salar\w+|stipend|pension\w*|"
            r"compensat\w+|benefit\w*|allowance\w*|delayed pay|withheld"
            r")\b",
            re.IGNORECASE,
        ),
        gdelt_keywords=("unpaid", "wages", "pensions", "stipend"),
    ),
    FactorSpec(
        MoraleFactor.DESERTION_SURRENDER,
        "Desertion / surrender / refusal reports",
        "Direct behavioral evidence of low morale.",
        sign=-1,
        pattern=re.compile(
            r"\b("
            r"desert\w+|surrender\w*|defect\w+|awol|refus\w+ to fight|"
            r"refus\w+ orders|mutin\w+|abandon\w+ post"
            r")\b",
            re.IGNORECASE,
        ),
        gdelt_keywords=("desertion", "surrendered", "defector", "mutiny"),
    ),
    FactorSpec(
        MoraleFactor.RECRUITMENT_MOBILIZATION,
        "Recruitment + mobilization rates",
        "Whether people are willing to join or are avoiding service.",
        sign=+1,
        pattern=re.compile(
            r"\b("
            r"recruit\w*|enlist\w*|conscript\w+|mobiliz\w+|"
            r"reservist\w*|volunteer\w*|sign[- ]up|call[- ]up|levy|"
            r"\bdraft (?:law|order|notice|board|dodger|evader|evasion|age|exercise|"
            r"announc\w+|extended|extension)|conscription"
            r")\b",
            re.IGNORECASE,
        ),
        gdelt_keywords=("conscription", "mobilization", "reservist", "enlistment"),
    ),
    FactorSpec(
        MoraleFactor.SOCIAL_MEDIA_SOLDIERS,
        "Social media from soldiers / families",
        "Complaints, fear, pride, grief, rumors, anger from the ranks.",
        sign=-1,
        pattern=None,
        gdelt_keywords=(),
        note=(
            "Not derivable from public news headlines alone. Requires direct "
            "ingestion of platform feeds (Telegram, VK, TikTok, Instagram) "
            "with a per-platform scraper and an opinion classifier."
        ),
    ),
    FactorSpec(
        MoraleFactor.LOCAL_PROTEST_UNREST,
        "Local protest / unrest near home regions",
        "Soldiers may be less willing to fight if their home region is unstable.",
        sign=-1,
        pattern=re.compile(
            r"\b("
            r"protest\w*|demonstrat\w+|rall(?:y|ies)|march(?:es|ed|ing)?|"
            r"riot\w*|unrest|clashes|sit[- ]?in|walkout|blockade|picket"
            r")\b",
            re.IGNORECASE,
        ),
        gdelt_keywords=("protest", "demonstration", "riot", "unrest"),
    ),
    FactorSpec(
        MoraleFactor.LEADERSHIP_TRUST,
        "Leadership trust signals",
        "Corruption, poor commanders, contradictory orders, perceived abandonment.",
        sign=-1,
        pattern=re.compile(
            r"\b("
            r"corrupt\w+|scandal\w*|reshuffle|sacked|fired commander|"
            r"resign\w+|dismiss\w+|incompet\w+|bribe\w*|embezzl\w+|"
            r"no[- ]confidence|abandoned by"
            r")\b",
            re.IGNORECASE,
        ),
        gdelt_keywords=("corruption", "scandal", "sacked", "resignation"),
    ),
    FactorSpec(
        MoraleFactor.BATTLEFIELD_MOMENTUM,
        "Battlefield momentum",
        "Repeated defeats lower morale; visible wins raise it.",
        # Default sign is -1 because retreat/setback wording dominates
        # contested reporting; positive momentum keywords (advance,
        # captured, liberated) flip the per-article sign positive via the
        # _POSITIVE_MOMENTUM table.
        sign=-1,
        pattern=re.compile(
            r"\b("
            r"retreat\w*|withdraw\w+|pulled back|fall back|fell back|"
            r"setback|defeat\w*|repel\w+|repuls\w+|"
            r"advanc\w+|captur\w+|seiz\w+|liberat\w+|recaptur\w+|"
            r"breakthrough|gain\w* ground|push\w+ back|offensive"
            r")\b",
            re.IGNORECASE,
        ),
        gdelt_keywords=("retreat", "advance", "captured", "offensive"),
    ),
    FactorSpec(
        MoraleFactor.UNIT_COHESION,
        "Unit cohesion indicators",
        "Shared identity, elite status, long-standing units, ideological motivation.",
        sign=+1,
        pattern=None,
        gdelt_keywords=(),
        note=(
            "Not derivable from public news headlines alone. Requires unit "
            "rosters, deployment histories, and per-unit interviews / "
            "anthropology."
        ),
    ),
    FactorSpec(
        MoraleFactor.PROPAGANDA_MESSAGING,
        "Propaganda + official messaging",
        "What the state is trying to convince troops/citizens of.",
        sign=+1,
        pattern=re.compile(
            r"\b("
            r"propaganda|state media|state[- ]run|kremlin|tass|sputnik|"
            r"rt\.com|official statement|spokes(?:man|woman|person)|"
            r"defen[cs]e ministry|press conference"
            r")\b",
            re.IGNORECASE,
        ),
        gdelt_keywords=("propaganda", "Kremlin", "TASS", "Sputnik"),
    ),
    FactorSpec(
        MoraleFactor.MEDIA_CENSORSHIP,
        "Media censorship intensity",
        "Heavy censorship may indicate morale or legitimacy anxiety.",
        sign=-1,
        pattern=re.compile(
            r"\b("
            r"censor\w*|blocked|banned|shutdown|shut down|press freedom|"
            r"detained journalist|jailed journalist|raided newsroom|"
            r"disinformat\w+|misinformat\w+|gag order"
            r")\b",
            re.IGNORECASE,
        ),
        gdelt_keywords=("censorship", "disinformation", "banned", "blocked"),
    ),
    FactorSpec(
        MoraleFactor.ECONOMIC_STRESS,
        "Economic stress at home",
        "Family hardship can reduce willingness to continue fighting.",
        sign=-1,
        pattern=re.compile(
            r"\b("
            r"inflation|sanction\w*|recession|crisis|crash|"
            r"price\s+(?:rise|hike|surge|jump)|"
            r"currency|ruble|rouble|zloty|euro|"
            r"unemploy\w+|layoff\w*|shortage|fuel|energy|cost of living|"
            r"poverty|austerity"
            r")\b",
            re.IGNORECASE,
        ),
        gdelt_keywords=("inflation", "sanctions", "recession", "unemployment"),
    ),
    FactorSpec(
        MoraleFactor.ETHNIC_REGIONAL_COMPOSITION,
        "Ethnic / regional composition of units",
        "Morale may differ if certain groups are disproportionately deployed.",
        sign=-1,
        pattern=None,
        gdelt_keywords=(),
        note=(
            "Not derivable from public news headlines alone. Requires "
            "per-unit demographic data (often classified) cross-referenced "
            "against deployment orders."
        ),
    ),
    FactorSpec(
        MoraleFactor.VETERAN_FAMILY_COMPLAINTS,
        "Veteran / family complaints",
        "Often an early-warning signal for deeper military dissatisfaction.",
        sign=-1,
        pattern=re.compile(
            r"\b("
            r"veteran\w*|widow\w*|mothers? of soldiers|"
            r"famil(?:y|ies) of (?:soldiers?|conscripts?|servicem[ae]n)|"
            r"relatives demand|relatives protest|soldiers'? families|"
            r"families demand|families protest"
            r")\b",
            re.IGNORECASE,
        ),
        gdelt_keywords=("veterans", "widow", "bereaved"),
    ),
)


# Words inside a battlefield-momentum article that flip the sign positive.
_POSITIVE_MOMENTUM = re.compile(
    r"\b(advanc\w+|captur\w+|seiz\w+|liberat\w+|recaptur\w+|"
    r"breakthrough|gain\w* ground|push\w+ back|offensive)\b",
    re.IGNORECASE,
)

# Generic "this is a big deal" intensifier; bumps magnitude per match.
_INTENSIFIER = re.compile(
    r"\b(killed|dead|deaths|massive|destroyed|major|crisis|unprecedented|"
    r"emergency|coup|invasion|war|critical|severe|widespread)\b",
    re.IGNORECASE,
)


_FACTOR_SPEC_BY_KEY: dict[MoraleFactor, FactorSpec] = {
    s.factor: s for s in _FACTOR_SPECS
}


def factor_specs() -> tuple[FactorSpec, ...]:
    """Public, ordered view of the 15 factor specs."""
    return _FACTOR_SPECS


# Number of scorable factors per GDELT batch. Picked to keep each batch's
# OR-clause query well under GDELT's silent ~250-char query limit.
_FACTORS_PER_BATCH = 4


def _build_keyword_batches() -> list[str]:
    """Return one OR-clause per batch of scorable factors.

    Splitting the keyword union into batches keeps each GDELT query short
    enough for the DOC API to actually answer (it silently returns 0
    articles when the query is too long), while still giving us per-batch
    keyword diversity.
    """
    scorable_specs = [s for s in _FACTOR_SPECS if s.gdelt_keywords]
    batches: list[str] = []
    for i in range(0, len(scorable_specs), _FACTORS_PER_BATCH):
        chunk = scorable_specs[i : i + _FACTORS_PER_BATCH]
        seen: list[str] = []
        seen_set: set[str] = set()
        for spec in chunk:
            for kw in spec.gdelt_keywords:
                k = kw.strip()
                if k and k not in seen_set:
                    seen.append(k)
                    seen_set.add(k)
        batches.append("(" + " OR ".join(seen) + ")")
    return batches


# ---------------------------------------------------------------------------
# Output dataclasses
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class FactorSource:
    """One article cited as evidence for a factor cell."""

    title: str
    url: str | None
    domain: str
    ts: datetime | None

    def to_dict(self) -> dict[str, object]:
        d: dict[str, object] = {
            "title": self.title,
            "domain": self.domain,
        }
        if self.url:
            d["url"] = self.url
        if self.ts is not None:
            d["ts"] = self.ts.isoformat()
        return d


@dataclass(frozen=True, slots=True)
class FactorCell:
    """One row of the table for one region."""

    factor: MoraleFactor
    label: str
    description: str
    score: float | None
    summary: str
    sources: tuple[FactorSource, ...]
    note: str | None = None
    article_count: int = 0

    def to_dict(self) -> dict[str, object]:
        return {
            "factor": self.factor.value,
            "label": self.label,
            "description": self.description,
            "score": None if self.score is None else round(self.score, 1),
            "summary": self.summary,
            "sources": [s.to_dict() for s in self.sources],
            "note": self.note,
            "article_count": self.article_count,
        }


@dataclass(frozen=True, slots=True)
class RegionMoraleFactors:
    region_id: str
    label: str
    article_count: int
    factors: tuple[FactorCell, ...]

    def to_dict(self) -> dict[str, object]:
        return {
            "region_id": self.region_id,
            "label": self.label,
            "article_count": self.article_count,
            "factors": [f.to_dict() for f in self.factors],
        }


@dataclass(frozen=True, slots=True)
class MoraleFactorsDataset:
    schema_version: str
    generated_at: datetime
    source: str
    lookback_hours: int
    regions: tuple[RegionMoraleFactors, ...]

    def to_dict(self) -> dict[str, object]:
        return {
            "morale_factors_schema_version": self.schema_version,
            "generated_at": self.generated_at.isoformat(),
            "source": self.source,
            "lookback_hours": self.lookback_hours,
            "regions": [r.to_dict() for r in self.regions],
        }


# ---------------------------------------------------------------------------
# GDELT fetch (per region, per keyword batch)
# ---------------------------------------------------------------------------


def _fetch(
    *,
    geo_query: str,
    morale_query: str,
    lookback_hours: int,
    max_records: int,
    timeout_s: float,
) -> list[dict]:
    """Hit GDELT DOC 2.0 once with `(geo) AND (batch_kw)` and return articles.

    Failures are warned and an empty list is returned: the morale-factors
    dataset is best-effort across many cells, and a single failed batch
    should not abort the whole pull.
    """
    combined = f"({geo_query}) AND {morale_query} sourcelang:eng"
    params = {
        "query": combined,
        "mode": "ArtList",
        "format": "json",
        "timespan": f"{lookback_hours}h",
        "maxrecords": str(max_records),
        "sort": "HybridRel",
    }
    url = f"{GDELT_DOC_API}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            body = resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        log.warning("morale_factors: GDELT HTTP %s for %s", exc.code, combined[:140])
        return []
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        log.warning("morale_factors: GDELT fetch failed (%s) for %s", exc, combined[:140])
        return []

    if not body.strip():
        return []
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        log.debug("morale_factors: non-JSON body for %s", combined[:140])
        return []

    articles = payload.get("articles") if isinstance(payload, dict) else None
    return articles if isinstance(articles, list) else []


# ---------------------------------------------------------------------------
# Multi-label classification + scoring
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class _CellAccum:
    contribution: float = 0.0
    pos_hits: int = 0
    neg_hits: int = 0
    sources: list[FactorSource] = field(default_factory=list)
    sample_titles: list[str] = field(default_factory=list)


def _classify_title(title: str) -> list[MoraleFactor]:
    """Every scorable factor whose pattern matches `title` (multi-label)."""
    matched: list[MoraleFactor] = []
    for spec in _FACTOR_SPECS:
        if spec.pattern is None:
            continue
        if spec.pattern.search(title):
            matched.append(spec.factor)
    return matched


def _score_contribution(spec: FactorSpec, title: str) -> tuple[float, int]:
    """Return (signed contribution in score units, sign) for one match."""
    sign = spec.sign
    if spec.factor == MoraleFactor.BATTLEFIELD_MOMENTUM and _POSITIVE_MOMENTUM.search(title):
        sign = +1
    mag = PER_HIT_MAGNITUDE
    if _INTENSIFIER.search(title):
        mag += INTENSIFIER_BONUS
    return sign * mag, sign


def _build_summary(label: str, region_label: str, accum: _CellAccum, score: float) -> str:
    n = accum.pos_hits + accum.neg_hits
    if n == 0:
        return (
            f"No public news matched '{label}' for {region_label} in the "
            f"current lookback window. The score sits at the neutral baseline. "
            f"Treat as 'no signal' rather than 'all clear'."
        )

    s1 = (
        f"Found {n} article{'s' if n != 1 else ''} matching '{label}' "
        f"in coverage of {region_label}."
    )
    if accum.sample_titles:
        top = accum.sample_titles[0]
        s2 = f"Top headline: \u201c{top}\u201d."
    else:
        s2 = "No representative headline could be extracted."
    if score >= 60:
        verdict = (
            f"Net read: signal is morale-positive ({score:.0f}/100) for the "
            f"controlling faction."
        )
    elif score <= 40:
        verdict = (
            f"Net read: signal is morale-negative ({score:.0f}/100) for the "
            f"controlling faction."
        )
    else:
        verdict = (
            f"Net read: mixed / near-neutral ({score:.0f}/100); the row is "
            f"populated but no clear direction yet."
        )
    return f"{s1} {s2} {verdict}"


def _summary_unscorable(label: str, region_label: str, note: str) -> str:
    return (
        f"'{label}' is not derivable from public news headlines for "
        f"{region_label}. {note} The cell is intentionally null rather "
        f"than zero-scored to avoid implying a measurement we did not make."
    )


# ---------------------------------------------------------------------------
# Builder
# ---------------------------------------------------------------------------


def build_dataset(
    *,
    region_ids: Iterable[str] | None = None,
    region_labels: dict[str, str] | None = None,
    lookback_hours: int = 72,
    records_per_batch: int = DEFAULT_RECORDS_PER_BATCH,
    timeout_s: float = DEFAULT_TIMEOUT_S,
    inter_call_delay_s: float = DEFAULT_INTER_CALL_DELAY_S,
    now: datetime | None = None,
) -> MoraleFactorsDataset:
    """Pull live GDELT in chunked batches per region, produce the morale table.

    Always live: this entry point ignores `live_news_enabled` because the
    one-shot pull is the whole point. Callers that want to honour the
    toggle should gate the *call* to build_dataset, not the function
    itself.

    Issues `len(regions) * len(batches)` GDELT calls (default 4 * 3 = 12).
    Each call's query is `(region_geo) AND (batch_keywords)`; returned
    articles are merged across batches per region and multi-label
    classified into the 12 scorable factor rows. Three rows
    (`social_media_soldiers`, `unit_cohesion`,
    `ethnic_regional_composition`) are emitted with score=null and a
    `note` because they are not derivable from public news.
    """
    now = now or datetime.now(tz=timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    configured = {rq.region_id: rq for rq in DEFAULT_REGION_QUERIES}
    if region_ids is None:
        region_ids = tuple(configured.keys())

    labels = {**DEFAULT_REGION_LABELS, **(region_labels or {})}
    keyword_batches = _build_keyword_batches()
    log.info(
        "morale_factors: %d keyword batches, %d regions => %d GDELT calls",
        len(keyword_batches),
        len(list(region_ids)) if not isinstance(region_ids, tuple) else len(region_ids),
        len(keyword_batches) * (len(region_ids) if isinstance(region_ids, tuple) else len(list(region_ids))),
    )

    out_regions: list[RegionMoraleFactors] = []
    call_idx = 0
    for rid in region_ids:
        if rid not in configured:
            log.warning(
                "morale_factors: region %r has no configured GDELT query; skipping.",
                rid,
            )
            continue
        rq = configured[rid]
        region_label = labels.get(rid, rid)

        merged_articles: list[dict] = []
        seen_urls: set[str] = set()
        for batch_idx, batch_query in enumerate(keyword_batches):
            if call_idx > 0 and inter_call_delay_s > 0:
                time.sleep(inter_call_delay_s)
            call_idx += 1
            log.info(
                "morale_factors: region %s batch %d/%d",
                rid,
                batch_idx + 1,
                len(keyword_batches),
            )
            articles = _fetch(
                geo_query=rq.query,
                morale_query=batch_query,
                lookback_hours=lookback_hours,
                max_records=records_per_batch,
                timeout_s=timeout_s,
            )
            for art in articles:
                u = str(art.get("url") or "").strip()
                key = u or _norm_title(str(art.get("title") or ""))
                if key in seen_urls:
                    continue
                seen_urls.add(key)
                merged_articles.append(art)

        log.info(
            "morale_factors: region %s (%s) merged %d unique articles",
            rid,
            region_label,
            len(merged_articles),
        )

        out_regions.append(
            _build_region(
                region_id=rid,
                region_label=region_label,
                articles=merged_articles,
            )
        )

    return MoraleFactorsDataset(
        schema_version=MORALE_FACTORS_SCHEMA_VERSION,
        generated_at=now,
        source="gdelt_live",
        lookback_hours=lookback_hours,
        regions=tuple(out_regions),
    )


def _build_region(
    *,
    region_id: str,
    region_label: str,
    articles: list[dict],
) -> RegionMoraleFactors:
    """Multi-label classify the merged article corpus and emit cells."""
    accum: dict[MoraleFactor, _CellAccum] = {
        spec.factor: _CellAccum() for spec in _FACTOR_SPECS
    }
    seen_norm_titles: set[str] = set()
    valid_articles = 0

    for art in articles:
        title = str(art.get("title") or "").strip()
        if not title:
            continue
        norm = _norm_title(title)
        if norm in seen_norm_titles:
            continue
        seen_norm_titles.add(norm)
        valid_articles += 1

        url_raw = str(art.get("url") or "").strip() or None
        url = url_raw if url_raw and url_raw.startswith(("http://", "https://")) else None
        domain = str(art.get("domain") or "").strip()
        ts = _parse_seendate(art.get("seendate"))

        matched = _classify_title(title)
        if not matched:
            continue
        src_obj = FactorSource(title=title[:200], url=url, domain=domain, ts=ts)

        for factor in matched:
            spec = _FACTOR_SPEC_BY_KEY[factor]
            contribution, sign = _score_contribution(spec, title)
            a = accum[factor]
            a.contribution += contribution
            if sign > 0:
                a.pos_hits += 1
            else:
                a.neg_hits += 1
            if len(a.sources) < MAX_SOURCES_PER_CELL:
                a.sources.append(src_obj)
            if len(a.sample_titles) < 3:
                a.sample_titles.append(title)

    cells: list[FactorCell] = []
    for spec in _FACTOR_SPECS:
        a = accum[spec.factor]
        if spec.pattern is None:
            cells.append(
                FactorCell(
                    factor=spec.factor,
                    label=spec.label,
                    description=spec.description,
                    score=None,
                    summary=_summary_unscorable(
                        spec.label, region_label, spec.note or ""
                    ),
                    sources=tuple(),
                    note=spec.note,
                    article_count=0,
                )
            )
            continue

        score = _clamp(50.0 + a.contribution, 0.0, 100.0)
        cells.append(
            FactorCell(
                factor=spec.factor,
                label=spec.label,
                description=spec.description,
                score=score,
                summary=_build_summary(spec.label, region_label, a, score),
                sources=tuple(a.sources),
                note=None,
                article_count=a.pos_hits + a.neg_hits,
            )
        )

    return RegionMoraleFactors(
        region_id=region_id,
        label=region_label,
        article_count=valid_articles,
        factors=tuple(cells),
    )


def write_dataset(dataset: MoraleFactorsDataset, path: Path | str, *, indent: int = 2) -> Path:
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(dataset.to_dict(), indent=indent) + "\n")
    return out


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _clamp(x: float, lo: float, hi: float) -> float:
    if x < lo:
        return lo
    if x > hi:
        return hi
    return x


def _parse_seendate(value: object) -> datetime | None:
    if not isinstance(value, str) or len(value) < 15:
        return None
    try:
        ts = datetime.strptime(value, "%Y%m%dT%H%M%SZ")
        return ts.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _norm_title(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", title.lower()).strip()


__all__ = [
    "MORALE_FACTORS_SCHEMA_VERSION",
    "MoraleFactor",
    "FactorSpec",
    "FactorSource",
    "FactorCell",
    "RegionMoraleFactors",
    "MoraleFactorsDataset",
    "factor_specs",
    "build_dataset",
    "write_dataset",
]
