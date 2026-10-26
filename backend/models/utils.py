"""Model utility helpers."""
from __future__ import annotations

from datetime import datetime


def now_utc() -> datetime:
    """Return the current UTC datetime as a naive datetime (no tzinfo).

    The UTCDateTime type decorator stores datetimes as naive UTC in SQLite
    and re-attaches timezone.utc on load, so callers should pass naive values.
    """
    return datetime.utcnow()  # naive UTC
