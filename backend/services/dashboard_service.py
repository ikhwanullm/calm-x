"""Dashboard service: what needs attention, as opposed to Today's "what to do now"."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.models.item import Item, Task
from backend.schemas.dashboard import (
    AttentionProject,
    DashboardCounts,
    DashboardSchema,
    MeetingToProcess,
    StaleWaiting,
)
from backend.services import meeting_service, project_stats_service
from backend.services.progress_service import calculate_progress

STALE_WAITING_DAYS = 7        # a wait this long or longer is listed
MAX_STALE_WAITING = 10
STALE_PROJECT_DAYS = 30       # no activity for this long
DEADLINE_SOON_DAYS = 14       # deadline within this many days ...
LOW_PROGRESS = 50             # ... and progress below this percentage


def get_dashboard_data(
    session: Session, client_today: date, local_tz: Optional[timezone] = None
) -> DashboardSchema:
    """Compute the dashboard with the client's local date (and timezone for meetings and waits)."""
    last_review = _get_last_review_date(session)
    stale_waiting = get_waiting_tasks(session, client_today, local_tz, min_days=STALE_WAITING_DAYS)
    return DashboardSchema(
        inbox_count=session.execute(
            select(func.count()).where(Task.item_id.is_(None), Task.is_complete == 0, Task.is_someday == 0)
        ).scalar_one(),
        last_review_date=last_review,
        days_since_review=(client_today - date.fromisoformat(last_review)).days if last_review else None,
        meetings_to_process=[
            MeetingToProcess(
                id=m.id, title=m.title, held_at=m.held_at, item_id=m.item_id, item_title=m.item_title,
                item_type=m.item_type, open_action_count=m.open_action_count,
            )
            for m in meeting_service.get_review_meetings(session, client_today, local_tz)
        ],
        stale_waiting=stale_waiting[:MAX_STALE_WAITING],
        stale_waiting_total=len(stale_waiting),
        attention_projects=_get_attention_projects(session, client_today),
        counts=_get_counts(session),
    )


def _get_counts(session: Session) -> DashboardCounts:
    def count_items(item_type: str) -> int:
        return session.execute(
            select(func.count()).where(Item.type == item_type, Item.archived_at.is_(None))
        ).scalar_one()

    active_projects: int = session.execute(
        select(func.count()).where(
            Item.type == "project", Item.archived_at.is_(None), Item.project_status == "active"
        )
    ).scalar_one()
    someday: int = session.execute(
        select(func.count())
        .select_from(Task)
        .outerjoin(Item, Task.item_id == Item.id)
        .where(Task.is_someday == 1, Task.is_complete == 0, (Task.item_id.is_(None)) | (Item.archived_at.is_(None)))
    ).scalar_one()
    return DashboardCounts(
        active_projects=active_projects,
        areas=count_items("area"),
        resources=count_items("resource"),
        archived=session.execute(select(func.count()).where(Item.archived_at.isnot(None))).scalar_one(),
        someday=someday,
    )


def get_waiting_tasks(
    session: Session, client_today: date, local_tz: Optional[timezone] = None, min_days: int = 0
) -> list[StaleWaiting]:
    """Open waiting-for tasks that have waited at least `min_days`, longest first.

    The wait counts from `waiting_since`: when the wait began or the last follow-up. Someday tasks,
    and tasks of archived items or completed projects are left out. A wait with no recorded start counts as 0 days."""
    rows = session.execute(
        select(Task, Item)
        .outerjoin(Item, Task.item_id == Item.id)
        .where(
            Task.is_complete == 0, Task.is_someday == 0,
            Task.waiting_for.isnot(None),
            (Task.item_id.is_(None)) | (Item.archived_at.is_(None)),
        )
    ).all()
    tz = local_tz or timezone.utc
    found: list[StaleWaiting] = []
    for task, item in rows:
        if item is not None and item.type == "project" and item.project_status == "completed":
            continue
        since = task.waiting_since
        if since is None:
            days = 0  # start unknown (old data): listed only when every wait is wanted (min_days 0)
        else:
            if since.tzinfo is None:
                since = since.replace(tzinfo=timezone.utc)
            days = max(0, (client_today - since.astimezone(tz).date()).days)  # never negative (clock or timezone skew)
        if days >= min_days:
            found.append(StaleWaiting(
                id=task.id, title=task.title, waiting_for=task.waiting_for, waiting_days=days,
                due_date=str(task.due_date) if task.due_date else None,
                item_id=task.item_id, item_title=item.title if item else None, item_type=item.type if item else None,
            ))
    return sorted(found, key=lambda w: (-w.waiting_days, w.id))


def _get_attention_projects(session: Session, client_today: date) -> list[AttentionProject]:
    """Active projects with something wrong: overdue tasks, a passed or close deadline with little done,
    no activity for 30 days, or nothing left to do. Most problems first."""
    projects = list(session.execute(
        select(Item).where(Item.type == "project", Item.archived_at.is_(None), Item.project_status == "active")
    ).scalars().all())
    if not projects:
        return []
    ids = [p.id for p in projects]
    stats = project_stats_service.get_project_stats(session, projects, client_today)
    totals = dict(session.execute(
        select(Task.item_id, func.count()).where(Task.item_id.in_(ids)).group_by(Task.item_id)
    ).all())
    done = dict(session.execute(
        select(Task.item_id, func.count()).where(Task.item_id.in_(ids), Task.is_complete == 1).group_by(Task.item_id)
    ).all())

    soon_cutoff = client_today + timedelta(days=DEADLINE_SOON_DAYS)
    found: list[AttentionProject] = []
    for p in projects:
        s = stats[p.id]
        progress = calculate_progress(done.get(p.id, 0), totals.get(p.id, 0))
        days_inactive = (client_today - _utc_date(s.last_activity_at)).days
        reasons: list[str] = []
        if s.overdue_task_count > 0:
            reasons.append("overdue_tasks")
        if p.project_deadline is not None:
            if p.project_deadline < client_today:
                reasons.append("deadline_passed")
            elif p.project_deadline <= soon_cutoff and progress < LOW_PROGRESS:
                reasons.append("deadline_soon")
        if days_inactive >= STALE_PROJECT_DAYS:
            reasons.append("stale")
        if s.open_task_count == 0:
            reasons.append("no_open_tasks")
        if reasons:
            found.append(AttentionProject(
                id=p.id, title=p.title, reasons=reasons, overdue_task_count=s.overdue_task_count,
                open_task_count=s.open_task_count, progress_percentage=progress,
                project_deadline=str(p.project_deadline) if p.project_deadline else None,
                days_inactive=days_inactive,
            ))
    return sorted(found, key=lambda a: (-len(a.reasons), -a.overdue_task_count, a.title.lower(), a.id))


def _utc_date(moment: datetime) -> date:
    """The calendar date of an activity moment (UTC) — close enough for "days without activity"."""
    return moment.astimezone(timezone.utc).date()


def _get_last_review_date(session: Session) -> Optional[str]:
    """Return the most recent review date as YYYY-MM-DD, or None."""
    from backend.models.weekly_review import WeeklyReview
    latest = session.execute(select(func.max(WeeklyReview.completed_at))).scalar_one_or_none()
    return latest.date().isoformat() if latest is not None else None
