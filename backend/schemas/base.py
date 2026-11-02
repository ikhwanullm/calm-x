"""Shared base for every API schema."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, SerializerFunctionWrapHandler, field_serializer


class ApiModel(BaseModel):
    """Base of all request and response schemas.

    Values just written are naive UTC in memory (`models.utils.now_utc()` returns naive UTC) and only become
    aware when loaded again. A datetime that goes out without a timezone is read by the browser as local time,
    so any naive datetime is made UTC-aware here, once, for every schema and field.
    """

    @field_serializer("*", mode="wrap")
    def _datetimes_are_utc(self, value: Any, handler: SerializerFunctionWrapHandler) -> Any:
        if isinstance(value, datetime) and value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return handler(value)
