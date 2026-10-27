"""Reference link service: manage URL links attached to items."""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.exceptions import (
    ArchivedItemError,
    LimitExceededError,
    NotFoundError,
    ValidationError,
)
from backend.models.item import Item, ReferenceLink
from backend.models.utils import now_utc
from backend.schemas.link import ReferenceLinkCreate, ReferenceLinkResponse

MAX_REFERENCE_LINKS = 50


def _get_or_404(session: Session, link_id: int) -> ReferenceLink:
    link = session.get(ReferenceLink, link_id)
    if link is None:
        raise NotFoundError(f"Reference link {link_id} not found")
    return link


def list_links(session: Session, item_id: int) -> list[ReferenceLinkResponse]:
    """Return all reference links for an item, ordered by sort_order."""
    from sqlalchemy import select as sel
    links = session.execute(
        sel(ReferenceLink)
        .where(ReferenceLink.item_id == item_id)
        .order_by(ReferenceLink.sort_order, ReferenceLink.id)
    ).scalars().all()
    return [ReferenceLinkResponse.model_validate(l) for l in links]


def add_reference_link(
    session: Session, item_id: int, data: ReferenceLinkCreate
) -> ReferenceLinkResponse:
    """Add a reference link to an item. Enforces archived guard and 50-link limit."""
    item = session.get(Item, item_id)
    if item is None:
        raise NotFoundError(f"Item {item_id} not found")
    if item.archived_at is not None:
        raise ArchivedItemError(
            f"Item {item_id} is archived and cannot be modified."
        )
    count: int = session.execute(
        select(func.count()).where(ReferenceLink.item_id == item_id)
    ).scalar_one()
    if count >= MAX_REFERENCE_LINKS:
        raise LimitExceededError(
            f"This item has reached the maximum of {MAX_REFERENCE_LINKS} reference links."
        )
    sort_order = count
    link = ReferenceLink(
        item_id=item_id,
        url=data.url,
        sort_order=sort_order,
        created_at=now_utc(),
    )
    session.add(link)
    session.flush()
    return ReferenceLinkResponse.model_validate(link)


def remove_reference_link(session: Session, link_id: int) -> None:
    """Delete a reference link. Enforces archived guard on parent item."""
    link = _get_or_404(session, link_id)
    item = session.get(Item, link.item_id)
    if item is not None and item.archived_at is not None:
        raise ArchivedItemError(
            f"Item {link.item_id} is archived and cannot be modified."
        )
    session.delete(link)
    session.flush()


def reorder_links(
    session: Session, item_id: int, link_ids: list[int]
) -> list[ReferenceLinkResponse]:
    """Update sort_order for reference links. All IDs must belong to item_id."""
    item = session.get(Item, item_id)
    if item is None:
        raise NotFoundError(f"Item {item_id} not found")
    if item.archived_at is not None:
        raise ArchivedItemError(
            f"Item {item_id} is archived and cannot be modified."
        )
    item_link_ids = {
        l.id
        for l in session.execute(
            select(ReferenceLink).where(ReferenceLink.item_id == item_id)
        ).scalars().all()
    }
    invalid = [lid for lid in link_ids if lid not in item_link_ids]
    if invalid:
        raise ValidationError(
            f"Link IDs {invalid} do not belong to item {item_id}"
        )
    for order, lid in enumerate(link_ids):
        link = session.get(ReferenceLink, lid)
        if link:
            link.sort_order = order
    session.flush()
    return list_links(session, item_id)
