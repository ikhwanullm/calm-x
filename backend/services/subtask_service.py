"""Subtask management service."""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.exceptions import LimitExceededError, NotFoundError
from backend.models.item import Item, Subtask, Task
from backend.models.utils import now_utc
from backend.schemas.task import SubtaskCreate, SubtaskResponse, SubtaskUpdate
from backend.services.guards import guard_task_item_not_archived

MAX_SUBTASKS_PER_TASK = 100
MAX_SUBTASKS_ERROR = "This task has reached the maximum of 100 subtasks."


def _sub_response(s: Subtask) -> SubtaskResponse:
    return SubtaskResponse(
        id=s.id, task_id=s.task_id, title=s.title,
        is_complete=bool(s.is_complete), sort_order=s.sort_order,
        created_at=s.created_at, updated_at=s.updated_at,
    )


def _get_parent_item(session: Session, task: Task) -> Item | None:
    return session.get(Item, task.item_id) if task.item_id else None


def _reevaluate_task_status(session: Session, task: Task) -> None:
    """After subtask deletion or changes, re-evaluate task completion status.

    - If no subtasks remain: leave task status unchanged.
    - If all subtasks are complete: mark task complete.
    - If any subtask is incomplete: mark task incomplete.
    """
    subtasks = session.execute(
        select(Subtask).where(Subtask.task_id == task.id)
    ).scalars().all()
    if not subtasks:
        return  # no subtasks — leave task status as-is
    all_done = all(s.is_complete for s in subtasks)
    new_status = 1 if all_done else 0
    if task.is_complete != new_status:
        task.is_complete = new_status
        task.updated_at = now_utc()
        # Propagate to parent item
        if task.item_id is not None:
            item = session.get(Item, task.item_id)
            if item is not None:
                item.updated_at = now_utc()
        session.flush()


def list_subtasks(session: Session, task_id: int) -> list[SubtaskResponse]:
    task = session.get(Task, task_id)
    if task is None:
        raise NotFoundError(f"Task {task_id} not found")
    subs = session.execute(
        select(Subtask).where(Subtask.task_id == task_id).order_by(Subtask.sort_order, Subtask.id)
    ).scalars().all()
    return [_sub_response(s) for s in subs]


def create_subtask(session: Session, task_id: int, data: SubtaskCreate) -> SubtaskResponse:
    """Create a subtask. Enforces limit, guard, and auto-reopens complete parent task (R8.10)."""
    task = session.get(Task, task_id)
    if task is None:
        raise NotFoundError(f"Task {task_id} not found")
    guard_task_item_not_archived(_get_parent_item(session, task))

    count = session.execute(
        select(func.count()).where(Subtask.task_id == task_id)
    ).scalar_one()
    if count >= MAX_SUBTASKS_PER_TASK:
        raise LimitExceededError(MAX_SUBTASKS_ERROR)

    now = now_utc()
    subtask = Subtask(
        task_id=task_id,
        title=data.title,
        is_complete=0,
        sort_order=count,
        created_at=now,
        updated_at=now,
    )
    session.add(subtask)
    session.flush()

    # R8.10: Adding subtask to complete task -> mark task incomplete
    if task.is_complete:
        task.is_complete = 0
        task.updated_at = now
        if task.item_id is not None:
            item = session.get(Item, task.item_id)
            if item is not None:
                item.updated_at = now
    else:
        task.updated_at = now
    session.flush()
    return _sub_response(subtask)


def update_subtask(session: Session, subtask_id: int, data: SubtaskUpdate) -> SubtaskResponse:
    subtask = session.get(Subtask, subtask_id)
    if subtask is None:
        raise NotFoundError(f"Subtask {subtask_id} not found")
    task = session.get(Task, subtask.task_id)
    guard_task_item_not_archived(_get_parent_item(session, task))

    if data.title is not None:
        subtask.title = data.title
    subtask.updated_at = now_utc()
    task.updated_at = now_utc()
    session.flush()
    return _sub_response(subtask)


def delete_subtask(session: Session, subtask_id: int) -> None:
    """Delete a subtask and re-evaluate parent task completion status."""
    subtask = session.get(Subtask, subtask_id)
    if subtask is None:
        raise NotFoundError(f"Subtask {subtask_id} not found")
    task = session.get(Task, subtask.task_id)
    guard_task_item_not_archived(_get_parent_item(session, task))

    session.delete(subtask)
    session.flush()
    # R8.x: Re-evaluate task status after deletion
    _reevaluate_task_status(session, task)


def mark_subtask_complete(session: Session, subtask_id: int) -> SubtaskResponse:
    """Mark subtask complete. If all subtasks done -> mark parent task complete (R8.6)."""
    subtask = session.get(Subtask, subtask_id)
    if subtask is None:
        raise NotFoundError(f"Subtask {subtask_id} not found")
    task = session.get(Task, subtask.task_id)
    guard_task_item_not_archived(_get_parent_item(session, task))

    now = now_utc()
    subtask.is_complete = 1
    subtask.updated_at = now
    session.flush()
    _reevaluate_task_status(session, task)
    return _sub_response(subtask)


def mark_subtask_incomplete(session: Session, subtask_id: int) -> SubtaskResponse:
    """Mark subtask incomplete. Mark parent task incomplete (R8.7)."""
    subtask = session.get(Subtask, subtask_id)
    if subtask is None:
        raise NotFoundError(f"Subtask {subtask_id} not found")
    task = session.get(Task, subtask.task_id)
    guard_task_item_not_archived(_get_parent_item(session, task))

    now = now_utc()
    subtask.is_complete = 0
    subtask.updated_at = now
    # Always mark parent incomplete when any subtask goes incomplete (R8.7)
    if task.is_complete:
        task.is_complete = 0
        task.updated_at = now
        if task.item_id is not None:
            item = session.get(Item, task.item_id)
            if item is not None:
                item.updated_at = now
    session.flush()
    return _sub_response(subtask)
