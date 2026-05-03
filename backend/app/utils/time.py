"""Time helpers."""
from __future__ import annotations

from datetime import UTC, datetime


def utcnow() -> datetime:
    """Timezone-aware UTC now. Always use this; never `datetime.utcnow()`."""
    return datetime.now(tz=UTC)
