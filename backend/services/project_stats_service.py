"""Per-project numbers for the Projects list, computed with one grouped query per aggregate."""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Iterable

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.models.item import Item, Meeting, ResourceLink, Task
from backend.schemas.item import NextTask, ProjectStats


def _utc(value: datetime | None) -> datetime | None:
    if value is None or value.tzinfo is not None:
        return value
    return value.replace(tzinfo=timezone.utc)


def get_project_stats(
    session: Session, projects: Iterable[Item], today: date, now: datetime | None = None
) -> dict[int, ProjectStats]:
    """Stats for the given projects, keyed by id. `today` is the client's local date."""
    by_id = {p.id: p for p in projects}
    if not by_id:
        return {}
    ids = list(by_id)
    now = now or datetime.now(timezone.utc)

    # Open tasks (Someday ones are parked, so they don't count): total, overdue, waiting
    open_rows = session.execute(
        select(
            Task.item_id,
            func.count(),
            func.sum(func.iif(Task.due_date < today, 1, 0)),
            func.sum(func.iif(Task.waiting_for.isnot(None), 1, 0)),
        )
        .where(Task.item_id.in_(ids), Task.is_complete == 0, Task.is_someday == 0)
        .group_by(Task.item_id)
    ).all()
    open_counts = {r[0]: (r[1], r[2] or 0, r[3] or 0) for r in open_rows}

    # Next task: earliest due date, else the first by sort order; not Someday, not deferred past today
    candidates = session.execute(
        select(Task.item_id, Task.id, Task.title, Task.due_date, Task.sort_order)
        .where(
            Task.item_id.in_(ids), Task.is_complete == 0, Task.is_someday == 0,
            (Task.defer_until.is_(None)) | (Task.defer_until <= today),
        )
    ).all()
    best: dict[int, tuple] = {}
    for item_id, task_id, title, due, sort_order in candidates:
        key = (due is None, due or date.max, sort_order, task_id)
        if item_id not in best or key < best[item_id][0]:
            best[item_id] = (key, NextTask(id=task_id, title=title, due_date=due))

    # Meetings: the next one (not before now) and the last one (before now)
    next_meeting = dict(session.execute(
        select(Meeting.item_id, func.min(Meeting.held_at))
        .where(Meeting.item_id.in_(ids), Meeting.held_at >= now.replace(tzinfo=None))
        .group_by(Meeting.item_id)
    ).all())
    last_meeting = dict(session.execute(
        select(Meeting.item_id, func.max(Meeting.held_at))
        .where(Meeting.item_id.in_(ids), Meeting.held_at < now.replace(tzinfo=None))
        .group_by(Meeting.item_id)
    ).all())

    resources = dict(session.execute(
        select(ResourceLink.linked_item_id, func.count())
        .join(Item, Item.id == ResourceLink.resource_id)
        .where(ResourceLink.linked_item_id.in_(ids), Item.archived_at.is_(None))
        .group_by(ResourceLink.linked_item_id)
    ).all())

    task_activity = dict(session.execute(
        select(Task.item_id, func.max(Task.updated_at)).where(Task.item_id.in_(ids)).group_by(Task.item_id)
    ).all())
    meeting_activity = dict(session.execute(
        select(Meeting.item_id, func.max(Meeting.updated_at)).where(Meeting.item_id.in_(ids)).group_by(Meeting.item_id)
    ).all())

    stats: dict[int, ProjectStats] = {}
    for pid, project in by_id.items():
        open_n, overdue_n, waiting_n = open_counts.get(pid, (0, 0, 0))
        moments = [_utc(v) for v in (project.updated_at, task_activity.get(pid), meeting_activity.get(pid)) if v is not None]
        stats[pid] = ProjectStats(
            open_task_count=open_n,
            overdue_task_count=overdue_n,
            waiting_task_count=waiting_n,
            next_task=best[pid][1] if pid in best else None,
            next_meeting_at=_utc(next_meeting.get(pid)),
            last_meeting_at=_utc(last_meeting.get(pid)),
            linked_resource_count=resources.get(pid, 0),
            last_activity_at=max(moments),
        )
    return stats
