"""Custom SQLAlchemy type decorators."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, TypeDecorator


class UTCDateTime(TypeDecorator):
    """Store datetimes as naive UTC in SQLite; return timezone-aware UTC on load.

    - On write: strips tzinfo (converts to UTC first if tz-aware).
    - On read: attaches ``timezone.utc`` to the naive value from SQLite.
    """

    impl = DateTime
    cache_ok = True

    def process_bind_param(
        self, value: datetime | None, dialect: object
    ) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is not None:
            # Convert to UTC, then strip tzinfo for SQLite storage
            value = value.astimezone(timezone.utc).replace(tzinfo=None)
        return value

    def process_result_value(
        self, value: datetime | None, dialect: object
    ) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            # Attach UTC tzinfo to the naive datetime read from SQLite
            return value.replace(tzinfo=timezone.utc)
        return value
