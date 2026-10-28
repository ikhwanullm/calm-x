"""FastAPI router for Items (Projects, Areas, Resources)."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Literal, Optional, Union

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.api.deps import get_db_session
from backend.exceptions import ValidationError
from backend.schemas.item import (
    AreaCreate,
    AreaResponse,
    ItemCreateUnion,
    ItemUpdate,
    ProjectCreate,
    ProjectResponse,
    ResourceCreate,
    ResourceResponse,
    item_to_response,
)
from backend.services import item_service

router = APIRouter(prefix="/items", tags=["items"])

SessionDep = Annotated[Session, Depends(get_db_session)]

# Union response type returned by all read/write endpoints
AnyItemResponse = Union[ProjectResponse, AreaResponse, ResourceResponse]


def _escape_like(query: str) -> str:
    """Escape SQL LIKE wildcards."""
    return query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


@router.get("", response_model=list[AnyItemResponse])
def list_items(
    session: SessionDep,
    type: Optional[Literal["project", "area", "resource"]] = Query(default=None),
    include_archived: bool = Query(default=False),
    archived: Optional[Literal["only"]] = Query(default=None, description="Set to 'only' to return only archived items"),
    q: Optional[str] = Query(default=None, max_length=200, description="Search query for title/description"),
    archived_from: Optional[datetime] = Query(default=None, description="Filter archived items from this datetime (ISO 8601 with tz offset, e.g. 2026-10-28T00:00:00+07:00)"),
    archived_to: Optional[datetime] = Query(default=None, description="Filter archived items to this datetime (ISO 8601 with tz offset, e.g. 2026-10-28T23:59:59+07:00)"),
):
    """List items. Filter by type and/or include archived.

    For archive view, use ``archived=only`` to get only archived items sorted by archive date.
    Search with ``q`` parameter searches title and description.
    Date filters ``archived_from``/``archived_to`` accept ISO 8601 datetime strings with timezone
    offset (e.g. ``2026-10-28T00:00:00+07:00``) so the server can compare correctly in UTC.
    """
    # Determine archived-only mode
    archived_only = archived == "only"

    # Validate date range filters — they only make sense with archived items
    if (archived_from or archived_to) and not archived_only and not include_archived:
        raise ValidationError(
            "archived_from and archived_to require archived=only or include_archived=true"
        )

    items_with_counts = item_service.list_items(
        session,
        type_filter=type,
        include_archived=include_archived,
        archived_only=archived_only,
        sort_by_archived=archived_only,  # Sort by archived_at desc when viewing archive
    )

    # Apply search filter if provided
    if q and q.strip():
        search_term = q.strip().lower()
        items_with_counts = [
            (item, total, completed)
            for item, total, completed in items_with_counts
            if search_term in item.title.lower() or search_term in (item.description or "").lower()
        ]

    # Apply archived datetime range filter.
    # archived_from/archived_to are timezone-aware datetimes (sent by frontend with tz offset).
    # item.archived_at is always UTC-aware (from UTCDateTime TypeDecorator).
    # Naive datetimes (no tzinfo) are treated as UTC to be safe.
    def _to_utc(dt: datetime) -> datetime:
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    if archived_from:
        from_utc = _to_utc(archived_from)
        items_with_counts = [
            (item, total, completed)
            for item, total, completed in items_with_counts
            if item.archived_at and item.archived_at >= from_utc
        ]

    if archived_to:
        to_utc = _to_utc(archived_to)
        items_with_counts = [
            (item, total, completed)
            for item, total, completed in items_with_counts
            if item.archived_at and item.archived_at <= to_utc
        ]

    return [item_to_response(item, task_count=total, completed_task_count=completed)
            for item, total, completed in items_with_counts]


@router.get("/{item_id}", response_model=AnyItemResponse)
def get_item(item_id: int, session: SessionDep):
    """Get a single item by id."""
    item = item_service.get_item(session, item_id)
    total, completed = item_service._get_task_counts(session, item_id)
    return item_to_response(item, task_count=total, completed_task_count=completed)


@router.post("", response_model=AnyItemResponse, status_code=201)
def create_item(
    data: ItemCreateUnion,
    session: SessionDep,
):
    """Create a new Project, Area, or Resource. The type field is required."""
    item = item_service.create_item(session, data)
    session.commit()
    return item_to_response(item)


@router.put("/{item_id}", response_model=AnyItemResponse)
def update_item(item_id: int, data: ItemUpdate, session: SessionDep):
    """Partially update an item. Only provided fields are changed."""
    item = item_service.update_item(session, item_id, data)
    session.commit()
    return item_to_response(item)


@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: int, session: SessionDep):
    """Delete an item and all its tasks. Always allowed, even if archived."""
    item_service.delete_item(session, item_id)
    session.commit()


@router.post("/{item_id}/archive", response_model=AnyItemResponse)
def archive_item(item_id: int, session: SessionDep):
    """Archive an item."""
    item = item_service.archive_item(session, item_id)
    session.commit()
    return item_to_response(item)


@router.post("/{item_id}/restore", response_model=AnyItemResponse)
def restore_item(item_id: int, session: SessionDep):
    """Restore an archived item."""
    item = item_service.restore_item(session, item_id)
    session.commit()
    return item_to_response(item)


@router.post("/{item_id}/complete", response_model=AnyItemResponse)
def complete_project(item_id: int, session: SessionDep):
    """Mark a project as completed (status only, does not close tasks)."""
    item = item_service.complete_project(session, item_id)
    session.commit()
    return item_to_response(item)


@router.post("/{item_id}/reopen", response_model=AnyItemResponse)
def reopen_project(item_id: int, session: SessionDep):
    """Reopen a completed project."""
    item = item_service.reopen_project(session, item_id)
    session.commit()
    return item_to_response(item)
