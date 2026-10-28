"""Task filter query builder (R12.5-R12.9)."""
from __future__ import annotations

from datetime import date
from typing import Optional

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from backend.exceptions import ValidationError
from backend.models.item import Item, Tag, Task, TaskTag
from backend.schemas.task import TaskResponse
from backend.services.task_service import _task_to_response

VALID_PRIORITIES = {"high", "medium", "low"}
VALID_CATEGORIES = {"project", "area", "inbox"}


def filter_tasks(
    session: Session,
    tags: list[int] | None = None,
    priorities: list[str] | None = None,
    due_start: Optional[str] = None,
    due_end: Optional[str] = None,
    category: Optional[str] = None,
    item_id: Optional[int] = None,
    include_complete: bool = True,
) -> list[TaskResponse]:
    """Return tasks matching ALL provided filters (AND logic across filter types).

    Within tags: OR. Within priorities: OR. Date range: inclusive both ends.
    Tasks on archived items are excluded; Inbox tasks are included unless
    category filter explicitly excludes them.
    """
    # Validate inputs
    if priorities:
        bad = [p for p in priorities if p not in VALID_PRIORITIES]
        if bad:
            raise ValidationError(
                f"Unknown priority values: {bad}",
                detail=f"Valid values: {sorted(VALID_PRIORITIES)}",
            )
    if category and category not in VALID_CATEGORIES:
        raise ValidationError(
            f"Unknown category: {category!r}",
            detail=f"Valid values: {sorted(VALID_CATEGORIES)}",
        )
    try:
        start_date = date.fromisoformat(due_start) if due_start else None
        end_date = date.fromisoformat(due_end) if due_end else None
    except ValueError as exc:
        raise ValidationError(str(exc)) from exc

    # Base query: tasks not on archived items
    stmt = (
        select(Task)
        .outerjoin(Item, Task.item_id == Item.id)
        .where(
            or_(
                Task.item_id.is_(None),          # Inbox tasks always included
                Item.archived_at.is_(None),       # Non-archived item tasks
            )
        )
    )

    if not include_complete:
        stmt = stmt.where(Task.is_complete == 0)

    # ---- Category / item filters ----
    if item_id is not None:
        stmt = stmt.where(Task.item_id == item_id)
    elif category == "inbox":
        stmt = stmt.where(Task.item_id.is_(None))
    elif category in ("project", "area"):
        stmt = stmt.where(
            Item.type == category,
            Task.item_id.isnot(None),
        )

    # ---- Priority filter (OR within) ----
    if priorities:
        stmt = stmt.where(Task.priority.in_(priorities))

    # ---- Due date range ----
    if start_date is not None:
        stmt = stmt.where(Task.due_date >= start_date)
    if end_date is not None:
        stmt = stmt.where(Task.due_date <= end_date)

    # ---- Tag filter (OR within) — via EXISTS subquery to avoid duplicates ----
    if tags:
        stmt = stmt.where(
            Task.id.in_(
                select(TaskTag.task_id).where(TaskTag.tag_id.in_(tags))
            )
        )

    stmt = stmt.order_by(Task.item_id.nulls_first(), Task.sort_order, Task.id)
    tasks = session.execute(stmt).scalars().unique().all()
    return [_task_to_response(session, t) for t in tasks]
