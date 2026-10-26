"""FastAPI dependency injection utilities."""
from __future__ import annotations

from collections.abc import Generator

from sqlalchemy.orm import Session

from backend.database import make_session


def get_db_session() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a bare Session.

    Commit is NOT performed here — each mutating endpoint must call
    session.commit() before returning so the response reflects persisted data.
    Failure to commit raises an exception which the error handler returns as 5xx.
    """
    session: Session = make_session()
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
