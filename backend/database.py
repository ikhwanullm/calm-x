"""Database engine, session, and migration bootstrap."""
from __future__ import annotations

import logging
from contextlib import contextmanager
from pathlib import Path
from typing import Generator

from sqlalchemy import event, text
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Declarative base for all ORM models
# ---------------------------------------------------------------------------
class Base(DeclarativeBase):
    pass


# Module-level engine and session factory (set by init_database)
_engine: Engine | None = None
_SessionFactory: sessionmaker[Session] | None = None


def _configure_sqlite(dbapi_connection, connection_record):  # noqa: ANN001
    """Enable WAL mode and foreign keys for every new SQLite connection."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def get_engine(db_url: str) -> Engine:
    """Create a SQLAlchemy engine with SQLite pragmas on the instance."""
    engine = create_engine(db_url, echo=False)
    # Register on instance, not Engine class — avoids duplicate listeners
    event.listen(engine, "connect", _configure_sqlite)
    return engine


@contextmanager
def get_session() -> Generator[Session, None, None]:
    """Yield a SQLAlchemy Session; rollback on error, close always."""
    if _SessionFactory is None:
        raise RuntimeError("Database not initialised. Call init_database() first.")
    session: Session = _SessionFactory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_database(db_path: Path) -> None:
    """Initialise engine + session factory, create data dir, run migrations."""
    global _engine, _SessionFactory

    db_path.parent.mkdir(parents=True, exist_ok=True)
    db_url = f"sqlite:///{db_path}"

    _engine = get_engine(db_url)
    _SessionFactory = sessionmaker(bind=_engine, expire_on_commit=True)

    _run_migrations(db_url)
    logger.info("Database initialised at %s", db_path)


def _run_migrations(db_url: str) -> None:
    """Run Alembic migrations programmatically (no alembic.ini required)."""
    from pathlib import Path as _Path

    from alembic import command
    from alembic.config import Config as AlembicConfig

    migrations_dir = _Path(__file__).parent / "migrations"

    alembic_cfg = AlembicConfig()
    alembic_cfg.set_main_option("script_location", str(migrations_dir))
    alembic_cfg.set_main_option("sqlalchemy.url", db_url)
    alembic_cfg.set_main_option("prepend_sys_path", ".")
    alembic_cfg.set_main_option("path_separator", "os")

    command.upgrade(alembic_cfg, "head")
