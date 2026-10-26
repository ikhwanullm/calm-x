"""Application-wide exception hierarchy for Calm-X."""
from __future__ import annotations


class CalmXException(Exception):
    """Base class for all Calm-X application exceptions."""

    def __init__(self, message: str, detail: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.detail = detail


class ValidationError(CalmXException):
    """Raised when input data fails business-rule validation."""


class ImportValidationError(CalmXException):
    """Raised when an import file has structural or data issues."""


class LimitExceededError(CalmXException):
    """Raised when a numeric limit (e.g. max items) would be exceeded."""


class ArchivedItemError(CalmXException):
    """Raised when an operation is attempted on an archived item."""


class NotFoundError(CalmXException):
    """Raised when a requested resource does not exist."""


class ConflictError(CalmXException):
    """Raised on uniqueness or state conflicts (e.g. duplicate tag name)."""


class ImportFailedError(CalmXException):
    """Raised when an import operation fails after partial processing."""


# HTTP status codes for each exception type
EXCEPTION_STATUS_MAP: dict[type[CalmXException], int] = {
    ValidationError: 422,
    ImportValidationError: 422,
    LimitExceededError: 409,
    ArchivedItemError: 409,
    NotFoundError: 404,
    ConflictError: 409,
    ImportFailedError: 422,
}


def get_exception_type_name(exc: CalmXException) -> str:
    """Return the snake_case type name for use in error response bodies."""
    name = type(exc).__name__
    # Convert CamelCase to snake_case
    import re
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()
