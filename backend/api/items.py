"""FastAPI router for Items (Projects, Areas, Resources)."""
from __future__ import annotations

from typing import Annotated, Literal, Optional, Union

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.api.deps import get_db_session
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


@router.get("", response_model=list[AnyItemResponse])
def list_items(
    session: SessionDep,
    type: Optional[Literal["project", "area", "resource"]] = Query(default=None),
    include_archived: bool = Query(default=False),
):
    """List items. Filter by type and/or include archived."""
    items_with_counts = item_service.list_items(session, type_filter=type, include_archived=include_archived)
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
