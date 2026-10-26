"""Property 10: Archived Items Are Read-Only (Except Deletion).

Tests that:
- update operations on archived items raise ArchivedItemError
- archive operation on already-archived item raises ArchivedItemError
- delete operation on archived item SUCCEEDS (R7.9)

Requirements: R7.1, R7.2, R7.9
"""
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.exceptions import ArchivedItemError
from backend.models.item import Item
from backend.models.utils import now_utc
from backend.schemas.item import ItemUpdate
from backend.services import item_service


@pytest.fixture(scope="module")
def engine(tmp_path_factory):
    db = tmp_path_factory.mktemp("p10") / "p10.db"
    engine = create_engine(f"sqlite:///{db}")
    Base.metadata.create_all(engine)
    return engine


@pytest.fixture
def session(engine):
    factory = sessionmaker(bind=engine)
    s = factory()
    yield s
    s.rollback()
    s.close()


def _make_archived_project(session) -> Item:
    item = Item(
        type="project", title="Archived",
        description="", notes="",
        created_at=now_utc(), updated_at=now_utc(),
        project_status="active",
        archived_at=now_utc(),
    )
    session.add(item)
    session.flush()
    return item


# --- Deterministic tests ---

def test_update_archived_raises(session):
    item = _make_archived_project(session)
    with pytest.raises(ArchivedItemError):
        item_service.update_item(session, item.id, ItemUpdate(title="New"))


def test_archive_already_archived_raises(session):
    item = _make_archived_project(session)
    with pytest.raises(ArchivedItemError):
        item_service.archive_item(session, item.id)


def test_delete_archived_succeeds(session):
    """R7.9: deletion of archived items must always succeed."""
    item = _make_archived_project(session)
    item_id = item.id
    item_service.delete_item(session, item_id)  # must not raise
    session.flush()
    assert session.get(Item, item_id) is None


def test_restore_archived_clears_flag(session):
    item = _make_archived_project(session)
    resp = item_service.restore_item(session, item.id)
    assert resp.archived_at is None


# --- Property-based test ---

@given(st.text(min_size=1, max_size=200).filter(lambda s: s.strip()))
@settings(max_examples=20, deadline=None)
def test_any_update_on_archived_raises(new_title):
    """Updating an archived item with any valid title always raises ArchivedItemError."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    session = factory()
    try:
        item = Item(
            type="project", title="Test",
            description="", notes="",
            created_at=now_utc(), updated_at=now_utc(),
            project_status="active", archived_at=now_utc(),
        )
        session.add(item)
        session.flush()

        with pytest.raises(ArchivedItemError):
            item_service.update_item(session, item.id, ItemUpdate(title=new_title.strip()))
    finally:
        session.close()
