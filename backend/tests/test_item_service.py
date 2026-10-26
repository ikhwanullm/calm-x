"""Tests for ItemService — CRUD, archive, restore, project completion."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from backend.database import Base
from backend.exceptions import ArchivedItemError, ConflictError, NotFoundError
from backend.models.item import Item, Task
from backend.models.utils import now_utc
from backend.schemas.item import ProjectCreate, AreaCreate, ResourceCreate, ItemUpdate
from backend.services import item_service


@pytest.fixture
def db_session(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    session = factory()
    yield session
    session.close()


def _project(session, title="Test Project", **kw):
    kw.setdefault("project_status", "active")
    item = Item(
        type="project", title=title, description="", notes="",
        created_at=now_utc(), updated_at=now_utc(),
        **kw
    )
    session.add(item)
    session.flush()
    return item


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

def test_create_project(db_session):
    data = ProjectCreate(title="My Project", project_goal="Goal")
    resp = item_service.create_item(db_session, data)
    assert resp.title == "My Project"
    assert resp.type == "project"


def test_create_area(db_session):
    data = AreaCreate(title="Work", area_maintenance_notes="Weekly review")
    resp = item_service.create_item(db_session, data)
    assert resp.type == "area"


def test_create_resource(db_session):
    data = ResourceCreate(title="Docs")
    resp = item_service.create_item(db_session, data)
    assert resp.type == "resource"


def test_get_item_not_found(db_session):
    with pytest.raises(NotFoundError):
        item_service.get_item(db_session, 9999)


def test_update_item_title(db_session):
    item = _project(db_session)
    resp = item_service.update_item(db_session, item.id, ItemUpdate(title="Updated"))
    assert resp.title == "Updated"


def test_update_archived_item_raises(db_session):
    item = _project(db_session, archived_at=now_utc())
    with pytest.raises(ArchivedItemError):
        item_service.update_item(db_session, item.id, ItemUpdate(title="No"))


def test_delete_item(db_session):
    item = _project(db_session)
    item_id = item.id
    item_service.delete_item(db_session, item_id)
    assert db_session.get(Item, item_id) is None


def test_delete_archived_item_succeeds(db_session):
    """R7.9: deletion of archived items must succeed (no guard)."""
    item = _project(db_session, archived_at=now_utc())
    item_id = item.id
    item_service.delete_item(db_session, item_id)  # must NOT raise
    assert db_session.get(Item, item_id) is None


def test_list_items_excludes_archived_by_default(db_session):
    _project(db_session, title="Active")
    _project(db_session, title="Archived", archived_at=now_utc())
    results = item_service.list_items(db_session)
    titles = [r.title for r in results]
    assert "Active" in titles
    assert "Archived" not in titles


def test_list_items_include_archived(db_session):
    _project(db_session, title="Active")
    _project(db_session, title="Archived", archived_at=now_utc())
    results = item_service.list_items(db_session, include_archived=True)
    assert len(results) == 2


def test_list_items_type_filter(db_session):
    item_service.create_item(db_session, ProjectCreate(title="P"))
    item_service.create_item(db_session, AreaCreate(title="A"))
    results = item_service.list_items(db_session, type_filter="project")
    assert all(r.type == "project" for r in results)
