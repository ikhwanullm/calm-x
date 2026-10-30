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
VALID_STATUS = {"open", "completed", "all"}
VALID_SORTS = {"due", "priority", "project", "created", "updated"}
VALID_ORDERS = {"asc", "desc"}
_PRIORITY_RANK = {"high": 0, "medium": 1, "low": 2}


def _escape_like(query: str) -> str:
    return query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _sort_tasks(tasks: list[Task], sort: str, order: str) -> list[Task]:
    """Sort by `sort`; tasks without a value (no due date) always come last, ties by id."""
    sign = -1 if order == "desc" else 1
    if sort == "project":
        # Inbox tasks (no project) have an empty name, so they come first ascending and last descending
        return sorted(tasks, key=lambda t: ((t.item.title.lower() if t.item is not None else ""), t.id), reverse=sign == -1)

    def key(t: Task):
        if sort == "due":
            return (t.due_date is None, (t.due_date.toordinal() * sign) if t.due_date else 0, t.id)
        if sort == "priority":
            return (False, _PRIORITY_RANK.get(t.priority, 1) * sign, t.id)
        stamp = (t.created_at if sort == "created" else t.updated_at).timestamp()
        return (False, stamp * sign, t.id)

    return sorted(tasks, key=key)


def filter_tasks(
    session: Session,
    tags: list[int] | None = None,
    priorities: list[str] | None = None,
    due_start: Optional[str] = None,
    due_end: Optional[str] = None,
    category: Optional[str] = None,
    item_id: Optional[int] = None,
    include_complete: bool = True,
    q: Optional[str] = None,
    status: Optional[str] = None,
    waiting: Optional[bool] = None,
    someday: Optional[bool] = None,
    deferred: Optional[bool] = None,
    from_meeting: Optional[bool] = None,
    today: Optional[date] = None,
    sort: Optional[str] = None,
    order: str = "asc",
) -> list[TaskResponse]:
    """Return tasks matching ALL provided filters (AND logic across filter types).

    Within tags: OR. Within priorities: OR. Date range: inclusive both ends.
    Tasks on archived items are excluded; Inbox tasks are included unless
    category filter explicitly excludes them.

    Extra filters (all AND): `q` searches title, description and notes; `status` (open, completed,
    all) replaces `include_complete`; `waiting`, `someday`, `deferred` and `from_meeting` are
    tri-state (True = only those, False = leave those out, None = don't care); "deferred" means
    not started yet (defer_until after `today`, the client's local date). `sort` (due, priority,
    project, created, updated) with `order` reorders the result; without it the legacy order stays.
    """
    if status is not None and status not in VALID_STATUS:
        raise ValidationError(f"Unknown status: {status!r}", detail=f"Valid values: {sorted(VALID_STATUS)}")
    if sort is not None and sort not in VALID_SORTS:
        raise ValidationError(f"Unknown sort: {sort!r}", detail=f"Valid values: {sorted(VALID_SORTS)}")
    if order not in VALID_ORDERS:
        raise ValidationError(f"Unknown order: {order!r}", detail=f"Valid values: {sorted(VALID_ORDERS)}")
    if deferred is not None and today is None:
        raise ValidationError("today is required with the deferred filter", detail="today=YYYY-MM-DD")

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

    if status == "open" or (status is None and not include_complete):
        stmt = stmt.where(Task.is_complete == 0)
    elif status == "completed":
        stmt = stmt.where(Task.is_complete == 1)

    if q and q.strip():
        pattern = f"%{_escape_like(q.strip())}%"
        stmt = stmt.where(or_(
            Task.title.ilike(pattern, escape="\\"),
            Task.description.ilike(pattern, escape="\\"),
            Task.notes.ilike(pattern, escape="\\"),
        ))
    if waiting is not None:
        stmt = stmt.where(Task.waiting_for.isnot(None) if waiting else Task.waiting_for.is_(None))
    if someday is not None:
        stmt = stmt.where(Task.is_someday == (1 if someday else 0))
    if deferred is not None:
        not_started = and_(Task.defer_until.isnot(None), Task.defer_until > today)
        stmt = stmt.where(not_started if deferred else ~not_started)
    if from_meeting is not None:
        stmt = stmt.where(Task.meeting_id.isnot(None) if from_meeting else Task.meeting_id.is_(None))

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
    tasks = list(session.execute(stmt).scalars().unique().all())
    if sort is not None:
        tasks = _sort_tasks(tasks, sort, order)
    return [_task_to_response(session, t) for t in tasks]
