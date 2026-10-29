"""Meeting notes: CRUD, action-line preview and turning action lines into tasks."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import or_, select, update
from sqlalchemy.orm import Session

from backend.exceptions import ConflictError, LimitExceededError, NotFoundError, ValidationError
from backend.models.item import Item, Meeting, Task
from backend.models.utils import now_utc
from backend.schemas.meeting import (
    ActionLine,
    ActionsResponse,
    MeetingCreate,
    MeetingResponse,
    MeetingSummary,
    MeetingUpdate,
    ProcessPayload,
    ProcessResponse,
    TextLine,
)
from backend.schemas.task import TaskCreate
from backend.services import task_service
from backend.services.guards import guard_not_archived
from backend.services.meeting_parser import ParsedMeeting, mark_converted, parse_meeting

MAX_TITLE = 200


def _utc(value: datetime | None) -> datetime | None:
    """Aware UTC for responses (values just written are naive UTC)."""
    if value is None or value.tzinfo is not None:
        return value
    return value.replace(tzinfo=timezone.utc)


def _naive_utc(value: datetime) -> datetime:
    """Naive UTC for storage; a naive input is taken to be UTC already."""
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _get_or_404(session: Session, meeting_id: int) -> Meeting:
    meeting = session.get(Meeting, meeting_id)
    if meeting is None:
        raise NotFoundError(f"Meeting {meeting_id} not found")
    return meeting


def _open_action_count(parsed: ParsedMeeting) -> int:
    return len(parsed.actions)


def _summary_fields(session: Session, m: Meeting) -> dict:
    item = session.get(Item, m.item_id)
    return dict(
        id=m.id, item_id=m.item_id, item_title=item.title, item_type=item.type,
        item_archived=item.archived_at is not None,
        title=m.title, held_at=_utc(m.held_at), attendees=m.attendees,
        processed_at=_utc(m.processed_at), updated_at=_utc(m.updated_at),
        open_action_count=_open_action_count(parse_meeting(m.body)),
    )


def to_summary(session: Session, m: Meeting) -> MeetingSummary:
    return MeetingSummary(**_summary_fields(session, m))


def to_response(session: Session, m: Meeting) -> MeetingResponse:
    return MeetingResponse(**_summary_fields(session, m), body=m.body, created_at=_utc(m.created_at))


def _guard_item_accepts_meetings(item: Item | None, item_id: int) -> Item:
    if item is None:
        raise NotFoundError(f"Item {item_id} not found")
    if item.type == "resource":
        raise ValidationError(
            "Resources cannot have meetings. Convert to Project or Area first.", detail=f"item_id={item_id}"
        )
    guard_not_archived(item)
    return item


def _guard_meeting_writable(session: Session, m: Meeting) -> Item:
    item = session.get(Item, m.item_id)
    guard_not_archived(item)
    return item


# ── CRUD ─────────────────────────────────────────────────────────────────────

def list_meetings(
    session: Session, item_id: Optional[int] = None, q: Optional[str] = None
) -> list[MeetingSummary]:
    """Meetings newest first, optionally of one item and/or matching `q` (title, attendees, notes)."""
    stmt = select(Meeting)
    if item_id is not None:
        if session.get(Item, item_id) is None:
            raise NotFoundError(f"Item {item_id} not found")
        stmt = stmt.where(Meeting.item_id == item_id)
    if q and q.strip():
        escaped = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{escaped}%"
        stmt = stmt.where(or_(
            Meeting.title.ilike(pattern, escape="\\"),
            Meeting.attendees.ilike(pattern, escape="\\"),
            Meeting.body.ilike(pattern, escape="\\"),
        ))
    stmt = stmt.order_by(Meeting.held_at.desc(), Meeting.id.desc())
    return [to_summary(session, m) for m in session.execute(stmt).scalars().all()]


def get_meeting(session: Session, meeting_id: int) -> MeetingResponse:
    return to_response(session, _get_or_404(session, meeting_id))


def create_meeting(session: Session, item_id: int, data: MeetingCreate) -> MeetingResponse:
    item = _guard_item_accepts_meetings(session.get(Item, item_id), item_id)
    now = now_utc()
    meeting = Meeting(
        item_id=item_id, title=data.title, held_at=_naive_utc(data.held_at),
        attendees=data.attendees.strip(), body=data.body, created_at=now, updated_at=now,
    )
    session.add(meeting)
    item.updated_at = now
    session.flush()
    return to_response(session, meeting)


def update_meeting(session: Session, meeting_id: int, data: MeetingUpdate) -> MeetingResponse:
    meeting = _get_or_404(session, meeting_id)
    _guard_meeting_writable(session, meeting)
    fields = data.model_dump(exclude_unset=True)
    for name in ("title", "held_at", "body"):
        if name in fields and fields[name] is None:
            raise ValidationError(f"{name} cannot be null")
    if "held_at" in fields:
        fields["held_at"] = _naive_utc(fields["held_at"])
    if fields.get("attendees") is not None:
        fields["attendees"] = fields["attendees"].strip()
    elif "attendees" in fields:
        fields["attendees"] = ""
    for name, value in fields.items():
        setattr(meeting, name, value)
    meeting.updated_at = now_utc()
    session.flush()
    return to_response(session, meeting)


def delete_meeting(session: Session, meeting_id: int) -> None:
    """Delete a meeting (an Undo snapshot is kept). Tasks made from it stay, unlinked."""
    from backend.services.undo_service import record_meeting_deletion

    meeting = _get_or_404(session, meeting_id)
    _guard_meeting_writable(session, meeting)
    linked = list(session.execute(select(Task.id).where(Task.meeting_id == meeting.id)).scalars().all())
    record_meeting_deletion(session, meeting, linked)
    session.execute(update(Task).where(Task.meeting_id == meeting.id).values(meeting_id=None))
    item = session.get(Item, meeting.item_id)
    session.delete(meeting)
    item.updated_at = now_utc()
    session.flush()


# ── Action lines ─────────────────────────────────────────────────────────────

def get_actions(session: Session, meeting_id: int) -> ActionsResponse:
    parsed = parse_meeting(_get_or_404(session, meeting_id).body)
    return ActionsResponse(
        actions=[ActionLine(line=a.line, kind=a.kind, text=a.text, who=a.who) for a in parsed.actions],
        questions=[TextLine(line=q.line, text=q.text) for q in parsed.questions],
        decisions=[TextLine(line=d.line, text=d.text) for d in parsed.decisions],
        converted=parsed.converted,
    )


def process_meeting(session: Session, meeting_id: int, payload: ProcessPayload) -> ProcessResponse:
    """Create tasks from the chosen action lines and mark those lines as converted.

    All or nothing: the route commits only when this returns. The chosen lines are matched against
    the notes as they are now; if a line moved or changed (edited elsewhere) nothing is created.
    """
    meeting = _get_or_404(session, meeting_id)
    item = _guard_item_accepts_meetings(session.get(Item, meeting.item_id), meeting.item_id)

    open_by_line = {a.line: a for a in parse_meeting(meeting.body).actions}
    chosen = []
    seen: set[int] = set()
    for req in payload.actions:
        if req.line in seen:
            raise ValidationError(f"Line {req.line} was chosen twice")
        seen.add(req.line)
        action = open_by_line.get(req.line)
        if action is None or action.text != req.text.strip():
            raise ConflictError(
                "The meeting notes changed since the actions were listed. Reload and try again.",
                detail=f"line={req.line}",
            )
        chosen.append((action, req))

    if task_service._count_item_tasks(session, item.id) + len(chosen) > task_service.MAX_TASKS_PER_ITEM:
        raise LimitExceededError(task_service.MAX_TASKS_ERROR, detail=f"item_id={item.id}")

    now = now_utc()
    created_ids: list[int] = []
    for action, req in chosen:
        text = action.text
        too_long = len(text) > MAX_TITLE
        created = task_service.create_task(session, TaskCreate(
            title=text[: MAX_TITLE - 1].rstrip() + "…" if too_long else text,
            item_id=item.id,
            description=text[:5000] if too_long else "",
            due_date=req.due_date,
            priority=req.priority,
        ))
        task = session.get(Task, created.id)
        task.meeting_id = meeting.id
        if action.kind == "waiting":
            task.waiting_for = action.who[:200]
            task.waiting_since = now
        created_ids.append(task.id)

    meeting.body = mark_converted(meeting.body, [a for a, _ in chosen])
    meeting.processed_at = now
    meeting.updated_at = now
    item.updated_at = now
    session.flush()
    return ProcessResponse(
        created=[task_service.get_task(session, tid) for tid in created_ids],
        meeting=to_response(session, meeting),
    )
