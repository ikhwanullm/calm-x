"""Task management service."""
from __future__ import annotations

from datetime import date
from typing import Optional, Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.exceptions import ArchivedItemError, LimitExceededError, NotFoundError, ValidationError
from backend.models.item import Item, Meeting, Subtask, Tag, Task, TaskTag
from backend.models.utils import now_utc
from backend.schemas.task import TaskCreate, TaskResponse, TaskUpdate, TodayResponse
from backend.services.guards import guard_not_archived, guard_task_item_not_archived
from backend.services.timestamp_service import on_task_move, update_task_timestamp

MAX_TASKS_PER_ITEM = 100
MAX_TASKS_ERROR = "This item has reached the maximum of 100 tasks."


def _guard_not_resource(item: Item | None) -> None:
    """Raise ValidationError if item is a Resource (R3.7)."""
    if item is not None and item.type == "resource":
        raise ValidationError(
            "Resources cannot have tasks. Convert to Project or Area first.",
            detail=f"item_id={item.id}",
        )


def _tasks_to_responses(session: Session, tasks: Sequence[Task]) -> list[TaskResponse]:
    """Convert Task ORM objects to TaskResponses, in the same order.

    Always four queries or fewer, however many tasks there are: one grouped query for the subtask counts,
    one for the tags, one for the meetings and one for the Items. Lists of tasks must go through here;
    calling it per task brings back the one-query-per-task cost.
    """
    if not tasks:
        return []
    task_ids = [t.id for t in tasks]

    subtask_counts = {
        task_id: (total, done or 0)
        for task_id, total, done in session.execute(
            select(Subtask.task_id, func.count(), func.sum(Subtask.is_complete))
            .where(Subtask.task_id.in_(task_ids))
            .group_by(Subtask.task_id)
        ).all()
    }

    # Tag names come straight from SQL, not from task.tags, to avoid a stale identity map after a flush
    tags_by_task: dict[int, list[str]] = {}
    for task_id, name in session.execute(
        select(TaskTag.task_id, Tag.name)
        .join(Tag, TaskTag.tag_id == Tag.id)
        .where(TaskTag.task_id.in_(task_ids))
        .order_by(Tag.name)
    ).all():
        tags_by_task.setdefault(task_id, []).append(name)

    meeting_ids = {t.meeting_id for t in tasks if t.meeting_id is not None}
    meetings = {
        m_id: (title, held_at)
        for m_id, title, held_at in session.execute(
            select(Meeting.id, Meeting.title, Meeting.held_at).where(Meeting.id.in_(meeting_ids))
        ).all()
    } if meeting_ids else {}

    item_ids = {t.item_id for t in tasks if t.item_id is not None}
    items = {
        i_id: (title, item_type)
        for i_id, title, item_type in session.execute(
            select(Item.id, Item.title, Item.type).where(Item.id.in_(item_ids))
        ).all()
    } if item_ids else {}

    responses = []
    for task in tasks:
        total_subs, done_subs = subtask_counts.get(task.id, (0, 0))
        meeting = meetings.get(task.meeting_id)
        item = items.get(task.item_id)
        responses.append(TaskResponse(
            id=task.id,
            item_id=task.item_id,
            title=task.title,
            description=task.description,
            notes=task.notes,
            due_date=task.due_date,
            priority=task.priority,
            is_complete=bool(task.is_complete),
            sort_order=task.sort_order,
            created_at=task.created_at,
            updated_at=task.updated_at,
            subtask_count=total_subs,
            completed_subtask_count=done_subs,
            tags=tags_by_task.get(task.id, []),
            focus_date=task.focus_date,
            waiting_for=task.waiting_for,
            waiting_since=task.waiting_since,
            completed_at=task.completed_at,
            defer_until=task.defer_until,
            is_someday=bool(task.is_someday),
            item_title=item[0] if item is not None else None,
            item_type=item[1] if item is not None else None,
            meeting_id=task.meeting_id,
            meeting_title=meeting[0] if meeting is not None else None,
            meeting_held_at=meeting[1] if meeting is not None else None,
        ))
    return responses


def _task_to_response(session: Session, task: Task) -> TaskResponse:
    """Convert one Task ORM object to a TaskResponse (with subtask counts and tags)."""
    return _tasks_to_responses(session, [task])[0]


def _count_item_tasks(session: Session, item_id: Optional[int]) -> int:
    """Count tasks on a given item (or Inbox if item_id=None)."""
    return session.execute(
        select(func.count()).where(Task.item_id == item_id)
    ).scalar_one()


def get_task(session: Session, task_id: int) -> TaskResponse:
    task = session.get(Task, task_id)
    if task is None:
        raise NotFoundError(f"Task {task_id} not found")
    return _task_to_response(session, task)


def list_tasks(
    session: Session,
    item_id: Optional[int],
    include_complete: bool = True,
) -> list[TaskResponse]:
    """List tasks for an item (or Inbox if item_id=None)."""
    stmt = select(Task).where(Task.item_id == item_id)
    if not include_complete:
        stmt = stmt.where(Task.is_complete == 0)
    stmt = stmt.order_by(Task.sort_order, Task.id)
    tasks = session.execute(stmt).scalars().all()
    return _tasks_to_responses(session, tasks)


def get_inbox_tasks(session: Session) -> list[TaskResponse]:
    """Inbox tasks, without the ones parked as Someday."""
    return [t for t in list_tasks(session, item_id=None) if not t.is_someday]




def _set_task_tags(session: Session, task: Task, tag_names: list[str]) -> None:
    """Replace all tags on task with tag_names (creates missing tags on the fly)."""
    for tt in list(task.task_tags):
        session.delete(tt)
    session.flush()
    for raw_name in tag_names:
        name = raw_name.strip().lower()
        if not name:
            continue
        tag = session.execute(
            select(Tag).where(func.lower(Tag.name) == name)
        ).scalar_one_or_none()
        if tag is None:
            tag = Tag(name=name, created_at=now_utc())
            session.add(tag)
            session.flush()
        existing = session.execute(
            select(TaskTag).where(TaskTag.task_id == task.id, TaskTag.tag_id == tag.id)
        ).scalar_one_or_none()
        if existing is None:
            session.add(TaskTag(task_id=task.id, tag_id=tag.id))
    session.flush()


def create_task(session: Session, data: TaskCreate) -> TaskResponse:
    """Create a task. Enforces 100-task limit and archived guard."""
    # Guard: parent item not archived
    parent_item = session.get(Item, data.item_id) if data.item_id is not None else None
    guard_task_item_not_archived(parent_item)
    _guard_not_resource(parent_item)

    # Enforce 100-task limit only on Project/Area items, not Inbox
    if data.item_id is not None:
        count = _count_item_tasks(session, data.item_id)
        if count >= MAX_TASKS_PER_ITEM:
            raise LimitExceededError(MAX_TASKS_ERROR, detail=f"item_id={data.item_id}")
        sort_order = count
    else:
        sort_order = _count_item_tasks(session, None)

    now = now_utc()
    task = Task(
        item_id=data.item_id,
        title=data.title,
        description=data.description,
        notes=data.notes,
        due_date=data.due_date,
        priority=data.priority,
        is_complete=0,
        sort_order=sort_order,
        created_at=now,
        updated_at=now,
    )
    session.add(task)
    session.flush()
    # Assign tags if provided
    if getattr(data, "tag_names", None):
        _set_task_tags(session, task, data.tag_names)
    # Propagate timestamp to parent item
    if data.item_id is not None:
        item = session.get(Item, data.item_id)
        if item is not None:
            item.updated_at = now
    return _task_to_response(session, task)


def follow_up(session: Session, task_id: int) -> TaskResponse:
    """Record a follow-up on a waiting task: the wait counts from now on (`waiting_since` becomes now)."""
    task = session.get(Task, task_id)
    if task is None:
        raise NotFoundError(f"Task {task_id} not found")
    guard_task_item_not_archived(session.get(Item, task.item_id) if task.item_id else None)
    if task.waiting_for is None:
        raise ValidationError("Only a task that is waiting for someone can be followed up.", detail=f"task_id={task_id}")
    now = now_utc()
    task.waiting_since = now
    task.updated_at = now
    session.flush()
    return _task_to_response(session, task)


def update_task(session: Session, task_id: int, data: TaskUpdate) -> TaskResponse:
    """Partially update a task. Raises ArchivedItemError if parent item is archived."""
    task = session.get(Task, task_id)
    if task is None:
        raise NotFoundError(f"Task {task_id} not found")
    parent = session.get(Item, task.item_id) if task.item_id else None
    guard_task_item_not_archived(parent)

    update_fields = data.model_dump(exclude_unset=True)
    # Prevent changing is_complete via update_task (use mark_complete/mark_incomplete)
    update_fields.pop("is_complete", None)
    update_fields.pop("item_id", None)
    tag_names = update_fields.pop("tag_names", None)
    if update_fields.get("is_someday", True) is None:
        update_fields.pop("is_someday")
    elif "is_someday" in update_fields:
        update_fields["is_someday"] = int(update_fields["is_someday"])
    new_due = update_fields.get("due_date", task.due_date)
    new_defer = update_fields.get("defer_until", task.defer_until)
    if new_due is not None and new_defer is not None and new_due < new_defer:
        raise ValidationError(
            "Due date cannot be before the defer date.",
            detail=f"due_date={new_due}, defer_until={new_defer}",
        )
    if "waiting_for" in update_fields:
        new_waiting = update_fields["waiting_for"]
        if new_waiting is None:
            task.waiting_since = None
        elif new_waiting != task.waiting_for:
            task.waiting_since = now_utc()
    for field, value in update_fields.items():
        setattr(task, field, value)
    task.updated_at = now_utc()
    if tag_names is not None:
        _set_task_tags(session, task, tag_names)
    if task.item_id is not None:
        item = session.get(Item, task.item_id)
        if item is not None:
            item.updated_at = now_utc()
    session.flush()
    return _task_to_response(session, task)


def delete_task(session: Session, task_id: int) -> None:
    """Delete a task. Requires archived guard (unlike delete_item which bypasses it)."""
    task = session.get(Task, task_id)
    if task is None:
        raise NotFoundError(f"Task {task_id} not found")
    parent = session.get(Item, task.item_id) if task.item_id else None
    guard_task_item_not_archived(parent)
    item_id = task.item_id
    from backend.services.undo_service import record_task_deletion
    record_task_deletion(session, task)
    session.delete(task)
    session.flush()
    # Update parent item timestamp
    if item_id is not None:
        item = session.get(Item, item_id)
        if item is not None:
            item.updated_at = now_utc()


def move_task(session: Session, task_id: int, target_item_id: Optional[int]) -> TaskResponse:
    """Move task to a different item (or Inbox). Enforces limit and archived guards."""
    task = session.get(Task, task_id)
    if task is None:
        raise NotFoundError(f"Task {task_id} not found")

    # Guard: source item not archived
    old_item = session.get(Item, task.item_id) if task.item_id else None
    guard_task_item_not_archived(old_item)

    # Guard: target item not archived
    if target_item_id is not None:
        target_item = session.get(Item, target_item_id)
        if target_item is None:
            raise NotFoundError(f"Item {target_item_id} not found")
        if target_item.archived_at is not None:
            raise ArchivedItemError(
                f"Cannot move task to archived item '{target_item.title}'",
                detail=f"item_id={target_item_id}",
            )
        _guard_not_resource(target_item)
        # Enforce 100-task limit on target (excluding the task being moved if same item)
        count = _count_item_tasks(session, target_item_id)
        if task.item_id != target_item_id and count >= MAX_TASKS_PER_ITEM:
            raise LimitExceededError(MAX_TASKS_ERROR, detail=f"target_item_id={target_item_id}")

    old_item_id = task.item_id
    task.item_id = target_item_id
    on_task_move(session, task, old_item_id, target_item_id)
    session.flush()
    return _task_to_response(session, task)


def mark_complete(session: Session, task_id: int) -> TaskResponse:
    """Mark a task complete. Auto-completes ALL subtasks (R8.8)."""
    task = session.get(Task, task_id)
    if task is None:
        raise NotFoundError(f"Task {task_id} not found")
    parent = session.get(Item, task.item_id) if task.item_id else None
    guard_task_item_not_archived(parent)

    now = now_utc()
    if not task.is_complete:
        from backend.services.undo_service import record_task_completion

        # Completing a task completes every subtask; remember which ones were open so Undo can put them back
        open_subtasks = [s.id for s in task.subtasks if not s.is_complete]
        # Completing a task that is already complete changes nothing: it keeps its first date (or none, for
        # a task completed before the date was recorded)
        task.completed_at = now
        record_task_completion(session, task, open_subtasks)
    task.is_complete = 1
    # Auto-complete all subtasks
    for subtask in task.subtasks:
        subtask.is_complete = 1
        subtask.updated_at = now
    task.updated_at = now
    if task.item_id is not None:
        item = session.get(Item, task.item_id)
        if item is not None:
            item.updated_at = now
    session.flush()
    return _task_to_response(session, task)


def mark_incomplete(session: Session, task_id: int) -> TaskResponse:
    """Mark a task incomplete. Auto-marks ALL subtasks incomplete (R8.9)."""
    task = session.get(Task, task_id)
    if task is None:
        raise NotFoundError(f"Task {task_id} not found")
    parent = session.get(Item, task.item_id) if task.item_id else None
    guard_task_item_not_archived(parent)

    task.is_complete = 0
    task.completed_at = None
    now = now_utc()
    for subtask in task.subtasks:
        subtask.is_complete = 0
        subtask.updated_at = now
    task.updated_at = now
    if task.item_id is not None:
        item = session.get(Item, task.item_id)
        if item is not None:
            item.updated_at = now
    session.flush()
    return _task_to_response(session, task)


def reorder_tasks(session: Session, item_id: Optional[int], task_ids: list[int]) -> list[TaskResponse]:
    """Update sort_order for tasks in an item.

    Guards:
    - item_id must not be archived (403)
    - all task_ids must belong to item_id (400)
    """
    from backend.exceptions import ValidationError as _VE
    # Guard: item must not be archived
    if item_id is not None:
        item = session.get(Item, item_id)
        if item is None:
            raise NotFoundError(f"Item {item_id} not found")
        if item.archived_at is not None:
            raise ArchivedItemError(
                f"Cannot reorder tasks in archived item",
                detail=f"item_id={item_id}",
            )

    # Validate: all task_ids must belong to this item
    item_task_ids = {
        t.id
        for t in session.execute(
            select(Task).where(Task.item_id == item_id)
        ).scalars().all()
    }
    invalid = [tid for tid in task_ids if tid not in item_task_ids]
    if invalid:
        raise _VE(
            f"Task IDs {invalid} do not belong to item {item_id}",
            detail=f"invalid_task_ids={invalid}",
        )

    for order, tid in enumerate(task_ids):
        task = session.get(Task, tid)
        if task:
            task.sort_order = order
    session.flush()
    return list_tasks(session, item_id)


_PRIORITY_RANK = {"high": 0, "medium": 1, "low": 2}


def list_someday(session: Session) -> list[TaskResponse]:
    """Open Someday tasks outside archived Items, newest first."""
    tasks = session.execute(
        select(Task)
        .outerjoin(Item, Task.item_id == Item.id)
        .where(
            Task.is_complete == 0,
            Task.is_someday == 1,
            (Task.item_id.is_(None)) | (Item.archived_at.is_(None)),
        )
        .order_by(Task.updated_at.desc(), Task.id.desc())
    ).scalars().all()
    return _tasks_to_responses(session, tasks)


def get_today(session: Session, client_today: date) -> TodayResponse:
    """Open tasks for the Today view, using the client's local date.

    Each open task outside archived Items lands in at most one list, in this order:
    waiting (has waiting_for) > overdue (due before today) > due today > focused (on Today).
    Someday tasks and tasks deferred past today are left out entirely.
    """
    tasks = session.execute(
        select(Task)
        .outerjoin(Item, Task.item_id == Item.id)
        .where(
            Task.is_complete == 0,
            Task.is_someday == 0,
            (Task.defer_until.is_(None)) | (Task.defer_until <= client_today),
            (Task.item_id.is_(None)) | (Item.archived_at.is_(None)),
            (Task.waiting_for.isnot(None))
            | (Task.due_date <= client_today)
            | (Task.focus_date.isnot(None)),
        )
    ).scalars().all()

    waiting, overdue, due_today, focused = [], [], [], []
    for task in tasks:
        if task.waiting_for is not None:
            waiting.append(task)
        elif task.due_date is not None and task.due_date < client_today:
            overdue.append(task)
        elif task.due_date == client_today:
            due_today.append(task)
        elif task.focus_date is not None:
            focused.append(task)

    def by_priority(t: Task) -> tuple:
        return (_PRIORITY_RANK.get(t.priority, 1), t.focus_date or client_today, t.id)

    overdue.sort(key=lambda t: (t.due_date, _PRIORITY_RANK.get(t.priority, 1), t.id))
    due_today.sort(key=by_priority)
    focused.sort(key=by_priority)
    waiting.sort(key=lambda t: (t.waiting_since is None, t.waiting_since, t.id))

    # One conversion for all four lists, then cut it back into them
    groups = [overdue, due_today, focused, waiting]
    responses = iter(_tasks_to_responses(session, [t for group in groups for t in group]))
    overdue_r, due_today_r, focused_r, waiting_r = ([next(responses) for _ in group] for group in groups)

    return TodayResponse(
        overdue=overdue_r,
        due_today=due_today_r,
        focused=focused_r,
        waiting=waiting_r,
    )
