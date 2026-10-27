"""Property tests P1-P6 for progress calculation and task-subtask sync."""
from __future__ import annotations

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models.item import Item, Task, Subtask
from backend.models.utils import now_utc
from backend.services.progress_service import calculate_progress
from backend.services import task_service, subtask_service
from backend.schemas.task import SubtaskCreate, TaskCreate


# ---------------------------------------------------------------------------
# P1: Progress Calculation Consistency
# ---------------------------------------------------------------------------

@given(
    total=st.integers(min_value=1, max_value=200),
    completed=st.integers(min_value=0, max_value=200),
)
@settings(max_examples=50, deadline=None)
def test_p1_progress_always_in_range(total, completed):
    """P1: calculate_progress(m, n) always returns 0-100 for any valid m, n."""
    m = min(completed, total)
    pct = calculate_progress(m, total)
    assert 0 <= pct <= 100


def test_p1_progress_zero_when_total_zero():
    assert calculate_progress(0, 0) == 0


def test_p1_progress_1_of_8_is_13():
    """REGRESSION: 1/8 = 12.5 rounds UP to 13."""
    assert calculate_progress(1, 8) == 13


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def db_session(tmp_path):
    import sqlalchemy
    engine = create_engine(f"sqlite:///{tmp_path / 'p_tests.db'}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    s = factory()
    s.execute(sqlalchemy.text("PRAGMA foreign_keys=ON"))
    yield s
    s.close()


def _make_item(s, t="project"):
    item = Item(type=t, title="T", description="", notes="",
                created_at=now_utc(), updated_at=now_utc(),
                project_status="active" if t == "project" else None)
    s.add(item)
    s.flush()
    return item


def _make_task_orm(s, item_id=None, complete=False):
    task = Task(item_id=item_id, title="Task", description="", notes="",
                priority="medium", is_complete=1 if complete else 0,
                sort_order=0, created_at=now_utc(), updated_at=now_utc())
    s.add(task)
    s.flush()
    return task


def _make_subtask_orm(s, task_id, complete=False):
    sub = Subtask(task_id=task_id, title="Sub", is_complete=1 if complete else 0,
                  sort_order=0, created_at=now_utc(), updated_at=now_utc())
    s.add(sub)
    s.flush()
    return sub


# ---------------------------------------------------------------------------
# P2: Task Completion Cascades to Subtasks (R8.8)
# ---------------------------------------------------------------------------

def test_p2_complete_task_cascades_subtasks(db_session):
    """P2: mark_complete sets all subtasks to complete."""
    task = _make_task_orm(db_session)
    s1 = _make_subtask_orm(db_session, task.id, complete=False)
    s2 = _make_subtask_orm(db_session, task.id, complete=False)
    task_service.mark_complete(db_session, task.id)
    db_session.refresh(s1)
    db_session.refresh(s2)
    assert s1.is_complete == 1
    assert s2.is_complete == 1


# ---------------------------------------------------------------------------
# P3: Task Incompletion Cascades to Subtasks (R8.9)
# ---------------------------------------------------------------------------

def test_p3_incomplete_task_cascades_subtasks(db_session):
    """P3: mark_incomplete sets all subtasks to incomplete."""
    task = _make_task_orm(db_session, complete=True)
    s1 = _make_subtask_orm(db_session, task.id, complete=True)
    s2 = _make_subtask_orm(db_session, task.id, complete=True)
    task_service.mark_incomplete(db_session, task.id)
    db_session.refresh(s1)
    db_session.refresh(s2)
    assert s1.is_complete == 0
    assert s2.is_complete == 0


# ---------------------------------------------------------------------------
# P4: All Subtasks Complete Triggers Task Completion (R8.6)
# ---------------------------------------------------------------------------

def test_p4_all_subtasks_complete_completes_task(db_session):
    """P4: completing last subtask marks parent task complete."""
    task = _make_task_orm(db_session)
    s1 = _make_subtask_orm(db_session, task.id, complete=True)
    s2 = _make_subtask_orm(db_session, task.id, complete=False)
    subtask_service.mark_subtask_complete(db_session, s2.id)
    db_session.refresh(task)
    assert task.is_complete == 1


# ---------------------------------------------------------------------------
# P5: Subtask Incompletion Propagates to Task (R8.7)
# ---------------------------------------------------------------------------

def test_p5_subtask_incomplete_reopens_task(db_session):
    """P5: marking any subtask incomplete makes parent task incomplete."""
    task = _make_task_orm(db_session, complete=True)
    s1 = _make_subtask_orm(db_session, task.id, complete=True)
    subtask_service.mark_subtask_incomplete(db_session, s1.id)
    db_session.refresh(task)
    assert task.is_complete == 0


# ---------------------------------------------------------------------------
# P6: Adding Subtask to Complete Task Makes Task Incomplete (R8.10)
# ---------------------------------------------------------------------------

def test_p6_add_subtask_reopens_complete_task(db_session):
    """P6: adding subtask to complete task reopens it."""
    task = _make_task_orm(db_session, complete=True)
    subtask_service.create_subtask(db_session, task.id, SubtaskCreate(title="New"))
    db_session.refresh(task)
    assert task.is_complete == 0


# ---------------------------------------------------------------------------
# Task 3.41 REGRESSION: backend calculate_progress(1, 8) = 13
# ---------------------------------------------------------------------------

def test_p1_backend_regression_1_of_8():
    """3.41 REGRESSION: backend calculate_progress(1, 8) must return 13."""
    from backend.services.progress_service import calculate_progress as cp
    assert cp(1, 8) == 13
