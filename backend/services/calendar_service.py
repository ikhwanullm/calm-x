"""Week view: meetings, due dates, planned tasks, project deadlines and starts for seven days."""
from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.exceptions import ValidationError
from backend.models.item import Item, Meeting, Task
from backend.schemas.calendar import CalendarDay, CalendarWeekResponse, DeadlineEntry
from backend.services import meeting_service, task_service

_PRIORITY_RANK = {"high": 0, "medium": 1, "low": 2}


def _open_task_query():
    """Open, non-Someday tasks outside archived Items (the Today rules)."""
    return (
        select(Task)
        .outerjoin(Item, Task.item_id == Item.id)
        .where(Task.is_complete == 0, Task.is_someday == 0, (Task.item_id.is_(None)) | (Item.archived_at.is_(None)))
    )


def get_week(
    session: Session, start: date, client_today: date, local_tz: Optional[timezone] = None
) -> CalendarWeekResponse:
    if start.weekday() != 0:
        raise ValidationError(f"start must be a Monday, got {start.isoformat()}")
    end = start + timedelta(days=6)
    tz = local_tz or timezone.utc
    days = [start + timedelta(days=i) for i in range(7)]

    # Meetings, bucketed by the client's local date
    lo = datetime.combine(start, time.min, tzinfo=tz).astimezone(timezone.utc).replace(tzinfo=None)
    hi = datetime.combine(end + timedelta(days=1), time.min, tzinfo=tz).astimezone(timezone.utc).replace(tzinfo=None)
    meetings_by_day: dict[date, list] = {d: [] for d in days}
    rows = session.execute(
        select(Meeting).join(Item, Item.id == Meeting.item_id)
        .where(Item.archived_at.is_(None), Meeting.held_at >= lo, Meeting.held_at < hi)
        .order_by(Meeting.held_at, Meeting.id)
    ).scalars().all()
    for m in rows:
        local_day = m.held_at.replace(tzinfo=timezone.utc).astimezone(tz).date()
        meetings_by_day[local_day].append(meeting_service.to_summary(session, m))

    def by_priority(t: Task) -> tuple:
        return (_PRIORITY_RANK.get(t.priority, 1), t.id)

    # Open tasks due in the week
    due_tasks = session.execute(
        _open_task_query().where(Task.due_date >= start, Task.due_date <= end)
    ).scalars().all()
    due_by_day: dict[date, list[Task]] = {d: [] for d in days}
    for t in due_tasks:
        due_by_day[t.due_date].append(t)
    due_ids = {t.id for t in due_tasks}

    # Planned for today: only in today's column, and not twice when the task is also due this week
    planned: list[Task] = []
    if start <= client_today <= end:
        planned = [
            t for t in session.execute(
                _open_task_query().where(
                    Task.focus_date.isnot(None),
                    (Task.defer_until.is_(None)) | (Task.defer_until <= client_today),
                )
            ).scalars().all()
            if t.id not in due_ids
        ]

    starts_by_day: dict[date, list[Task]] = {d: [] for d in days}
    for t in session.execute(
        _open_task_query().where(Task.defer_until >= start, Task.defer_until <= end)
    ).scalars().all():
        starts_by_day[t.defer_until].append(t)

    deadlines_by_day: dict[date, list[DeadlineEntry]] = {d: [] for d in days}
    for item in session.execute(
        select(Item).where(
            Item.type == "project", Item.archived_at.is_(None), Item.project_status == "active",
            Item.project_deadline >= start, Item.project_deadline <= end,
        ).order_by(Item.title, Item.id)
    ).scalars().all():
        deadlines_by_day[item.project_deadline].append(DeadlineEntry(id=item.id, title=item.title))

    def to_responses(tasks: list[Task]):
        return [task_service._task_to_response(session, t) for t in sorted(tasks, key=by_priority)]

    return CalendarWeekResponse(days=[
        CalendarDay(
            date=d,
            meetings=meetings_by_day[d],
            due=to_responses(due_by_day[d]),
            planned=to_responses(planned) if d == client_today else [],
            deadlines=deadlines_by_day[d],
            starts=to_responses(starts_by_day[d]),
        )
        for d in days
    ])
