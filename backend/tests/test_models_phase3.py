"""Phase 3 ORM model verification tests."""
import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session

from backend.database import Base
from backend.models.item import Task, Subtask, Tag, TaskTag
from backend.models.preference import UserPreference
from backend.models.utils import now_utc


@pytest.fixture(scope="module")
def db_engine(tmp_path_factory):
    db = tmp_path_factory.mktemp("p3models") / "p3.db"
    engine = create_engine(f"sqlite:///{db}")
    # Import all models so metadata is complete
    import backend.models  # noqa: F401
    Base.metadata.create_all(engine)
    with engine.connect() as conn:
        conn.execute(text("PRAGMA foreign_keys=ON"))
        # Insert default preference so test can read it
        conn.execute(
            text("INSERT OR IGNORE INTO user_preferences (key, value, updated_at) VALUES ('approaching_deadline_threshold', '3', '2024-01-01')")
        )
        conn.commit()
    return engine


def test_task_model_structure(db_engine):
    inspector = inspect(db_engine)
    cols = {c["name"] for c in inspector.get_columns("tasks")}
    required = {"id", "item_id", "title", "priority", "is_complete", "sort_order", "created_at", "updated_at"}
    assert required.issubset(cols)


def test_subtask_model_structure(db_engine):
    inspector = inspect(db_engine)
    cols = {c["name"] for c in inspector.get_columns("subtasks")}
    required = {"id", "task_id", "title", "is_complete", "sort_order", "created_at", "updated_at"}
    assert required.issubset(cols)


def test_tag_model_exists():
    """3.2: Tag and TaskTag models are registered in ORM."""
    from backend.models.item import Tag, TaskTag
    assert Tag.__tablename__ == "tags"
    assert TaskTag.__tablename__ == "task_tags"


def test_tag_nocase_via_migration(tmp_path):
    """3.2: Tags table has COLLATE NOCASE via migration (not just create_all)."""
    from backend.database import _run_migrations, get_engine, Base
    db = tmp_path / "nocase_test.db"
    engine = get_engine(f"sqlite:///{db}")
    _run_migrations(f"sqlite:///{db}")
    inspector = inspect(engine)
    indexes = inspector.get_indexes("tags")
    names = [idx["name"] for idx in indexes if idx.get("name")]
    assert any("nocase" in n.lower() for n in names), f"COLLATE NOCASE index missing: {names}"


def test_user_preference_model_structure(db_engine):
    inspector = inspect(db_engine)
    cols = {c["name"] for c in inspector.get_columns("user_preferences")}
    assert {"key", "value", "updated_at"}.issubset(cols)


def test_user_preference_readable(db_engine):
    with Session(db_engine) as session:
        pref = session.get(UserPreference, "approaching_deadline_threshold")
        assert pref is not None
        assert pref.value == "3"
