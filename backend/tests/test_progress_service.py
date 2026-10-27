"""Tests for ProgressService."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models.item import Item, Task, Subtask
from backend.models.utils import now_utc
from backend.services.progress_service import (
    calculate_progress,
    calculate_project_progress,
    calculate_task_progress,
)


def test_calculate_progress_zero_total():
    assert calculate_progress(0, 0) == 0


def test_calculate_progress_regression_1_of_8():
    """REGRESSION: 1/8 must round up to 13, not 12."""
    assert calculate_progress(1, 8) == 13


def test_calculate_progress_half():
    assert calculate_progress(5, 10) == 50


def test_calculate_progress_full():
    assert calculate_progress(8, 8) == 100


@pytest.fixture
def db_session(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'p.db'}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    s = factory()
    yield s
    s.close()


def _make_project(s, title="P"):
    item = Item(
        type="project", title=title, description="", notes="",
        created_at=now_utc(), updated_at=now_utc(), project_status="active",
    )
    s.add(item)
    s.flush()
    return item


def _make_task(s, item_id, complete=False):
    t = Task(
        item_id=item_id, title="T", description="", notes="",
        priority="medium", is_complete=1 if complete else 0, sort_order=0,
        created_at=now_utc(), updated_at=now_utc(),
    )
    s.add(t)
    s.flush()
    return t


def test_project_progress_no_tasks(db_session):
    p = _make_project(db_session)
    assert calculate_project_progress(db_session, p.id) == 0


def test_project_progress_partial(db_session):
    p = _make_project(db_session)
    _make_task(db_session, p.id, complete=True)
    _make_task(db_session, p.id, complete=False)
    pct = calculate_project_progress(db_session, p.id)
    assert pct == 50


def test_task_progress_no_subtasks(db_session):
    p = _make_project(db_session)
    t = _make_task(db_session, p.id)
    assert calculate_task_progress(db_session, t.id) == 0
