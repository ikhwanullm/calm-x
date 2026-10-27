"""Timestamp propagation utilities."""
from __future__ import annotations

from sqlalchemy.orm import Session

from backend.models.item import Item, Task
from backend.models.utils import now_utc


def update_item_timestamp(session: Session, item_id: int | None) -> None:
    """Update the updated_at timestamp of an Item if it exists."""
    if item_id is None:
        return
    item = session.get(Item, item_id)
    if item is not None:
        item.updated_at = now_utc()


def update_task_timestamp(session: Session, task_id: int) -> None:
    """Update updated_at for a task and propagate to its parent item."""
    task = session.get(Task, task_id)
    if task is None:
        return
    task.updated_at = now_utc()
    update_item_timestamp(session, task.item_id)


def on_task_move(
    session: Session,
    task: Task,
    old_item_id: int | None,
    new_item_id: int | None,
) -> None:
    """Update timestamps for both old and new parent items after a task move."""
    task.updated_at = now_utc()
    update_item_timestamp(session, old_item_id)
    if new_item_id != old_item_id:
        update_item_timestamp(session, new_item_id)
