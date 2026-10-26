"""Tests for UTCDateTime TypeDecorator."""
from datetime import datetime, timedelta, timezone

import pytest

from backend.models.types import UTCDateTime


@pytest.fixture()
def utc_type():
    return UTCDateTime()


def test_bind_none(utc_type):
    assert utc_type.process_bind_param(None, None) is None


def test_result_none(utc_type):
    assert utc_type.process_result_value(None, None) is None


def test_bind_naive_passthrough(utc_type):
    """Naive datetimes are stored as-is (assumed UTC)."""
    dt = datetime(2024, 6, 1, 12, 0, 0)
    result = utc_type.process_bind_param(dt, None)
    assert result == dt
    assert result.tzinfo is None


def test_bind_aware_converted_to_utc(utc_type):
    """Timezone-aware datetimes are converted to UTC and stripped."""
    tz_plus5 = timezone(timedelta(hours=5))
    dt_aware = datetime(2024, 6, 1, 17, 0, 0, tzinfo=tz_plus5)  # 12:00 UTC
    result = utc_type.process_bind_param(dt_aware, None)
    assert result.tzinfo is None
    assert result == datetime(2024, 6, 1, 12, 0, 0)


def test_result_naive_gets_utc(utc_type):
    """Naive datetime read from DB gets UTC tzinfo attached."""
    dt = datetime(2024, 6, 1, 12, 0, 0)
    result = utc_type.process_result_value(dt, None)
    assert result.tzinfo == timezone.utc
    assert result == datetime(2024, 6, 1, 12, 0, 0, tzinfo=timezone.utc)


def test_result_aware_passthrough(utc_type):
    """Already-aware datetimes pass through unchanged."""
    dt = datetime(2024, 6, 1, 12, 0, 0, tzinfo=timezone.utc)
    result = utc_type.process_result_value(dt, None)
    assert result == dt


def test_roundtrip(utc_type):
    """Bind then result gives back the same UTC moment."""
    tz_plus3 = timezone(timedelta(hours=3))
    original = datetime(2024, 6, 1, 15, 30, 0, tzinfo=tz_plus3)  # 12:30 UTC
    stored = utc_type.process_bind_param(original, None)
    loaded = utc_type.process_result_value(stored, None)
    assert loaded == datetime(2024, 6, 1, 12, 30, 0, tzinfo=timezone.utc)
