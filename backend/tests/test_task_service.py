"""Tests for TaskService — CRUD, limits, guards, and synchronization."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from backend.database import Base
from backend.exceptions import ArchivedItemError, LimitExceededError, NotFoundError
from backend.models.item import Item, Subtask, Task
from backend.models.utils import now_utc
from backend.schemas.task import TaskCreate, TaskUpdate
from backend.services import task_service


@pytest.fixture
def db_session(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    session = factory()
    yield session
    session.close()


def _make_item(session, title="Test Project", archived=False):
    item = Item(
        type="project", title=title, description="", notes="",
        project_status="active",
        archived_at=now_utc() if archived else None,
        created_at=now_utc(), updated_at=now_utc(),
    )
    session.add(item)
    session.flush()
    return item


def _make_task(session, item_id=None, title="Test Task", is_complete=0):
    task = Task(
        item_id=item_id, title=title, description="", notes="",
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
# Basic CRUD
# ---------------------------------------------------------------------------

def test_create_task_inbox(db_session):
    data = TaskCreate(title="Inbox task")
    resp = task_service.create_task(db_session, data)
    assert resp.title == "Inbox task"
    assert resp.item_id is None


def test_create_task_on_item(db_session):
    item = _make_item(db_session)
    data = TaskCreate(title="Item task", item_id=item.id)
    resp = task_service.create_task(db_session, data)
    assert resp.item_id == item.id


def test_get_task_not_found(db_session):
    with pytest.raises(NotFoundError):
        task_service.get_task(db_session, 9999)


def test_list_tasks_returns_tasks(db_session):
    item = _make_item(db_session)
    _make_task(db_session, item_id=item.id, title="Task A")
    _make_task(db_session, item_id=item.id, title="Task B")
    results = task_service.list_tasks(db_session, item_id=item.id)
    assert len(results) == 2


def test_list_tasks_exclude_complete(db_session):
    item = _make_item(db_session)
    _make_task(db_session, item_id=item.id, title="Done", is_complete=1)
    _make_task(db_session, item_id=item.id, title="Open")
    results = task_service.list_tasks(db_session, item_id=item.id, include_complete=False)
    assert len(results) == 1
    assert results[0].title == "Open"


def test_update_task_title(db_session):
    task = _make_task(db_session)
    resp = task_service.update_task(db_session, task.id, TaskUpdate(title="Updated"))
    assert resp.title == "Updated"


def test_delete_task(db_session):
    task = _make_task(db_session)
    task_id = task.id
    task_service.delete_task(db_session, task_id)
    assert db_session.get(Task, task_id) is None


# ---------------------------------------------------------------------------
# Limits and guards
# ---------------------------------------------------------------------------

def test_create_task_limit(db_session):
    """Creating the 101st task raises LimitExceededError (R4.5/R4.6)."""
    item = _make_item(db_session)
    # Create 100 tasks directly to avoid N+1 overhead
    for i in range(100):
        t = Task(
            item_id=item.id, title=f"T{i}", description="", notes="",
            priority="medium", is_complete=0, sort_order=i,
            created_at=now_utc(), updated_at=now_utc(),
        )
        db_session.add(t)
    db_session.flush()

    with pytest.raises(LimitExceededError):
        task_service.create_task(db_session, TaskCreate(title="Overflow", item_id=item.id))


def test_create_task_archived_item_raises(db_session):
    """Creating a task on an archived item raises ArchivedItemError."""
    item = _make_item(db_session, archived=True)
    with pytest.raises(ArchivedItemError):
        task_service.create_task(db_session, TaskCreate(title="Nope", item_id=item.id))


def test_delete_task_archived_item_raises(db_session):
    """delete_task requires archived guard (unlike delete_item which bypasses it)."""
    item = _make_item(db_session)
    task = _make_task(db_session, item_id=item.id)
    # Archive the item AFTER creating the task
    item.archived_at = now_utc()
    db_session.flush()

    with pytest.raises(ArchivedItemError):
        task_service.delete_task(db_session, task.id)


def test_update_task_archived_item_raises(db_session):
    item = _make_item(db_session)
    task = _make_task(db_session, item_id=item.id)
    item.archived_at = now_utc()
    db_session.flush()

    with pytest.raises(ArchivedItemError):
        task_service.update_task(db_session, task.id, TaskUpdate(title="No"))


# ---------------------------------------------------------------------------
# Task movement
# ---------------------------------------------------------------------------

def test_move_task_to_another_item(db_session):
    src = _make_item(db_session, title="Source")
    dst = _make_item(db_session, title="Dest")
    task = _make_task(db_session, item_id=src.id)
    resp = task_service.move_task(db_session, task.id, dst.id)
    assert resp.item_id == dst.id


def test_move_task_to_inbox(db_session):
    item = _make_item(db_session)
    task = _make_task(db_session, item_id=item.id)
    resp = task_service.move_task(db_session, task.id, None)
    assert resp.item_id is None


def test_move_task_to_archived_raises(db_session):
    """Cannot move a task to an archived item."""
    src = _make_item(db_session, title="Source")
    dst = _make_item(db_session, title="Archived Dest", archived=True)
    task = _make_task(db_session, item_id=src.id)

    with pytest.raises(ArchivedItemError):
        task_service.move_task(db_session, task.id, dst.id)


def test_move_task_enforces_limit_on_target(db_session):
    """Moving a task to a full target item raises LimitExceededError."""
    src = _make_item(db_session, title="Source")
    dst = _make_item(db_session, title="Dest")

    # Fill destination to 100 tasks
    for i in range(100):
        t = Task(
            item_id=dst.id, title=f"T{i}", description="", notes="",
            priority="medium", is_complete=0, sort_order=i,
            created_at=now_utc(), updated_at=now_utc(),
        )
        db_session.add(t)
    db_session.flush()

    task = _make_task(db_session, item_id=src.id)
    with pytest.raises(LimitExceededError):
        task_service.move_task(db_session, task.id, dst.id)


# ---------------------------------------------------------------------------
# Completion with subtask cascade
# ---------------------------------------------------------------------------

def test_mark_complete_auto_completes_subtasks(db_session):
    """R8.8: marking task complete auto-completes all subtasks."""
    task = _make_task(db_session)
    _make_subtask(db_session, task.id, "Sub 1", is_complete=0)
    _make_subtask(db_session, task.id, "Sub 2", is_complete=0)

    resp = task_service.mark_complete(db_session, task.id)
    assert resp.is_complete is True
    assert resp.completed_subtask_count == 2
    assert resp.subtask_count == 2


def test_mark_incomplete_auto_marks_subtasks_incomplete(db_session):
    """R8.9: marking task incomplete marks all subtasks incomplete."""
    task = _make_task(db_session, is_complete=1)
    _make_subtask(db_session, task.id, "Sub 1", is_complete=1)
    _make_subtask(db_session, task.id, "Sub 2", is_complete=1)

    resp = task_service.mark_incomplete(db_session, task.id)
    assert resp.is_complete is False
    assert resp.completed_subtask_count == 0


def test_mark_complete_archived_raises(db_session):
    item = _make_item(db_session)
    task = _make_task(db_session, item_id=item.id)
    item.archived_at = now_utc()
    db_session.flush()
    with pytest.raises(ArchivedItemError):
        task_service.mark_complete(db_session, task.id)


# ---------------------------------------------------------------------------
# Reorder
# ---------------------------------------------------------------------------

def test_reorder_tasks(db_session):
    item = _make_item(db_session)
    t1 = _make_task(db_session, item_id=item.id, title="T1")
    t2 = _make_task(db_session, item_id=item.id, title="T2")
    t3 = _make_task(db_session, item_id=item.id, title="T3")

    # Reverse order
    task_service.reorder_tasks(db_session, item.id, [t3.id, t2.id, t1.id])
    results = task_service.list_tasks(db_session, item_id=item.id)
    assert results[0].id == t3.id
    assert results[1].id == t2.id
    assert results[2].id == t1.id
