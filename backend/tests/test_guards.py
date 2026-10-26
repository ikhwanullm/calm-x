"""Tests for ArchivedItemGuard."""
import pytest
from unittest.mock import MagicMock
from datetime import datetime, timezone

from backend.exceptions import ArchivedItemError
from backend.services.guards import guard_not_archived, guard_task_item_not_archived


def _make_item(archived: bool):
    """Return a mock Item with or without archived_at."""
    from backend.models.item import Item
    item = MagicMock(spec=Item)
    item.archived_at = datetime(2024, 1, 1) if archived else None
    item.title = "Test Item"
    item.id = 1
    return item


def test_guard_passes_for_active_item():
    item = _make_item(archived=False)
    guard_not_archived(item)  # should not raise


def test_guard_raises_for_archived_item():
    item = _make_item(archived=True)
    with pytest.raises(ArchivedItemError):
        guard_not_archived(item)


def test_guard_error_message_contains_title():
    item = _make_item(archived=True)
    with pytest.raises(ArchivedItemError) as exc_info:
        guard_not_archived(item)
    assert "Test Item" in str(exc_info.value)


def test_task_guard_passes_for_none_item():
    """Inbox tasks (no parent item) always pass."""
    guard_task_item_not_archived(None)  # should not raise


def test_task_guard_passes_for_active_item():
    item = _make_item(archived=False)
    guard_task_item_not_archived(item)  # should not raise


def test_task_guard_raises_for_archived_item():
    item = _make_item(archived=True)
    with pytest.raises(ArchivedItemError):
        guard_task_item_not_archived(item)


def test_guard_non_item_raises_assertion():
    """guard_not_archived must only accept Item instances."""
    with pytest.raises(AssertionError):
        guard_not_archived("not an item")
