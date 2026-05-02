"""Time helpers."""
from __future__ import annotations

from datetime import datetime, timezone


def utcnow() -> datetime:
    """Timezone-aware UTC now. Always use this; never `datetime.utcnow()`."""
    return datetime.now(tz=timezone.utc)
