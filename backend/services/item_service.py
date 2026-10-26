"""Service layer for Item CRUD, archive, restore, and project completion."""
from __future__ import annotations

from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.exceptions import ConflictError, NotFoundError
from backend.models.item import Item, Task
from backend.models.utils import now_utc
from backend.schemas.item import (
    AreaCreate,
    ItemResponse,
    ItemUpdate,
    ProjectCreate,
    ResourceCreate,
    item_to_response,
)
from backend.services.guards import guard_not_archived

ItemType = Literal["project", "area", "resource"]


def _get_task_counts(session: Session, item_id: int) -> tuple[int, int]:
    """Return (total_task_count, completed_task_count) for an item."""
    total = session.execute(
        select(func.count()).where(Task.item_id == item_id)
    ).scalar_one()
    completed = session.execute(
        select(func.count()).where(Task.item_id == item_id, Task.is_complete == 1)
    ).scalar_one()
    return total, completed


def _to_response(session: Session, item: Item) -> ItemResponse:
    total, completed = _get_task_counts(session, item.id)
    return item_to_response(item, task_count=total, completed_task_count=completed)


def get_item(session: Session, item_id: int) -> ItemResponse:
    """Fetch a single item by id. Raises NotFoundError if not found."""
    item = session.get(Item, item_id)
    if item is None:
        raise NotFoundError(f"Item {item_id} not found", detail=f"id={item_id}")
    return _to_response(session, item)


def list_items(
    session: Session,
    *,
    type_filter: ItemType | None = None,
    include_archived: bool = False,
) -> list[ItemResponse]:
    """List items with optional type and archive filters."""
    stmt = select(Item)
    if type_filter:
        stmt = stmt.where(Item.type == type_filter)
    if not include_archived:
        stmt = stmt.where(Item.archived_at.is_(None))
    stmt = stmt.order_by(Item.updated_at.desc())
    items = session.execute(stmt).scalars().all()
    return [_to_response(session, item) for item in items]


def create_item(
    session: Session,
    data: ProjectCreate | AreaCreate | ResourceCreate,
) -> ItemResponse:
    """Create a new item from a create schema."""
    now = now_utc()
    item = Item(
        type=data.type,
        title=data.title,
        description=data.description,
        notes=data.notes,
        created_at=now,
        updated_at=now,
    )
    if isinstance(data, ProjectCreate):
        item.project_goal = data.project_goal
        item.project_deadline = data.project_deadline
        item.project_status = "active"
    elif isinstance(data, AreaCreate):
        item.area_maintenance_notes = data.area_maintenance_notes

    session.add(item)
    session.flush()  # get the id before commit
    return _to_response(session, item)


def update_item(session: Session, item_id: int, data: ItemUpdate) -> ItemResponse:
    """Partially update an item. Raises NotFoundError, ArchivedItemError."""
    item = session.get(Item, item_id)
    if item is None:
        raise NotFoundError(f"Item {item_id} not found")
    guard_not_archived(item)

    update_data = data.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(item, field, value)
    item.updated_at = now_utc()
    session.flush()
    return _to_response(session, item)


def delete_item(session: Session, item_id: int) -> None:
    """Delete an item (and cascade-delete its tasks). No archive guard.

    Per R7.9: deletion is always allowed, even for archived items.
    """
    item = session.get(Item, item_id)
    if item is None:
        raise NotFoundError(f"Item {item_id} not found")
    session.delete(item)
    session.flush()


def archive_item(session: Session, item_id: int) -> ItemResponse:
    """Archive an item. Raises NotFoundError, ArchivedItemError (already archived)."""
    item = session.get(Item, item_id)
    if item is None:
        raise NotFoundError(f"Item {item_id} not found")
    guard_not_archived(item)  # prevent double-archiving
    item.archived_at = now_utc()
    item.updated_at = now_utc()
    session.flush()
    return _to_response(session, item)


def restore_item(session: Session, item_id: int) -> ItemResponse:
    """Restore an archived item. Raises NotFoundError, ConflictError (not archived)."""
    item = session.get(Item, item_id)
    if item is None:
        raise NotFoundError(f"Item {item_id} not found")
    if item.archived_at is None:
        raise ConflictError(f"Item {item_id} is not archived")
    item.archived_at = None
    item.updated_at = now_utc()
    session.flush()
    return _to_response(session, item)


def complete_project(session: Session, item_id: int) -> ItemResponse:
    """Mark a project as completed. Status-only — does NOT complete tasks.

    Per R4.10: completing a project changes its status; it does not close tasks.
    After calling this, the caller should prompt the user to archive (R1.6).
    """
    item = session.get(Item, item_id)
    if item is None:
        raise NotFoundError(f"Item {item_id} not found")
    guard_not_archived(item)
    if item.type != "project":
        raise ConflictError(f"Item {item_id} is not a project")
    item.project_status = "completed"
    item.project_completed_at = now_utc()
    item.updated_at = now_utc()
    session.flush()
    return _to_response(session, item)


def reopen_project(session: Session, item_id: int) -> ItemResponse:
    """Reopen a completed project (set status back to active)."""
    item = session.get(Item, item_id)
    if item is None:
        raise NotFoundError(f"Item {item_id} not found")
    guard_not_archived(item)
    if item.type != "project":
        raise ConflictError(f"Item {item_id} is not a project")
    if item.project_status != "completed":
        raise ConflictError(f"Project {item_id} is not completed")
    item.project_status = "active"
    item.project_completed_at = None
    item.updated_at = now_utc()
    session.flush()
    return _to_response(session, item)
