"""Tests for migration 001 — verify all tables and default data are created."""
import tempfile
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine

from backend.database import _run_migrations


@pytest.fixture(scope="module")
def migrated_engine(tmp_path_factory) -> Engine:
    """Run migrations against a fresh temp database and return the engine."""
    db_path = tmp_path_factory.mktemp("db") / "test_migration.db"
    db_url = f"sqlite:///{db_path}"
    engine = create_engine(db_url)

    # Enable foreign keys and WAL
    with engine.connect() as conn:
        conn.execute(text("PRAGMA foreign_keys=ON"))
        conn.execute(text("PRAGMA journal_mode=WAL"))

    _run_migrations(db_url)
    return engine


EXPECTED_TABLES = {
    "items",
    "tasks",
    "subtasks",
    "tags",
    "task_tags",
    "reference_links",
    "resource_links",
    "templates",
    "template_tasks",
    "weekly_reviews",
    "user_preferences",
}


def test_all_tables_created(migrated_engine):
    inspector = inspect(migrated_engine)
    tables = set(inspector.get_table_names())
    assert EXPECTED_TABLES.issubset(tables), f"Missing tables: {EXPECTED_TABLES - tables}"


def test_default_preference_inserted(migrated_engine):
    with migrated_engine.connect() as conn:
        result = conn.execute(
            text("SELECT value FROM user_preferences WHERE key = 'approaching_deadline_threshold'")
        ).scalar()
    assert result == "3"


def test_items_columns(migrated_engine):
    inspector = inspect(migrated_engine)
    cols = {c["name"] for c in inspector.get_columns("items")}
    required = {
        "id", "type", "title", "description", "notes",
        "archived_at", "created_at", "updated_at",
        "project_goal", "project_deadline", "project_status",
        "project_completed_at", "area_maintenance_notes",
    }
    assert required.issubset(cols), f"Missing columns: {required - cols}"


def test_tasks_foreign_key_cascade(migrated_engine):
    """Deleting an item must cascade-delete its tasks."""
    with migrated_engine.connect() as conn:
        conn.execute(text("PRAGMA foreign_keys=ON"))
        now = "2024-01-01 00:00:00"
        # Insert item
        conn.execute(text(
            "INSERT INTO items (type, title, created_at, updated_at) VALUES ('project', 'Test', :now, :now)"
        ), {"now": now})
        item_id = conn.execute(text("SELECT last_insert_rowid()")).scalar()
        # Insert task
        conn.execute(text(
            "INSERT INTO tasks (item_id, title, created_at, updated_at) VALUES (:iid, 'Task 1', :now, :now)"
        ), {"iid": item_id, "now": now})
        task_count_before = conn.execute(text("SELECT COUNT(*) FROM tasks WHERE item_id = :iid"), {"iid": item_id}).scalar()
        # Delete item
        conn.execute(text("DELETE FROM items WHERE id = :iid"), {"iid": item_id})
        conn.commit()
        task_count_after = conn.execute(text("SELECT COUNT(*) FROM tasks WHERE item_id = :iid"), {"iid": item_id}).scalar()
    assert task_count_before == 1
    assert task_count_after == 0


def test_indexes_created(migrated_engine):
    inspector = inspect(migrated_engine)
    all_indexes = []
    for table in EXPECTED_TABLES:
        try:
            all_indexes.extend(
                idx["name"] for idx in inspector.get_indexes(table) if idx.get("name")
            )
        except Exception:
            pass
    index_set = set(all_indexes)
    required_indexes = {
        "idx_items_type",
        "idx_tasks_item_id",
        "idx_tasks_due_date",
        "idx_subtasks_task_id",
    }
    assert required_indexes.issubset(index_set), f"Missing indexes: {required_indexes - index_set}"
