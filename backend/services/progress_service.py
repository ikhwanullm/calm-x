"""Progress calculation service."""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.models.item import Task


def calculate_progress(completed: int, total: int) -> int:
    """Round-half-up percentage: floor((200*completed + total) / (2*total)).

    Returns 0 when total <= 0.
    Example: calculate_progress(1, 8) == 13 (not 12).
    """
    if total <= 0:
        return 0
    return (200 * completed + total) // (2 * total)


def calculate_project_progress(session: Session, item_id: int) -> int:
    """Calculate progress percentage for a project based on its tasks."""
    total = session.execute(
        select(func.count()).where(Task.item_id == item_id)
    ).scalar_one()
    completed = session.execute(
        select(func.count()).where(Task.item_id == item_id, Task.is_complete == 1)
    ).scalar_one()
    return calculate_progress(completed, total)


def calculate_task_progress(session: Session, task_id: int) -> int:
    """Calculate progress percentage for a task based on its subtasks."""
    from backend.models.item import Subtask
    total = session.execute(
        select(func.count()).where(Subtask.task_id == task_id)
    ).scalar_one()
    completed = session.execute(
        select(func.count()).where(Subtask.task_id == task_id, Subtask.is_complete == 1)
    ).scalar_one()
    return calculate_progress(completed, total)
