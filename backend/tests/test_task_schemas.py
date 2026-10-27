"""Tests for Task and Subtask Pydantic schemas."""
import pytest
from datetime import datetime, timezone

from pydantic import ValidationError

from backend.schemas.task import (
    SubtaskCreate,
    SubtaskUpdate,
    SubtaskResponse,
    TaskCreate,
    TaskUpdate,
    TaskResponse,
    TaskMovePayload,
    TaskReorderPayload,
)


# ---------------------------------------------------------------------------
# SubtaskCreate
# ---------------------------------------------------------------------------

def test_subtask_create_strips_whitespace():
    s = SubtaskCreate(title="  Buy milk  ")
    assert s.title == "Buy milk"


def test_subtask_create_empty_title_raises():
    with pytest.raises(ValidationError):
        SubtaskCreate(title="   ")


def test_subtask_create_empty_string_raises():
    with pytest.raises(ValidationError):
        SubtaskCreate(title="")


# ---------------------------------------------------------------------------
# SubtaskUpdate
# ---------------------------------------------------------------------------

def test_subtask_update_none_title_allowed():
    s = SubtaskUpdate()
    assert s.title is None


def test_subtask_update_strips_whitespace():
    s = SubtaskUpdate(title="  Walk dog  ")
    assert s.title == "Walk dog"


def test_subtask_update_empty_title_raises():
    with pytest.raises(ValidationError):
        SubtaskUpdate(title="   ")


# ---------------------------------------------------------------------------
# TaskCreate
# ---------------------------------------------------------------------------

def test_task_create_strips_title():
    t = TaskCreate(title="  My Task  ")
    assert t.title == "My Task"


def test_task_create_default_priority():
    t = TaskCreate(title="My Task")
    assert t.priority == "medium"


def test_task_create_valid_priorities():
    for p in ("high", "medium", "low"):
        t = TaskCreate(title="Task", priority=p)
        assert t.priority == p


def test_task_create_invalid_priority_raises():
    with pytest.raises(ValidationError):
        TaskCreate(title="Task", priority="urgent")


def test_task_create_empty_title_raises():
    with pytest.raises(ValidationError):
        TaskCreate(title="  ")


def test_task_create_item_id_none_by_default():
    t = TaskCreate(title="Inbox task")
    assert t.item_id is None


def test_task_create_with_item_id():
    t = TaskCreate(title="Task", item_id=42)
    assert t.item_id == 42


# ---------------------------------------------------------------------------
# TaskUpdate
# ---------------------------------------------------------------------------

def test_task_update_all_optional():
    u = TaskUpdate()
    assert u.title is None
    assert u.priority is None
    assert u.is_complete is None


def test_task_update_only_provided_fields():
    u = TaskUpdate(title="Updated")
    data = u.model_dump(exclude_unset=True)
    assert list(data.keys()) == ["title"]
    assert data["title"] == "Updated"


def test_task_update_strips_title():
    u = TaskUpdate(title="  Trimmed  ")
    assert u.title == "Trimmed"


def test_task_update_empty_title_raises():
    with pytest.raises(ValidationError):
        TaskUpdate(title="   ")


def test_task_update_invalid_priority_raises():
    with pytest.raises(ValidationError):
        TaskUpdate(priority="critical")


# ---------------------------------------------------------------------------
# TaskResponse defaults
# ---------------------------------------------------------------------------

def test_task_response_defaults():
    now = datetime.now(tz=timezone.utc)
    r = TaskResponse(
        id=1,
        title="Test",
        description="",
        notes="",
        priority="medium",
        is_complete=False,
        sort_order=0,
        created_at=now,
        updated_at=now,
    )
    assert r.tags == []
    assert r.subtask_count == 0
    assert r.completed_subtask_count == 0
    assert r.item_id is None


# ---------------------------------------------------------------------------
# TaskMovePayload
# ---------------------------------------------------------------------------

def test_task_move_payload_inbox():
    p = TaskMovePayload()
    assert p.item_id is None


def test_task_move_payload_with_item():
    p = TaskMovePayload(item_id=5)
    assert p.item_id == 5


# ---------------------------------------------------------------------------
# TaskReorderPayload
# ---------------------------------------------------------------------------

def test_task_reorder_payload():
    p = TaskReorderPayload(task_ids=[3, 1, 2])
    assert p.task_ids == [3, 1, 2]


def test_task_reorder_payload_empty_list():
    p = TaskReorderPayload(task_ids=[])
    assert p.task_ids == []
