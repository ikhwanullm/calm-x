"""Guards for service-layer preconditions."""
from __future__ import annotations

from backend.exceptions import ArchivedItemError


def guard_not_archived(item: object) -> None:
    """Raise ArchivedItemError if the item is archived.

    Use before any update or archive operation (NOT before delete).
    Delete operations bypass this guard per requirement R7.9.
    """
    from backend.models.item import Item
    assert isinstance(item, Item), f"Expected Item, got {type(item)}"
    if item.archived_at is not None:
        raise ArchivedItemError(
            f"Item '{item.title}' is archived and cannot be modified.",
            detail=f"item_id={item.id}",
        )


def guard_task_item_not_archived(item: object | None) -> None:
    """Raise ArchivedItemError if the task's parent item is archived.

    Accepts None (Inbox tasks have no parent item).
    Use before creating or modifying tasks on an item.
    """
    if item is None:
        return  # Inbox tasks have no parent item
    guard_not_archived(item)
