"""Event domain: the atomic signal the morale pipeline consumes."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum


class EventCategory(str, Enum):
    """Event taxonomy used by the classifier and the action evaluator.

    Names are intentionally stable - they appear in `intel.json`,
    `state.actions[].category_sensitivities`, and the FE evaluator.
    """

    PROTEST = "protest"
    MILITARY_LOSS = "military_loss"
    ECONOMIC_STRESS = "economic_stress"
    POLITICAL_INSTABILITY = "political_instability"
    NATIONALIST_SENTIMENT = "nationalist_sentiment"


# Sign convention from the perspective of the controlling faction. Events
# can override (a successful recruitment drive can be MILITARY_LOSS=+0.3).
DEFAULT_CATEGORY_SIGN: dict[EventCategory, int] = {
    EventCategory.PROTEST: -1,
    EventCategory.MILITARY_LOSS: -1,
    EventCategory.ECONOMIC_STRESS: -1,
    EventCategory.POLITICAL_INSTABILITY: -1,
    EventCategory.NATIONALIST_SENTIMENT: +1,
}


@dataclass(frozen=True, slots=True)
class Event:
    """One classified signal tied to a region.

    `weight` is signed and bounded to [-1, 1]. It already encodes severity *and*
    direction (a `protest` with weight `-0.6` is a fairly bad protest for the
    controlling faction). The aggregator treats the sign verbatim.
    """

    id: str
    region_id: str
    ts: datetime
    category: EventCategory
    headline: str
    snippet: str
    weight: float
    source: str  # curated | gdelt | manual
    # Optional canonical link back to the article/wire copy this event was
    # derived from. Populated by the live GDELT source (per-article URL) and
    # may be set on curated/snapshot events when the author wants the FE to
    # surface a "view source" affordance.
    url: str | None = None

    def __post_init__(self) -> None:
        if not self.id:
            raise ValueError("Event.id must be non-empty")
        if not self.region_id:
            raise ValueError("Event.region_id must be non-empty")
        if not -1.0 <= self.weight <= 1.0:
            raise ValueError(f"Event.weight must be in [-1, 1], got {self.weight}")
        if self.ts.tzinfo is None:
            raise ValueError("Event.ts must be timezone-aware")
        if self.url is not None:
            u = self.url.strip()
            if not u:
                # Treat empty/whitespace as "no url" so callers don't have to
                # special-case it before constructing the Event.
                object.__setattr__(self, "url", None)
            elif not (u.startswith("http://") or u.startswith("https://")):
                raise ValueError(
                    f"Event.url must be http(s):// if set, got {self.url!r}"
                )

    def to_dict(self) -> dict[str, object]:
        d: dict[str, object] = {
            "id": self.id,
            "region_id": self.region_id,
            "ts": self.ts.isoformat(),
            "category": self.category.value,
            "headline": self.headline,
            "snippet": self.snippet,
            "weight": self.weight,
            "source": self.source,
        }
        if self.url:
            d["url"] = self.url
        return d
