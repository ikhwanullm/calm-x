"""Resource link service: manage links from a Resource to Projects/Areas."""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.exceptions import (
    ArchivedItemError,
    ConflictError,
    LimitExceededError,
    NotFoundError,
    ValidationError,
)
from backend.models.item import Item, ResourceLink
from backend.models.utils import now_utc
from backend.schemas.link import LinkedItemSummary, ResourceLinkResponse

MAX_RESOURCE_LINKS = 20


def list_linked_items(session: Session, resource_id: int) -> list[LinkedItemSummary]:
    """Return all items linked from a Resource."""
    resource = session.get(Item, resource_id)
    if resource is None:
        raise NotFoundError(f"Resource {resource_id} not found")
    links = session.execute(
        select(ResourceLink).where(ResourceLink.resource_id == resource_id)
    ).scalars().all()
    result: list[LinkedItemSummary] = []
    for link in links:
        item = session.get(Item, link.linked_item_id)
        if item is not None:
            result.append(LinkedItemSummary(
                id=item.id,
                type=item.type,
                title=item.title,
                archived_at=item.archived_at,
            ))
    return result


def link_resource(
    session: Session, resource_id: int, linked_item_id: int
) -> ResourceLinkResponse:
    """Link a Resource to a Project or Area.

    Validates:
    - resource must exist and be a Resource type and not archived
    - linked item must exist, be Project/Area, and not archived
    - must not link to another Resource
    - duplicate links raise 409
    - max 20 links per resource
    """
    resource = session.get(Item, resource_id)
    if resource is None:
        raise NotFoundError(f"Resource {resource_id} not found")
    if resource.type != "resource":
        raise ValidationError(f"Item {resource_id} is not a Resource")
    if resource.archived_at is not None:
        raise ArchivedItemError(f"Resource {resource_id} is archived")

    linked_item = session.get(Item, linked_item_id)
    if linked_item is None:
        raise NotFoundError(f"Item {linked_item_id} not found")
    if linked_item.type == "resource":
        raise ValidationError("Cannot link a Resource to another Resource")
    if linked_item.archived_at is not None:
        raise ArchivedItemError(f"Item {linked_item_id} is archived")

    # Check for duplicate
    existing = session.execute(
        select(ResourceLink).where(
            ResourceLink.resource_id == resource_id,
            ResourceLink.linked_item_id == linked_item_id,
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise ConflictError(
            f"Item {linked_item_id} is already linked to resource {resource_id}"
        )

    # Enforce limit
    count: int = session.execute(
        select(func.count()).where(ResourceLink.resource_id == resource_id)
    ).scalar_one()
    if count >= MAX_RESOURCE_LINKS:
        raise LimitExceededError(
            f"Resource has reached the maximum of {MAX_RESOURCE_LINKS} linked items."
        )

    link = ResourceLink(
        resource_id=resource_id,
        linked_item_id=linked_item_id,
        created_at=now_utc(),
    )
    session.add(link)
    session.flush()
    return ResourceLinkResponse.model_validate(link)


def unlink_resource(
    session: Session, resource_id: int, linked_item_id: int
) -> None:
    """Remove a resource link."""
    resource = session.get(Item, resource_id)
    if resource is None:
        raise NotFoundError(f"Resource {resource_id} not found")
    if resource.archived_at is not None:
        raise ArchivedItemError(f"Resource {resource_id} is archived")

    link = session.execute(
        select(ResourceLink).where(
            ResourceLink.resource_id == resource_id,
            ResourceLink.linked_item_id == linked_item_id,
        )
    ).scalar_one_or_none()
    if link is None:
        raise NotFoundError(
            f"No link between resource {resource_id} and item {linked_item_id}"
        )
    session.delete(link)
    session.flush()
