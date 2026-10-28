"""Service layer for Weekly Review."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.models.item import Item, Task
from backend.models.weekly_review import WeeklyReview
from backend.schemas.weekly_review import (
    ReviewAreaItem,
    ReviewProjectItem,
    ReviewResourceItem,
    ReviewTaskItem,
)
from backend.services.progress_service import calculate_progress


def get_last_review_date(session: Session) -> Optional[str]:
    """Return the date of the most recent completed review as YYYY-MM-DD, or None."""
    latest: datetime | None = session.execute(
        select(func.max(WeeklyReview.completed_at))
    ).scalar_one_or_none()
    if latest is None:
        return None
    # completed_at is stored/returned as UTC-aware datetime
    return latest.date().isoformat()


def get_last_review_days_ago(session: Session, client_today: date) -> Optional[int]:
    """Return the number of days since the last review, or None if no reviews exist."""
    last_date_str = get_last_review_date(session)
    if last_date_str is None:
        return None
    last_date = date.fromisoformat(last_date_str)
    return (client_today - last_date).days


def get_inbox_tasks(session: Session) -> list[ReviewTaskItem]:
    """Return all open inbox tasks (item_id IS NULL, is_complete = 0)."""
    tasks: list[Task] = list(session.execute(
        select(Task)
        .where(Task.item_id.is_(None), Task.is_complete == 0)
        .order_by(Task.sort_order, Task.created_at)
    ).scalars().all())

    return [
        ReviewTaskItem(
            id=t.id,
            title=t.title,
            description=t.description,
            priority=t.priority,
            created_at=t.created_at,
        )
        for t in tasks
    ]


def get_projects_for_review(
    session: Session, client_today: date
) -> list[ReviewProjectItem]:
    """Return active projects with task counts and staleness info."""
    projects: list[Item] = list(session.execute(
        select(Item).where(
            Item.type == "project",
            Item.archived_at.is_(None),
            Item.project_status == "active",
        ).order_by(Item.updated_at)
    ).scalars().all())

    if not projects:
        return []

    item_ids = [p.id for p in projects]
    total_map: dict[int, int] = dict(
        session.execute(
            select(Task.item_id, func.count().label("n"))
            .where(Task.item_id.in_(item_ids))
            .group_by(Task.item_id)
        ).all()
    )
    open_map: dict[int, int] = dict(
        session.execute(
            select(Task.item_id, func.count().label("n"))
            .where(Task.item_id.in_(item_ids), Task.is_complete == 0)
            .group_by(Task.item_id)
        ).all()
    )
    done_map: dict[int, int] = dict(
        session.execute(
            select(Task.item_id, func.count().label("n"))
            .where(Task.item_id.in_(item_ids), Task.is_complete == 1)
            .group_by(Task.item_id)
        ).all()
    )

    result = []
    for p in projects:
        total = total_map.get(p.id, 0)
        open_count = open_map.get(p.id, 0)
        done = done_map.get(p.id, 0)
        progress = calculate_progress(done, total)

        # days_since_update: compare updated_at UTC date to client's local today
        updated_date = p.updated_at.date()
        days_since_update = max(0, (client_today - updated_date).days)
        is_stale = days_since_update >= 30

        result.append(ReviewProjectItem(
            id=p.id,
            title=p.title,
            description=p.description,
            task_count=total,
            open_task_count=open_count,
            completed_task_count=done,
            progress_percentage=progress,
            project_deadline=str(p.project_deadline) if p.project_deadline else None,
            project_status=p.project_status or "active",
            days_since_update=days_since_update,
            is_stale=is_stale,
            updated_at=p.updated_at,
        ))

    return result


def get_areas_for_review(
    session: Session, client_today: date
) -> list[ReviewAreaItem]:
    """Return all active areas with open task counts and next task title."""
    areas: list[Item] = list(session.execute(
        select(Item).where(
            Item.type == "area",
            Item.archived_at.is_(None),
        ).order_by(Item.title)
    ).scalars().all())

    if not areas:
        return []

    item_ids = [a.id for a in areas]

    # Open task counts
    open_map: dict[int, int] = dict(
        session.execute(
            select(Task.item_id, func.count().label("n"))
            .where(Task.item_id.in_(item_ids), Task.is_complete == 0)
            .group_by(Task.item_id)
        ).all()
    )

    # Next task title per area (first open task by sort_order, created_at)
    all_open_tasks: list[Task] = list(session.execute(
        select(Task)
        .where(Task.item_id.in_(item_ids), Task.is_complete == 0)
        .order_by(Task.item_id, Task.sort_order, Task.created_at)
    ).scalars().all())

    next_task_map: dict[int, str] = {}
    for task in all_open_tasks:
        if task.item_id is not None and task.item_id not in next_task_map:
            next_task_map[task.item_id] = task.title

    result = []
    for a in areas:
        updated_date = a.updated_at.date()
        days_since_update = max(0, (client_today - updated_date).days)
        is_stale = days_since_update >= 30

        result.append(ReviewAreaItem(
            id=a.id,
            title=a.title,
            description=a.description,
            open_task_count=open_map.get(a.id, 0),
            next_task_title=next_task_map.get(a.id),
            days_since_update=days_since_update,
            is_stale=is_stale,
        ))

    return result


def get_resources_for_review(
    session: Session, client_today: date
) -> list[ReviewResourceItem]:
    """Return active resources sorted by least recently updated (stale first)."""
    resources: list[Item] = list(session.execute(
        select(Item).where(
            Item.type == "resource",
            Item.archived_at.is_(None),
        ).order_by(Item.updated_at)  # least recently updated first
    ).scalars().all())

    result = []
    for r in resources:
        updated_date = r.updated_at.date()
        days_since_update = max(0, (client_today - updated_date).days)
        is_stale = days_since_update >= 30

        result.append(ReviewResourceItem(
            id=r.id,
            title=r.title,
            description=r.description,
            days_since_update=days_since_update,
            is_stale=is_stale,
            updated_at=r.updated_at,
        ))

    return result


def complete_review(session: Session, notes: str) -> WeeklyReview:
    """Create a WeeklyReview record with the current UTC timestamp."""
    now = datetime.now(timezone.utc)
    review = WeeklyReview(completed_at=now, notes=notes)
    session.add(review)
    session.flush()
    session.refresh(review)
    return review


def list_reviews(session: Session, limit: int = 10) -> list[WeeklyReview]:
    """Return the most recent completed reviews, newest first."""
    return list(session.execute(
        select(WeeklyReview)
        .order_by(WeeklyReview.completed_at.desc())
        .limit(limit)
    ).scalars().all())
