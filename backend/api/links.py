"""FastAPI routers for Reference Links, Resource Links, and Type Conversion."""
from __future__ import annotations

from typing import Annotated, Union

from fastapi import APIRouter, Depends, Path
from sqlalchemy.orm import Session

from backend.api.deps import get_db_session
from backend.schemas.link import (
    LinkedItemSummary,
    ReferenceLinkCreate,
    ReferenceLinkReorder,
    ReferenceLinkResponse,
    ResourceLinkCreate,
    ResourceLinkResponse,
    TypeConversionPayload,
    TypeConversionPreview,
)
from backend.services import reference_link_service, resource_link_service
from backend.services.type_conversion_service import (
    convert_item,
    get_conversion_preview,
)

router = APIRouter(tags=["links"])
SessionDep = Annotated[Session, Depends(get_db_session)]

# ---------------------------------------------------------------------------
# Reference Links
# ---------------------------------------------------------------------------

@router.get("/items/{item_id}/links", response_model=list[ReferenceLinkResponse])
def list_reference_links(item_id: int, session: SessionDep):
    """List all reference links for an item."""
    return reference_link_service.list_links(session, item_id)


@router.post(
    "/items/{item_id}/links",
    response_model=ReferenceLinkResponse,
    status_code=201,
)
def add_reference_link(item_id: int, data: ReferenceLinkCreate, session: SessionDep):
    """Add a reference link to an item."""
    link = reference_link_service.add_reference_link(session, item_id, data)
    session.commit()
    return link


@router.delete("/links/{link_id}", status_code=204)
def delete_reference_link(link_id: int, session: SessionDep):
    """Delete a reference link."""
    reference_link_service.remove_reference_link(session, link_id)
    session.commit()


@router.put(
    "/items/{item_id}/links/reorder",
    response_model=list[ReferenceLinkResponse],
)
def reorder_reference_links(
    item_id: int, payload: ReferenceLinkReorder, session: SessionDep
):
    """Reorder reference links for an item."""
    result = reference_link_service.reorder_links(session, item_id, payload.link_ids)
    session.commit()
    return result


# ---------------------------------------------------------------------------
# Resource Links
# ---------------------------------------------------------------------------

@router.get(
    "/resources/{resource_id}/linked-items",
    response_model=list[LinkedItemSummary],
)
def list_linked_items(resource_id: int, session: SessionDep):
    """List all items linked from a Resource."""
    return resource_link_service.list_linked_items(session, resource_id)


@router.post(
    "/resources/{resource_id}/link",
    response_model=ResourceLinkResponse,
    status_code=201,
)
def link_resource(
    resource_id: int, payload: ResourceLinkCreate, session: SessionDep
):
    """Link a Resource to a Project or Area."""
    link = resource_link_service.link_resource(session, resource_id, payload.linked_item_id)
    session.commit()
    return link


@router.delete("/resources/{resource_id}/link/{item_id}", status_code=204)
def unlink_resource(resource_id: int, item_id: int, session: SessionDep):
    """Remove a resource link."""
    resource_link_service.unlink_resource(session, resource_id, item_id)
    session.commit()


# ---------------------------------------------------------------------------
# Type Conversion
# ---------------------------------------------------------------------------

@router.get(
    "/items/{item_id}/convert/preview",
    response_model=TypeConversionPreview,
)
def preview_conversion(
    item_id: int,
    target_type: str,
    session: SessionDep,
):
    """Preview the consequences of a type conversion."""
    return get_conversion_preview(session, item_id, target_type)


@router.post("/items/{item_id}/convert")
def convert_item_route(
    item_id: int, payload: TypeConversionPayload, session: SessionDep
):
    """Convert an item to a different type."""
    result = convert_item(session, item_id, payload)
    session.commit()
    return result
