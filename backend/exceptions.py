"""Application-wide exception hierarchy for Calm-X."""
from __future__ import annotations


class CalmXException(Exception):
    """Base class for all Calm-X application exceptions."""

    def __init__(self, message: str, detail: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.detail = detail


class ValidationError(CalmXException):
    """Raised when input data fails business-rule validation (400)."""


class ImportValidationError(CalmXException):
    """Raised when an import file has structural or data issues (400)."""


class LimitExceededError(CalmXException):
    """Raised when a numeric limit (e.g. max items) would be exceeded (400)."""


class ArchivedItemError(CalmXException):
    """Raised when an operation is attempted on an archived item (403)."""


class NotFoundError(CalmXException):
    """Raised when a requested resource does not exist (404)."""


class ConflictError(CalmXException):
    """Raised on uniqueness or state conflicts, e.g. duplicate tag name (409)."""


class ImportFailedError(CalmXException):
    """Raised when an import operation fails after partial processing (500)."""


# HTTP status codes per design.md error contract
EXCEPTION_STATUS_MAP: dict[type[CalmXException], int] = {
    ValidationError: 400,
    ImportValidationError: 400,
    LimitExceededError: 400,
    ArchivedItemError: 403,
    NotFoundError: 404,
    ConflictError: 409,
    ImportFailedError: 500,
}


def get_exception_type_name(exc: CalmXException) -> str:
    """Return the snake_case type name for use in error response bodies."""
    import re
    name = type(exc).__name__
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()
