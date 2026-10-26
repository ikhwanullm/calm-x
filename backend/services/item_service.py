"""Service layer for Items (Projects, Areas, Resources)."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.exceptions import ArchivedItemError, ConflictError, NotFoundError
from backend.models.item import Item
from backend.schemas.item import AreaCreate, ItemUpdate, ProjectCreate, ResourceCreate


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _get_or_404(session: Session, item_id: int) -> Item:
    item = session.get(Item, item_id)
    if item is None:
        raise NotFoundError(f"Item {item_id} not found")
    return item


def _guard_not_archived(item: Item) -> None:
    if item.archived_at is not None:
        raise ArchivedItemError(f"Item {item.id} is archived and cannot be modified")


def list_items(
    session: Session,
    type_filter: Optional[str] = None,
    include_archived: bool = False,
) -> list[Item]:
    """Return items, optionally filtered by type and archived status."""
    q = select(Item)
    if type_filter is not None:
        q = q.where(Item.type == type_filter)
    if not include_archived:
        q = q.where(Item.archived_at.is_(None))
    return list(session.execute(q).scalars().all())


def get_item(session: Session, item_id: int) -> Item:
    """Return a single item by id or raise NotFoundError."""
    return _get_or_404(session, item_id)


def create_item(
    session: Session,
    data: ProjectCreate | AreaCreate | ResourceCreate,
) -> Item:
    """Persist a new Project, Area, or Resource and return it."""
    now = _now_utc()
    item = Item(
        type=data.type,
        title=data.title,
        description=data.description,
        notes=data.notes,
        created_at=now,
        updated_at=now,
    )
    if data.type == "project":
        item.project_status = "active"
        item.project_goal = data.project_goal  # type: ignore[attr-defined]
        item.project_deadline = data.project_deadline  # type: ignore[attr-defined]
    elif data.type == "area":
        item.area_maintenance_notes = data.area_maintenance_notes  # type: ignore[attr-defined]

    session.add(item)
    session.flush()
    return item


def update_item(session: Session, item_id: int, data: ItemUpdate) -> Item:
    """Partially update an item. Uses exclude_unset so only provided fields change.

    Nullable fields (project_deadline, project_goal, area_maintenance_notes)
    can be explicitly set to None by including them in the request.
    Title cannot be set to None or empty.
    """
    item = _get_or_404(session, item_id)
    _guard_not_archived(item)

    # Only update fields that were explicitly provided in the request body
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    item.updated_at = _now_utc()
    session.flush()
    return item


def delete_item(session: Session, item_id: int) -> None:
    """Delete an item (and its tasks via cascade). Works for archived items too."""
    item = _get_or_404(session, item_id)
    session.delete(item)
    session.flush()


def archive_item(session: Session, item_id: int) -> Item:
    """Archive an item (sets archived_at timestamp)."""
    item = _get_or_404(session, item_id)
    _guard_not_archived(item)
    now = _now_utc()
    item.archived_at = now
    item.updated_at = now
    session.flush()
    return item


def restore_item(session: Session, item_id: int) -> Item:
    """Restore an archived item (clears archived_at). Raises ConflictError if not archived."""
    item = _get_or_404(session, item_id)
    if item.archived_at is None:
        raise ConflictError(f"Item {item_id} is not archived")
    item.archived_at = None
    item.updated_at = _now_utc()
    session.flush()
    return item


def complete_project(session: Session, item_id: int) -> Item:
    """Set project_status to 'completed'. Item must be a project."""
    item = _get_or_404(session, item_id)
    _guard_not_archived(item)
    if item.type != "project":
        raise ConflictError(f"Item {item_id} is not a project")
    now = _now_utc()
    item.project_status = "completed"
    item.project_completed_at = now
    item.updated_at = now
    session.flush()
    return item


def reopen_project(session: Session, item_id: int) -> Item:
    """Reopen a completed project (set project_status back to 'active')."""
    item = _get_or_404(session, item_id)
    _guard_not_archived(item)
    if item.type != "project":
        raise ConflictError(f"Item {item_id} is not a project")
    if item.project_status == "active":
        raise ConflictError(f"Project {item_id} is already active")
    now = _now_utc()
    item.project_status = "active"
    item.project_completed_at = None
    item.updated_at = now
    session.flush()
    return item
