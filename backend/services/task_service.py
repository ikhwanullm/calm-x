"""Task management service."""
from __future__ import annotations

from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.exceptions import ArchivedItemError, LimitExceededError, NotFoundError
from backend.models.item import Item, Subtask, Tag, Task, TaskTag
from backend.models.utils import now_utc
from backend.schemas.task import TaskCreate, TaskResponse, TaskUpdate
from backend.services.guards import guard_not_archived, guard_task_item_not_archived
from backend.services.timestamp_service import on_task_move, update_task_timestamp

MAX_TASKS_PER_ITEM = 100
MAX_TASKS_ERROR = "This item has reached the maximum of 100 tasks."


def _task_to_response(session: Session, task: Task) -> TaskResponse:
    """Convert a Task ORM object to TaskResponse (with subtask counts and tags)."""
    total_subs = session.execute(
        select(func.count()).where(Subtask.task_id == task.id)
    ).scalar_one()
    done_subs = session.execute(
        select(func.count()).where(Subtask.task_id == task.id, Subtask.is_complete == 1)
    ).scalar_one()
    tag_names = [
        tt.tag.name for tt in task.task_tags
    ] if task.task_tags is not None else []
    return TaskResponse(
        id=task.id,
        item_id=task.item_id,
        title=task.title,
        description=task.description,
        notes=task.notes,
        due_date=task.due_date,
        priority=task.priority,
        is_complete=bool(task.is_complete),
        sort_order=task.sort_order,
        created_at=task.created_at,
        updated_at=task.updated_at,
        subtask_count=total_subs,
        completed_subtask_count=done_subs,
        tags=tag_names,
    )


def _count_item_tasks(session: Session, item_id: Optional[int]) -> int:
    """Count tasks on a given item (or Inbox if item_id=None)."""
    return session.execute(
        select(func.count()).where(Task.item_id == item_id)
    ).scalar_one()


def get_task(session: Session, task_id: int) -> TaskResponse:
    task = session.get(Task, task_id)
    if task is None:
        raise NotFoundError(f"Task {task_id} not found")
    return _task_to_response(session, task)


def list_tasks(
    session: Session,
    item_id: Optional[int],
    include_complete: bool = True,
) -> list[TaskResponse]:
    """List tasks for an item (or Inbox if item_id=None)."""
    stmt = select(Task).where(Task.item_id == item_id)
    if not include_complete:
        stmt = stmt.where(Task.is_complete == 0)
    stmt = stmt.order_by(Task.sort_order, Task.id)
    tasks = session.execute(stmt).scalars().all()
    return [_task_to_response(session, t) for t in tasks]


def get_inbox_tasks(session: Session) -> list[TaskResponse]:
    return list_tasks(session, item_id=None)


def create_task(session: Session, data: TaskCreate) -> TaskResponse:
    """Create a task. Enforces 100-task limit and archived guard."""
    # Guard: parent item not archived
    parent_item = session.get(Item, data.item_id) if data.item_id is not None else None
    guard_task_item_not_archived(parent_item)

    # Enforce 100-task limit on the target item
    count = _count_item_tasks(session, data.item_id)
    if count >= MAX_TASKS_PER_ITEM:
        raise LimitExceededError(MAX_TASKS_ERROR, detail=f"item_id={data.item_id}")

    now = now_utc()
    task = Task(
        item_id=data.item_id,
        title=data.title,
        description=data.description,
        notes=data.notes,
        due_date=data.due_date,
        priority=data.priority,
        is_complete=0,
        sort_order=count,  # append at end
        created_at=now,
        updated_at=now,
    )
    session.add(task)
    session.flush()
    # Propagate timestamp to parent item
    if data.item_id is not None:
        item = session.get(Item, data.item_id)
        if item is not None:
            item.updated_at = now
    return _task_to_response(session, task)


def update_task(session: Session, task_id: int, data: TaskUpdate) -> TaskResponse:
    """Partially update a task. Raises ArchivedItemError if parent item is archived."""
    task = session.get(Task, task_id)
    if task is None:
        raise NotFoundError(f"Task {task_id} not found")
    parent = session.get(Item, task.item_id) if task.item_id else None
    guard_task_item_not_archived(parent)

    update_fields = data.model_dump(exclude_unset=True)
    # Prevent changing is_complete via update_task (use mark_complete/mark_incomplete)
    update_fields.pop("is_complete", None)
    update_fields.pop("item_id", None)
    for field, value in update_fields.items():
        setattr(task, field, value)
    task.updated_at = now_utc()
    if task.item_id is not None:
        item = session.get(Item, task.item_id)
        if item is not None:
            item.updated_at = now_utc()
    session.flush()
    return _task_to_response(session, task)


def delete_task(session: Session, task_id: int) -> None:
    """Delete a task. Requires archived guard (unlike delete_item which bypasses it)."""
    task = session.get(Task, task_id)
    if task is None:
        raise NotFoundError(f"Task {task_id} not found")
    parent = session.get(Item, task.item_id) if task.item_id else None
    guard_task_item_not_archived(parent)
    item_id = task.item_id
    session.delete(task)
    session.flush()
    # Update parent item timestamp
    if item_id is not None:
        item = session.get(Item, item_id)
        if item is not None:
            item.updated_at = now_utc()


def move_task(session: Session, task_id: int, target_item_id: Optional[int]) -> TaskResponse:
    """Move task to a different item (or Inbox). Enforces limit and archived guards."""
    task = session.get(Task, task_id)
    if task is None:
        raise NotFoundError(f"Task {task_id} not found")

    # Guard: source item not archived
    old_item = session.get(Item, task.item_id) if task.item_id else None
    guard_task_item_not_archived(old_item)

    # Guard: target item not archived
    if target_item_id is not None:
        target_item = session.get(Item, target_item_id)
        if target_item is None:
            raise NotFoundError(f"Item {target_item_id} not found")
        if target_item.archived_at is not None:
            raise ArchivedItemError(
                f"Cannot move task to archived item '{target_item.title}'",
                detail=f"item_id={target_item_id}",
            )
        # Enforce 100-task limit on target (excluding the task being moved if same item)
        count = _count_item_tasks(session, target_item_id)
        if task.item_id != target_item_id and count >= MAX_TASKS_PER_ITEM:
            raise LimitExceededError(MAX_TASKS_ERROR, detail=f"target_item_id={target_item_id}")

    old_item_id = task.item_id
    task.item_id = target_item_id
    on_task_move(session, task, old_item_id, target_item_id)
    session.flush()
    return _task_to_response(session, task)


def mark_complete(session: Session, task_id: int) -> TaskResponse:
    """Mark a task complete. Auto-completes ALL subtasks (R8.8)."""
    task = session.get(Task, task_id)
    if task is None:
        raise NotFoundError(f"Task {task_id} not found")
    parent = session.get(Item, task.item_id) if task.item_id else None
    guard_task_item_not_archived(parent)

    task.is_complete = 1
    # Auto-complete all subtasks
    now = now_utc()
    for subtask in task.subtasks:
        subtask.is_complete = 1
        subtask.updated_at = now
    task.updated_at = now
    if task.item_id is not None:
        item = session.get(Item, task.item_id)
        if item is not None:
            item.updated_at = now
    session.flush()
    return _task_to_response(session, task)


def mark_incomplete(session: Session, task_id: int) -> TaskResponse:
    """Mark a task incomplete. Auto-marks ALL subtasks incomplete (R8.9)."""
    task = session.get(Task, task_id)
    if task is None:
        raise NotFoundError(f"Task {task_id} not found")
    parent = session.get(Item, task.item_id) if task.item_id else None
    guard_task_item_not_archived(parent)

    task.is_complete = 0
    now = now_utc()
    for subtask in task.subtasks:
        subtask.is_complete = 0
        subtask.updated_at = now
    task.updated_at = now
    if task.item_id is not None:
        item = session.get(Item, task.item_id)
        if item is not None:
            item.updated_at = now
    session.flush()
    return _task_to_response(session, task)


def reorder_tasks(session: Session, item_id: Optional[int], task_ids: list[int]) -> list[TaskResponse]:
    """Update sort_order for tasks in an item."""
    tasks_by_id = {
        t.id: t
        for t in session.execute(
            select(Task).where(Task.item_id == item_id)
        ).scalars().all()
    }
    for order, tid in enumerate(task_ids):
        if tid in tasks_by_id:
            tasks_by_id[tid].sort_order = order
    session.flush()
    return list_tasks(session, item_id)
