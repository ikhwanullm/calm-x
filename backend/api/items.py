"""FastAPI router for Items (Projects, Areas, Resources)."""
from __future__ import annotations

from typing import Annotated, Literal, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.api.deps import get_db_session
from backend.schemas.item import (
    AreaCreate,
    ItemResponse,
    ItemUpdate,
    ProjectCreate,
    ResourceCreate,
)
from backend.services import item_service

router = APIRouter(prefix="/items", tags=["items"])

SessionDep = Annotated[Session, Depends(get_db_session)]


@router.get("/", response_model=list[ItemResponse])
def list_items(
    session: SessionDep,
    type: Optional[Literal["project", "area", "resource"]] = Query(default=None),
    include_archived: bool = Query(default=False),
):
    """List items. Filter by type and/or include archived."""
    return item_service.list_items(
        session,
        type_filter=type,
        include_archived=include_archived,
    )


@router.get("/{item_id}", response_model=ItemResponse)
def get_item(item_id: int, session: SessionDep):
    """Get a single item by id."""
    return item_service.get_item(session, item_id)


@router.post("/", response_model=ItemResponse, status_code=201)
def create_item(
    data: ProjectCreate | AreaCreate | ResourceCreate,
    session: SessionDep,
):
    """Create a new Project, Area, or Resource."""
    return item_service.create_item(session, data)


@router.put("/{item_id}", response_model=ItemResponse)
def update_item(item_id: int, data: ItemUpdate, session: SessionDep):
    """Partially update an item."""
    return item_service.update_item(session, item_id, data)


@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: int, session: SessionDep):
    """Delete an item and all its tasks. Always allowed, even if archived."""
    item_service.delete_item(session, item_id)


@router.post("/{item_id}/archive", response_model=ItemResponse)
def archive_item(item_id: int, session: SessionDep):
    """Archive an item."""
    return item_service.archive_item(session, item_id)


@router.post("/{item_id}/restore", response_model=ItemResponse)
def restore_item(item_id: int, session: SessionDep):
    """Restore an archived item."""
    return item_service.restore_item(session, item_id)


@router.post("/{item_id}/complete", response_model=ItemResponse)
def complete_project(item_id: int, session: SessionDep):
    """Mark a project as completed (status only, does not close tasks)."""
    return item_service.complete_project(session, item_id)


@router.post("/{item_id}/reopen", response_model=ItemResponse)
def reopen_project(item_id: int, session: SessionDep):
    """Reopen a completed project."""
    return item_service.reopen_project(session, item_id)
