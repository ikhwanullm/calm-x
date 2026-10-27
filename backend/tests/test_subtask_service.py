"""Tests for SubtaskService — limits, guards, and sync rules."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from backend.database import Base
from backend.exceptions import ArchivedItemError, LimitExceededError, NotFoundError
from backend.models.item import Item, Subtask, Task
from backend.models.utils import now_utc
from backend.schemas.task import SubtaskCreate, SubtaskUpdate
from backend.services import subtask_service


@pytest.fixture
def db_session(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    session = factory()
    yield session
    session.close()


def _make_item(session, archived=False):
    item = Item(
        type="project", title="Project", description="", notes="",
        project_status="active",
        archived_at=now_utc() if archived else None,
        created_at=now_utc(), updated_at=now_utc(),
    )
    session.add(item)
    session.flush()
    return item


def _make_task(session, item_id=None, is_complete=0):
    task = Task(
        item_id=item_id, title="Task", description="", notes="",
        priority="medium", is_complete=is_complete, sort_order=0,
        created_at=now_utc(), updated_at=now_utc(),
    )
    session.add(task)
    session.flush()
    return task


def _make_subtask(session, task_id, title="Sub", is_complete=0):
    sub = Subtask(
        task_id=task_id, title=title, is_complete=is_complete, sort_order=0,
        created_at=now_utc(), updated_at=now_utc(),
    )
    session.add(sub)
    session.flush()
    return sub


# ---------------------------------------------------------------------------
# Basic operations
# ---------------------------------------------------------------------------

def test_list_subtasks(db_session):
    task = _make_task(db_session)
    _make_subtask(db_session, task.id, "A")
    _make_subtask(db_session, task.id, "B")
    result = subtask_service.list_subtasks(db_session, task.id)
    assert len(result) == 2


def test_create_subtask(db_session):
    task = _make_task(db_session)
    resp = subtask_service.create_subtask(db_session, task.id, SubtaskCreate(title="New sub"))
    assert resp.title == "New sub"
    assert resp.task_id == task.id


def test_update_subtask_title(db_session):
    task = _make_task(db_session)
    sub = _make_subtask(db_session, task.id)
    resp = subtask_service.update_subtask(db_session, sub.id, SubtaskUpdate(title="Updated"))
    assert resp.title == "Updated"


def test_delete_subtask(db_session):
    task = _make_task(db_session)
    sub = _make_subtask(db_session, task.id)
    sub_id = sub.id
    subtask_service.delete_subtask(db_session, sub_id)
    assert db_session.get(Subtask, sub_id) is None


# ---------------------------------------------------------------------------
# Limits
# ---------------------------------------------------------------------------

def test_create_subtask_limit(db_session):
    """101st subtask raises LimitExceededError (R8.3/R8.4)."""
    task = _make_task(db_session)
    for i in range(100):
        s = Subtask(
            task_id=task.id, title=f"S{i}", is_complete=0, sort_order=i,
            created_at=now_utc(), updated_at=now_utc(),
        )
        db_session.add(s)
    db_session.flush()

    with pytest.raises(LimitExceededError):
        subtask_service.create_subtask(db_session, task.id, SubtaskCreate(title="Overflow"))


# ---------------------------------------------------------------------------
# Archived guard
# ---------------------------------------------------------------------------

def test_create_subtask_archived_item_raises(db_session):
    item = _make_item(db_session, archived=True)
    task = _make_task(db_session, item_id=item.id)
    # archive guard fires even though task was created before archival
    item.archived_at = now_utc()
    db_session.flush()
    with pytest.raises(ArchivedItemError):
        subtask_service.create_subtask(db_session, task.id, SubtaskCreate(title="Sub"))


# ---------------------------------------------------------------------------
# Synchronization rules
# ---------------------------------------------------------------------------

def test_create_subtask_reopens_complete_task(db_session):
    """R8.10: adding subtask to complete task makes task incomplete."""
    task = _make_task(db_session, is_complete=1)
    subtask_service.create_subtask(db_session, task.id, SubtaskCreate(title="New sub"))
    db_session.refresh(task)
    assert task.is_complete == 0


def test_mark_subtask_complete_all_done_completes_task(db_session):
    """R8.6: when all subtasks complete, parent task becomes complete."""
    task = _make_task(db_session, is_complete=0)
    s1 = _make_subtask(db_session, task.id, "A", is_complete=1)
    s2 = _make_subtask(db_session, task.id, "B", is_complete=0)

    subtask_service.mark_subtask_complete(db_session, s2.id)
    db_session.refresh(task)
    assert task.is_complete == 1


def test_mark_subtask_complete_not_all_done_leaves_task_incomplete(db_session):
    """If not all subtasks complete, task stays incomplete."""
    task = _make_task(db_session, is_complete=0)
    s1 = _make_subtask(db_session, task.id, "A", is_complete=0)
    _make_subtask(db_session, task.id, "B", is_complete=0)

    subtask_service.mark_subtask_complete(db_session, s1.id)
    db_session.refresh(task)
    assert task.is_complete == 0


def test_mark_subtask_incomplete_reopens_task(db_session):
    """R8.7: marking any subtask incomplete makes parent task incomplete."""
    task = _make_task(db_session, is_complete=1)
    s1 = _make_subtask(db_session, task.id, "A", is_complete=1)
    _make_subtask(db_session, task.id, "B", is_complete=1)

    subtask_service.mark_subtask_incomplete(db_session, s1.id)
    db_session.refresh(task)
    assert task.is_complete == 0


def test_delete_subtask_reevaluates_all_done(db_session):
    """Deleting the last incomplete subtask causes task to become complete."""
    task = _make_task(db_session, is_complete=0)
    s1 = _make_subtask(db_session, task.id, "Done", is_complete=1)
    s2 = _make_subtask(db_session, task.id, "Pending", is_complete=0)

    # Delete the only incomplete subtask
    subtask_service.delete_subtask(db_session, s2.id)
    db_session.refresh(task)
    assert task.is_complete == 1


def test_delete_subtask_no_remaining_leaves_task_status(db_session):
    """Deleting last subtask when task was incomplete leaves task incomplete."""
    task = _make_task(db_session, is_complete=0)
    sub = _make_subtask(db_session, task.id, "Only sub", is_complete=0)

    subtask_service.delete_subtask(db_session, sub.id)
    db_session.refresh(task)
    # No subtasks remain, task status unchanged
    assert task.is_complete == 0


def test_delete_subtask_archived_raises(db_session):
    item = _make_item(db_session)
    task = _make_task(db_session, item_id=item.id)
    sub = _make_subtask(db_session, task.id)
    item.archived_at = now_utc()
    db_session.flush()

    with pytest.raises(ArchivedItemError):
        subtask_service.delete_subtask(db_session, sub.id)
