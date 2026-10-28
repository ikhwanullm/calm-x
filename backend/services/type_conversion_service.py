"""Type conversion service: convert an Item between Project, Area, and Resource."""
from __future__ import annotations

from datetime import date
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.exceptions import (
    ArchivedItemError,
    ConflictError,
    NotFoundError,
    ValidationError,
)
from backend.models.item import Item, ResourceLink, Task
from backend.models.utils import now_utc
from backend.schemas.link import TypeConversionPayload, TypeConversionPreview
from backend.schemas.item import item_to_response


def get_conversion_preview(
    session: Session, item_id: int, target_type: str
) -> TypeConversionPreview:
    """Return a preview of what will happen if the item is converted."""
    item = _get_and_validate(session, item_id, target_type)
    tasks = session.execute(
        select(Task).where(Task.item_id == item_id)
    ).scalars().all()
    open_count = sum(1 for t in tasks if not t.is_complete)
    rl_count = session.execute(
        select(ResourceLink).where(ResourceLink.resource_id == item_id)
    ).scalars().all().__len__() if item.type == "resource" else 0
    # Also count inbound resource links if converting TO resource
    if target_type == "resource":
        rl_as_linked = session.execute(
            select(ResourceLink).where(ResourceLink.linked_item_id == item_id)
        ).scalars().all()
        rl_count += len(rl_as_linked)
    area_project_count = len(session.execute(
        select(Item.id).where(Item.area_id == item_id)
    ).all()) if item.type == "area" else 0
    return TypeConversionPreview(
        current_type=item.type,
        target_type=target_type,
        task_count=len(tasks),
        open_task_count=open_count,
        resource_link_count=rl_count,
        area_project_count=area_project_count,
        leaves_area=item.type == "project" and item.area_id is not None,
    )


def convert_item(
    session: Session, item_id: int, payload: TypeConversionPayload
) -> object:
    """Convert an item to a new type. Returns the updated item response."""
    target_type = payload.target_type
    item = _get_and_validate(session, item_id, target_type)

    now = now_utc()

    # Delete resource_links FROM this item if it was a Resource (R2.7)
    if item.type == "resource":
        for rl in list(session.execute(
            select(ResourceLink).where(ResourceLink.resource_id == item_id)
        ).scalars().all()):
            session.delete(rl)

    # Delete resource_links TO this item if converting TO Resource (R2.8)
    if target_type == "resource":
        for rl in list(session.execute(
            select(ResourceLink).where(ResourceLink.linked_item_id == item_id)
        ).scalars().all()):
            session.delete(rl)
        # Move ALL tasks (open + completed) to Inbox
        for task in session.execute(
            select(Task).where(Task.item_id == item_id)
        ).scalars().all():
            task.item_id = None
            task.updated_at = now

    # Area membership only exists between a Project and an Area
    if item.type == "project":
        item.area_id = None
    if item.type == "area":
        for project in session.execute(
            select(Item).where(Item.area_id == item_id)
        ).scalars().all():
            project.area_id = None
            project.updated_at = now

    # Apply type-specific field changes
    item.type = target_type

    if target_type == "project":
        # Restore project_status if it was preserved; default to 'active' if never set
        item.project_status = item.project_status or "active"
        if payload.project_goal is not None:
            item.project_goal = payload.project_goal
        if payload.project_deadline is not None:
            item.project_deadline = payload.project_deadline

    elif target_type == "area":
        if payload.area_maintenance_notes is not None:
            item.area_maintenance_notes = payload.area_maintenance_notes
        # R2.1: project_status and project_completed_at are PRESERVED (hidden, not cleared)
        # so they can be restored if the item is later converted back to Project.
        pass

    elif target_type == "resource":
        # R2.1: project_status and project_completed_at are PRESERVED (hidden, not cleared)
        pass  # tasks already moved to inbox above; no other field changes

    item.updated_at = now
    session.flush()

    # Return updated response via item_to_response
    from backend.services.item_service import _get_task_counts
    total, completed = _get_task_counts(session, item_id)
    return item_to_response(item, task_count=total, completed_task_count=completed)


def _get_and_validate(session: Session, item_id: int, target_type: str) -> Item:
    """Fetch item and validate preconditions for conversion."""
    valid_types = {"project", "area", "resource"}
    if target_type not in valid_types:
        raise ValidationError(
            f"Invalid target_type {target_type!r}. Must be one of {sorted(valid_types)}."
        )

    item = session.get(Item, item_id)
    if item is None:
        raise NotFoundError(f"Item {item_id} not found")
    if item.archived_at is not None:
        raise ArchivedItemError(
            f"Item {item_id} is archived and cannot be converted."
        )
    if item.type == target_type:
        raise ConflictError(
            f"Item {item_id} is already type {target_type!r}."
        )
    return item
