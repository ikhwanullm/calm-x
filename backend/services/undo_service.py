"""Undo for deleted tasks and subtasks.

Before a task or subtask is deleted, a JSON snapshot is stored in undo_entries.
Restoring re-creates it (with its original id when still free). Snapshots older
than UNDO_RETENTION are pruned whenever a new one is recorded.
"""
from __future__ import annotations

import json
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from backend.exceptions import LimitExceededError, NotFoundError
from backend.models.item import Item, Meeting, Subtask, Tag, Task, TaskTag
from backend.models.undo import UndoEntry
from backend.models.utils import now_utc

UNDO_RETENTION = timedelta(hours=24)


def _iso(value: datetime | date | None) -> str | None:
    return value.isoformat() if value is not None else None


def _dt(value: str | None) -> datetime | None:
    if value is None:
        return None
    parsed = datetime.fromisoformat(value)
    return parsed.astimezone(timezone.utc).replace(tzinfo=None) if parsed.tzinfo else parsed


def _subtask_dict(s: Subtask) -> dict:
    return {
        "id": s.id, "task_id": s.task_id, "title": s.title, "is_complete": s.is_complete,
        "sort_order": s.sort_order, "created_at": _iso(s.created_at),
    }


def _record(session: Session, kind: str, entity_id: int, payload: dict) -> None:
    cutoff = now_utc() - UNDO_RETENTION
    session.execute(delete(UndoEntry).where(UndoEntry.created_at < cutoff))
    session.add(UndoEntry(kind=kind, entity_id=entity_id, payload=json.dumps(payload), created_at=now_utc()))


def _take(session: Session, kind: str, entity_id: int) -> dict:
    """Return and consume the newest snapshot, or raise NotFoundError."""
    entry = session.execute(
        select(UndoEntry)
        .where(UndoEntry.kind == kind, UndoEntry.entity_id == entity_id)
        .order_by(UndoEntry.id.desc())
    ).scalars().first()
    if entry is None or entry.created_at.replace(tzinfo=None) < now_utc() - UNDO_RETENTION:
        raise NotFoundError(f"Nothing to undo for this {kind}; the undo window has passed")
    payload = json.loads(entry.payload)
    session.delete(entry)
    return payload


def record_task_deletion(session: Session, task: Task) -> None:
    tag_names = session.execute(
        select(Tag.name).join(TaskTag, TaskTag.tag_id == Tag.id).where(TaskTag.task_id == task.id)
    ).scalars().all()
    subtasks = session.execute(select(Subtask).where(Subtask.task_id == task.id)).scalars().all()
    _record(session, "task", task.id, {
        "id": task.id, "item_id": task.item_id, "title": task.title,
        "description": task.description, "notes": task.notes,
        "due_date": _iso(task.due_date), "priority": task.priority,
        "is_complete": task.is_complete, "sort_order": task.sort_order,
        "created_at": _iso(task.created_at), "focus_date": _iso(task.focus_date),
        "waiting_for": task.waiting_for, "waiting_since": _iso(task.waiting_since),
        "defer_until": _iso(task.defer_until), "is_someday": task.is_someday,
        "meeting_id": task.meeting_id,
        "tags": list(tag_names),
        "subtasks": [_subtask_dict(s) for s in subtasks],
    })


def record_subtask_deletion(session: Session, subtask: Subtask) -> None:
    _record(session, "subtask", subtask.id, _subtask_dict(subtask))


def restore_task(session: Session, task_id: int):
    """Re-create a deleted task with its subtasks and tags.

    If its Project/Area is gone, archived or no longer accepts tasks, the task
    comes back in the Inbox instead.
    """
    from backend.services.task_service import (
        MAX_TASKS_PER_ITEM, MAX_TASKS_ERROR, _count_item_tasks, _set_task_tags, _task_to_response,
    )

    snap = _take(session, "task", task_id)
    item_id = snap["item_id"]
    if item_id is not None:
        item = session.get(Item, item_id)
        if item is None or item.archived_at is not None or item.type == "resource":
            item_id = None
        elif _count_item_tasks(session, item_id) >= MAX_TASKS_PER_ITEM:
            raise LimitExceededError(MAX_TASKS_ERROR)

    now = now_utc()
    task = Task(
        item_id=item_id, title=snap["title"], description=snap["description"], notes=snap["notes"],
        due_date=date.fromisoformat(snap["due_date"]) if snap["due_date"] else None,
        priority=snap["priority"], is_complete=snap["is_complete"], sort_order=snap["sort_order"],
        created_at=_dt(snap["created_at"]) or now, updated_at=now,
        focus_date=date.fromisoformat(snap["focus_date"]) if snap["focus_date"] else None,
        waiting_for=snap["waiting_for"], waiting_since=_dt(snap["waiting_since"]),
        # .get: snapshots recorded before migration 007 lack these keys
        defer_until=date.fromisoformat(snap["defer_until"]) if snap.get("defer_until") else None,
        is_someday=int(snap.get("is_someday") or 0),
        # the meeting may have been deleted since; old snapshots lack the key
        meeting_id=snap.get("meeting_id") if snap.get("meeting_id") and session.get(Meeting, snap["meeting_id"]) else None,
    )
    if session.get(Task, snap["id"]) is None:
        task.id = snap["id"]
    session.add(task)
    session.flush()

    for s in snap["subtasks"]:
        subtask = Subtask(
            task_id=task.id, title=s["title"], is_complete=s["is_complete"], sort_order=s["sort_order"],
            created_at=_dt(s["created_at"]) or now, updated_at=now,
        )
        if session.get(Subtask, s["id"]) is None:
            subtask.id = s["id"]
        session.add(subtask)
    if snap["tags"]:
        _set_task_tags(session, task, snap["tags"])
    if item_id is not None:
        session.get(Item, item_id).updated_at = now
    session.flush()
    return _task_to_response(session, task)


def restore_subtask(session: Session, subtask_id: int):
    """Re-create a deleted subtask on its task and re-evaluate the task's status."""
    from backend.services.subtask_service import _get_parent_item, _reevaluate_task_status
    from backend.schemas.task import SubtaskResponse
    from backend.services.guards import guard_task_item_not_archived

    snap = _take(session, "subtask", subtask_id)
    task = session.get(Task, snap["task_id"])
    if task is None:
        raise NotFoundError("The subtask's task no longer exists")
    guard_task_item_not_archived(_get_parent_item(session, task))

    now = now_utc()
    subtask = Subtask(
        task_id=task.id, title=snap["title"], is_complete=snap["is_complete"],
        sort_order=snap["sort_order"], created_at=_dt(snap["created_at"]) or now, updated_at=now,
    )
    if session.get(Subtask, snap["id"]) is None:
        subtask.id = snap["id"]
    session.add(subtask)
    session.flush()
    _reevaluate_task_status(session, task)
    return SubtaskResponse.model_validate(subtask)


def record_meeting_deletion(session: Session, meeting: Meeting, linked_task_ids: list[int]) -> None:
    """Snapshot a meeting and the tasks that were created from it (to re-link on restore)."""
    _record(session, "meeting", meeting.id, {
        "id": meeting.id, "item_id": meeting.item_id, "title": meeting.title,
        "held_at": _iso(meeting.held_at), "attendees": meeting.attendees, "body": meeting.body,
        "processed_at": _iso(meeting.processed_at), "created_at": _iso(meeting.created_at),
        "linked_task_ids": linked_task_ids,
    })


def restore_meeting(session: Session, meeting_id: int):
    """Re-create a deleted meeting and re-link the tasks that still exist and are unlinked.

    Unlike a task, a meeting can't fall back to the Inbox: if its Project/Area is gone or archived
    the restore is refused (and the snapshot kept, so it can be retried after un-archiving).
    """
    from backend.exceptions import ArchivedItemError
    from backend.services.meeting_service import to_response

    entry = session.execute(
        select(UndoEntry).where(UndoEntry.kind == "meeting", UndoEntry.entity_id == meeting_id)
        .order_by(UndoEntry.id.desc())
    ).scalars().first()
    if entry is None or entry.created_at.replace(tzinfo=None) < now_utc() - UNDO_RETENTION:
        raise NotFoundError("Nothing to undo for this meeting; the undo window has passed")
    snap = json.loads(entry.payload)

    item = session.get(Item, snap["item_id"])
    if item is None:
        raise NotFoundError("The meeting's project or area no longer exists")
    if item.archived_at is not None:
        raise ArchivedItemError(f"'{item.title}' is archived; restore it first, then undo.", detail=f"item_id={item.id}")
    session.delete(entry)

    now = now_utc()
    meeting = Meeting(
        item_id=item.id, title=snap["title"], held_at=_dt(snap["held_at"]), attendees=snap["attendees"],
        body=snap["body"], processed_at=_dt(snap["processed_at"]),
        created_at=_dt(snap["created_at"]) or now, updated_at=now,
    )
    if session.get(Meeting, snap["id"]) is None:
        meeting.id = snap["id"]
    session.add(meeting)
    session.flush()
    for task_id in snap["linked_task_ids"]:
        task = session.get(Task, task_id)
        if task is not None and task.meeting_id is None:
            task.meeting_id = meeting.id
    item.updated_at = now
    session.flush()
    return to_response(session, meeting)
