"""Dashboard service: aggregated stats for the Dashboard page."""
from __future__ import annotations

from datetime import date
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.models.item import Item, ReferenceLink, Task
from backend.schemas.dashboard import (
    DashboardSchema,
    DeadlineItemSchema,
    ProjectSummarySchema,
)
from backend.services.preference_service import get_threshold
from backend.services.progress_service import calculate_progress


def get_dashboard_data(session: Session, client_today: date) -> DashboardSchema:
    """Compute all dashboard stats using the client's local date."""
    threshold = get_threshold(session)

    # --- Inbox count (open tasks with no item) ---
    inbox_count: int = session.execute(
        select(func.count()).where(Task.item_id.is_(None), Task.is_complete == 0)
    ).scalar_one()

    # --- Active projects ---
    active_items: list[Item] = list(session.execute(
        select(Item).where(
            Item.type == "project",
            Item.archived_at.is_(None),
            Item.project_status == "active",
        )
    ).scalars().all())
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
    # Count reference links on non-archived Resources
    reference_link_count: int = session.execute(
        select(func.count())
        .select_from(ReferenceLink)
        .join(Item, ReferenceLink.item_id == Item.id)
        .where(Item.type == "resource", Item.archived_at.is_(None))
    ).scalar_one()

    # --- Archives ---
    archives_count: int = session.execute(
        select(func.count()).where(Item.archived_at.isnot(None))
    ).scalar_one()

    # --- Overall progress + active projects (batch GROUP BY) ---
    active_projects_summary, overall_progress = _get_active_projects_and_progress(
        session, active_items
    )

    # --- Nearest deadline among active projects ---
    nearest_deadline_project = _nearest_deadline(active_items)

    # --- Upcoming deadlines (overdue + approaching) ---
    upcoming_deadlines = _get_upcoming_deadlines(session, client_today, threshold)

    return DashboardSchema(
        inbox_count=inbox_count,
        active_projects_count=active_projects_count,
        active_task_count=active_task_count,
        areas_count=areas_count,
        area_task_count=area_task_count,
        resources_count=resources_count,
        reference_link_count=reference_link_count,
        archives_count=archives_count,
        overall_progress=overall_progress,
        upcoming_deadlines=upcoming_deadlines,
        active_projects=active_projects_summary,
        nearest_deadline_project=nearest_deadline_project,
        last_review_date=None,
    )


def _get_active_projects_and_progress(
    session: Session,
    active_items: list[Item],
) -> tuple[list[ProjectSummarySchema], Optional[int]]:
    """Compute project summaries + overall_progress in 2 GROUP BY queries."""
    if not active_items:
        return [], None

    item_ids = [item.id for item in active_items]

    # Batch: total tasks per item
    total_map: dict[int, int] = dict(
        session.execute(
            select(Task.item_id, func.count().label("n"))
            .where(Task.item_id.in_(item_ids))
            .group_by(Task.item_id)
        ).all()
    )
    # Batch: completed tasks per item
    done_map: dict[int, int] = dict(
        session.execute(
            select(Task.item_id, func.count().label("n"))
            .where(Task.item_id.in_(item_ids), Task.is_complete == 1)
            .group_by(Task.item_id)
        ).all()
    )

    summaries: list[ProjectSummarySchema] = []
    eligible_progresses: list[int] = []

    for item in active_items:
        total = total_map.get(item.id, 0)
        done = done_map.get(item.id, 0)
        progress = calculate_progress(done, total)
        summaries.append(ProjectSummarySchema(
            id=item.id,
            title=item.title,
            task_count=total,
            completed_task_count=done,
            progress_percentage=progress,
            project_deadline=str(item.project_deadline) if item.project_deadline else None,
        ))
        if total > 0:
            eligible_progresses.append(progress)

    # Overall progress: average of eligible projects, rounded half-up
    overall: Optional[int] = None
    if eligible_progresses:
        avg = sum(eligible_progresses) / len(eligible_progresses)
        # Round-half-up
        overall = int(avg + 0.5)

    return summaries, overall


def _nearest_deadline(active_items: list[Item]) -> Optional[str]:
    """Return nearest upcoming project_deadline as YYYY-MM-DD or None."""
    dates = [
        str(item.project_deadline)
        for item in active_items
        if item.project_deadline is not None
    ]
    return min(dates) if dates else None


def _get_upcoming_deadlines(
    session: Session,
    client_today: date,
    threshold: int,
) -> list[DeadlineItemSchema]:
    """Return overdue + approaching items sorted by urgency."""
    from datetime import timedelta

    cutoff = client_today + timedelta(days=threshold)
    items: list[DeadlineItemSchema] = []

    # Active non-archived projects with deadline within cutoff
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

    # Incomplete tasks with due_date within cutoff
    for t in session.execute(
        select(Task).where(Task.is_complete == 0, Task.due_date.isnot(None))
    ).scalars().all():
        if t.item_id is not None:
            parent = session.get(Item, t.item_id)
            if parent is None or parent.archived_at is not None:
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

    overdue = sorted([i for i in items if i.is_overdue], key=lambda x: x.deadline)
    approaching = sorted([i for i in items if not i.is_overdue], key=lambda x: x.deadline)
    return overdue + approaching
