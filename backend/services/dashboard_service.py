"""Dashboard service: aggregated stats for the Dashboard page."""
from __future__ import annotations

from datetime import date
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.models.item import Item, Task
from backend.schemas.dashboard import (
    DashboardSchema,
    DeadlineItemSchema,
    ProjectSummarySchema,
)
from backend.services.preference_service import get_threshold


def _progress(total: int, completed: int) -> float:
    if total == 0:
        return 0.0
    return round(completed / total * 100, 1)


def get_dashboard_data(session: Session, client_today: date) -> DashboardSchema:
    """Compute all dashboard stats using the client's local date."""
    threshold = get_threshold(session)

    # --- Inbox count (open tasks with no item) ---
    inbox_count: int = session.execute(
        select(func.count()).where(Task.item_id.is_(None), Task.is_complete == 0)
    ).scalar_one()

    # --- Active projects ---
    active_projects_q = (
        select(Item)
        .where(
            Item.type == "project",
            Item.archived_at.is_(None),
            Item.project_status == "active",
        )
    )
    active_items = list(session.execute(active_projects_q).scalars().all())
    active_projects_count = len(active_items)

    # --- Active task count (open tasks in active projects) ---
    active_task_count: int = session.execute(
        select(func.count())
        .select_from(Task)
        .join(Item, Task.item_id == Item.id)
        .where(
            Item.type == "project",
            Item.archived_at.is_(None),
            Item.project_status == "active",
            Task.is_complete == 0,
        )
    ).scalar_one()

    # --- Areas ---
    areas_count: int = session.execute(
        select(func.count()).where(Item.type == "area", Item.archived_at.is_(None))
    ).scalar_one()

    area_task_count: int = session.execute(
        select(func.count())
        .select_from(Task)
        .join(Item, Task.item_id == Item.id)
        .where(Item.type == "area", Item.archived_at.is_(None), Task.is_complete == 0)
    ).scalar_one()

    # --- Resources ---
    resources_count: int = session.execute(
        select(func.count()).where(Item.type == "resource", Item.archived_at.is_(None))
    ).scalar_one()

    # --- Archives ---
    archives_count: int = session.execute(
        select(func.count()).where(Item.archived_at.isnot(None))
    ).scalar_one()

    # --- Overall progress (R14.5) ---
    overall_progress = _compute_overall_progress(session, active_items)

    # --- Upcoming deadlines (overdue + approaching) ---
    upcoming_deadlines = _get_upcoming_deadlines(session, client_today, threshold)

    # --- Active projects summary ---
    active_projects = _get_active_projects(session, active_items)

    return DashboardSchema(
        inbox_count=inbox_count,
        active_projects_count=active_projects_count,
        active_task_count=active_task_count,
        areas_count=areas_count,
        area_task_count=area_task_count,
        resources_count=resources_count,
        archives_count=archives_count,
        overall_progress=overall_progress,
        upcoming_deadlines=upcoming_deadlines,
        active_projects=active_projects,
        last_review_date=None,
    )


def _compute_overall_progress(session: Session, active_items: list[Item]) -> Optional[float]:
    """Average progress of active projects that have at least one task (R14.5)."""
    eligible: list[float] = []
    for item in active_items:
        total: int = session.execute(
            select(func.count()).where(Task.item_id == item.id)
        ).scalar_one()
        if total == 0:
            continue
        done: int = session.execute(
            select(func.count()).where(Task.item_id == item.id, Task.is_complete == 1)
        ).scalar_one()
        eligible.append(_progress(total, done))
    if not eligible:
        return None
    return round(sum(eligible) / len(eligible), 1)


def _get_upcoming_deadlines(
    session: Session,
    client_today: date,
    threshold: int,
) -> list[DeadlineItemSchema]:
    """Return overdue + approaching items sorted by urgency."""
    from datetime import timedelta

    cutoff = client_today + timedelta(days=threshold)
    items: list[DeadlineItemSchema] = []

    # Active non-archived projects with deadline
    projects = session.execute(
        select(Item).where(
            Item.type == "project",
            Item.archived_at.is_(None),
            Item.project_status == "active",
            Item.project_deadline.isnot(None),
        )
    ).scalars().all()
    for p in projects:
        dl = date.fromisoformat(str(p.project_deadline))
        if dl <= cutoff:
            items.append(DeadlineItemSchema(
                id=p.id,
                type="project",
                title=p.title,
                deadline=str(p.project_deadline),
                is_overdue=dl < client_today,
            ))

    # Incomplete tasks with due_date (in active non-archived items OR inbox)
    tasks_q = (
        select(Task)
        .where(Task.is_complete == 0, Task.due_date.isnot(None))
    )
    tasks = session.execute(tasks_q).scalars().all()
    for t in tasks:
        # Skip tasks whose parent item is archived or completed
        if t.item_id is not None:
            parent = session.get(Item, t.item_id)
            if parent is None:
                continue
            if parent.archived_at is not None:
                continue
            if parent.type == "project" and parent.project_status == "completed":
                continue
        dl = date.fromisoformat(str(t.due_date))
        if dl <= cutoff:
            items.append(DeadlineItemSchema(
                id=t.id,
                type="task",
                title=t.title,
                deadline=str(t.due_date),
                is_overdue=dl < client_today,
                item_id=t.item_id,
            ))

    # Sort: overdue first (oldest first), then approaching (soonest first)
    overdue = sorted([i for i in items if i.is_overdue], key=lambda x: x.deadline)
    approaching = sorted([i for i in items if not i.is_overdue], key=lambda x: x.deadline)
    return overdue + approaching


def _get_active_projects(
    session: Session,
    active_items: list[Item],
) -> list[ProjectSummarySchema]:
    """Build summary for each active project."""
    result: list[ProjectSummarySchema] = []
    for item in active_items:
        total: int = session.execute(
            select(func.count()).where(Task.item_id == item.id)
        ).scalar_one()
        done: int = session.execute(
            select(func.count()).where(Task.item_id == item.id, Task.is_complete == 1)
        ).scalar_one()
        result.append(ProjectSummarySchema(
            id=item.id,
            title=item.title,
            task_count=total,
            completed_task_count=done,
            progress_percentage=_progress(total, done),
            project_deadline=str(item.project_deadline) if item.project_deadline else None,
        ))
    return result
