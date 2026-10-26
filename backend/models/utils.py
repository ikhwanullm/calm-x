"""Shared model utilities."""
from __future__ import annotations

from datetime import datetime, timezone


def now_utc() -> datetime:
    """Return current UTC time as naive datetime (for UTCDateTime storage)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
