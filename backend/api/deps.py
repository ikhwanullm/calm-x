"""FastAPI dependency injection utilities."""
from __future__ import annotations

from collections.abc import Generator

from sqlalchemy.orm import Session

from backend.database import get_session


def get_db_session() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a database session."""
    with get_session() as session:
        yield session
