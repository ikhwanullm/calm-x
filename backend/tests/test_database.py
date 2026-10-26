"""Tests for database.py."""
import tempfile
from pathlib import Path

import pytest
from sqlalchemy import text

from backend.database import Base, get_session, init_database


@pytest.fixture()
def tmp_db(tmp_path: Path):
    """Initialise a fresh in-memory-style SQLite DB in a temp dir."""
    db_path = tmp_path / "test.db"
    # We need at least an empty migrations/versions dir for Alembic to work
    # Since migration 001 doesn't exist yet, we'll test engine setup only.
    from backend.database import get_engine, _configure_sqlite
    from sqlalchemy import event, Engine
    from sqlalchemy.orm import sessionmaker

    engine = get_engine(f"sqlite:///{db_path}")
    # Create tables directly (migration 001 not yet present)
    Base.metadata.create_all(engine)

    factory = sessionmaker(bind=engine)
    return engine, factory


def test_wal_mode_enabled(tmp_db):
    engine, _ = tmp_db
    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA journal_mode")).scalar()
    assert result == "wal"


def test_foreign_keys_enabled(tmp_db):
    engine, _ = tmp_db
    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA foreign_keys")).scalar()
    assert result == 1


def test_get_session_commits(tmp_db):
    """Session context manager commits without error."""
    import backend.database as db_module
    engine, factory = tmp_db
    db_module._SessionFactory = factory

    with get_session() as session:
        session.execute(text("SELECT 1"))
    # No exception means commit succeeded


def test_get_session_rolls_back_on_error(tmp_db):
    """Session context manager rolls back on exception."""
    import backend.database as db_module
    _, factory = tmp_db
    db_module._SessionFactory = factory

    with pytest.raises(ValueError):
        with get_session() as session:
            session.execute(text("SELECT 1"))
            raise ValueError("forced error")


def test_get_session_raises_if_not_init():
    import backend.database as db_module
    old = db_module._SessionFactory
    db_module._SessionFactory = None
    try:
        with pytest.raises(RuntimeError, match="not initialised"):
            with get_session() as _:
                pass
    finally:
        db_module._SessionFactory = old


def test_listener_on_instance_not_class(tmp_path):
    """PRAGMA listener registered on engine instance, not Engine class."""
    from sqlalchemy import create_engine as _create_engine, text as _text
    from backend.database import get_engine

    db1 = tmp_path / "e1.db"
    db2 = tmp_path / "e2.db"
    # get_engine registers listener on instance
    get_engine(f"sqlite:///{db1}")
    # A bare engine (no listener) must NOT get WAL / FK from a class-level handler
    bare = _create_engine(f"sqlite:///{db2}")
    with bare.connect() as conn:
        fk = conn.execute(_text("PRAGMA foreign_keys")).scalar()
    # bare engine has no listener → foreign_keys should be 0 (SQLite default)
    assert fk == 0, "Listener leaked to bare engine — still registered on class"
