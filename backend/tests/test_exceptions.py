"""Tests for exceptions.py."""
import pytest

from backend.exceptions import (
    EXCEPTION_STATUS_MAP,
    ArchivedItemError,
    CalmXException,
    ConflictError,
    ImportFailedError,
    ImportValidationError,
    LimitExceededError,
    NotFoundError,
    ValidationError,
    get_exception_type_name,
)


def test_base_exception_message():
    exc = CalmXException("something went wrong")
    assert str(exc) == "something went wrong"
    assert exc.message == "something went wrong"
    assert exc.detail is None


def test_base_exception_with_detail():
    exc = CalmXException("error", detail="more info")
    assert exc.detail == "more info"


def test_all_subclasses_inherit_calmx():
    for cls in [
        ValidationError,
        ImportValidationError,
        LimitExceededError,
        ArchivedItemError,
        NotFoundError,
        ConflictError,
        ImportFailedError,
    ]:
        exc = cls("test")
        assert isinstance(exc, CalmXException)


def test_status_map_covers_all_subclasses():
    subclasses = {
        ValidationError,
        ImportValidationError,
        LimitExceededError,
        ArchivedItemError,
        NotFoundError,
        ConflictError,
        ImportFailedError,
    }
    assert subclasses == set(EXCEPTION_STATUS_MAP.keys())


def test_status_codes():
    assert EXCEPTION_STATUS_MAP[NotFoundError] == 404
    assert EXCEPTION_STATUS_MAP[ValidationError] == 422
    assert EXCEPTION_STATUS_MAP[ConflictError] == 409
    assert EXCEPTION_STATUS_MAP[ArchivedItemError] == 409
    assert EXCEPTION_STATUS_MAP[LimitExceededError] == 409


def test_get_exception_type_name():
    assert get_exception_type_name(NotFoundError("x")) == "not_found_error"
    assert get_exception_type_name(ValidationError("x")) == "validation_error"
    assert get_exception_type_name(ConflictError("x")) == "conflict_error"
    assert get_exception_type_name(ArchivedItemError("x")) == "archived_item_error"
    assert get_exception_type_name(LimitExceededError("x")) == "limit_exceeded_error"
    assert get_exception_type_name(ImportValidationError("x")) == "import_validation_error"
    assert get_exception_type_name(ImportFailedError("x")) == "import_failed_error"
