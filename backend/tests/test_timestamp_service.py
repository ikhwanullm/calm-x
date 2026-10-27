"""Tests for TimestampService."""
import pytest
import time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models.item import Item, Task
from backend.models.utils import now_utc
from backend.services.timestamp_service import (
    update_item_timestamp,
    update_task_timestamp,
    on_task_move,
)


@pytest.fixture
def db_session(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 't.db'}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    s = factory()
    yield s
    s.close()


def _project(s):
    item = Item(
        type="project", title="P", description="", notes="",
        created_at=now_utc(), updated_at=now_utc(), project_status="active",
    )
    s.add(item)
    s.flush()
    return item


def _task(s, item_id=None):
    t = Task(
        item_id=item_id, title="T", description="", notes="",
        priority="medium", is_complete=0, sort_order=0,
        created_at=now_utc(), updated_at=now_utc(),
    )
    s.add(t)
    s.flush()
    return t


def test_update_item_timestamp(db_session):
    item = _project(db_session)
    old_ts = item.updated_at
    time.sleep(0.01)
    update_item_timestamp(db_session, item.id)
    db_session.flush()
    assert item.updated_at > old_ts


def test_update_item_timestamp_none_is_noop(db_session):
    """None item_id (Inbox task) does not raise."""
    update_item_timestamp(db_session, None)  # must not raise


def test_update_task_timestamp_propagates_to_item(db_session):
    item = _project(db_session)
    task = _task(db_session, item.id)
    old_item_ts = item.updated_at
    time.sleep(0.01)
    update_task_timestamp(db_session, task.id)
    assert item.updated_at > old_item_ts


def test_on_task_move_updates_both_items(db_session):
    old_item = _project(db_session)
    new_item = _project(db_session)
    task = _task(db_session, old_item.id)
    old_old_ts = old_item.updated_at
    old_new_ts = new_item.updated_at
    time.sleep(0.01)
    on_task_move(db_session, task, old_item.id, new_item.id)
    assert old_item.updated_at > old_old_ts
    assert new_item.updated_at > old_new_ts
