"""Property 23: Resource Link Cleanup on Item Deletion.

Tests that deleting an Item removes all resource_links entries where the Item
appears as either resource_id or linked_item_id (ON DELETE CASCADE).

NOTE: ResourceLink ORM model is created in Phase 5. This test inserts rows
directly via SQL to avoid a model dependency.

Requirements: R2.9
"""
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models.item import Item
from backend.models.utils import now_utc
from backend.services import item_service


@pytest.fixture(scope="module")
def engine(tmp_path_factory):
    db = tmp_path_factory.mktemp("p23") / "p23.db"
    engine = create_engine(f"sqlite:///{db}")
    Base.metadata.create_all(engine)
    # Enable FK enforcement
    with engine.connect() as conn:
        conn.execute(text("PRAGMA foreign_keys=ON"))
        conn.commit()
    return engine


@pytest.fixture
def session(engine):
    factory = sessionmaker(bind=engine)
    s = factory()
    # Enable FK enforcement per connection
    s.execute(text("PRAGMA foreign_keys=ON"))
    yield s
    s.rollback()
    s.close()


def _make_item(session, item_type="project") -> Item:
    item = Item(
        type=item_type, title="Test",
        description="", notes="",
        created_at=now_utc(), updated_at=now_utc(),
        project_status="active" if item_type == "project" else None,
    )
    session.add(item)
    session.flush()
    return item


def _insert_resource_link(session, resource_id: int, linked_item_id: int):
    """Insert a resource_link row directly via SQL (ORM model not yet in Phase 2)."""
    session.execute(
        text(
            "INSERT INTO resource_links (resource_id, linked_item_id, created_at) "
            "VALUES (:r, :l, :now)"
        ).bindparams(r=resource_id, l=linked_item_id, now=now_utc().isoformat())
    )
    session.flush()


def _count_resource_links(session) -> int:
    return session.execute(text("SELECT COUNT(*) FROM resource_links")).scalar_one()


def test_delete_resource_removes_links_where_resource(session):
    """Deleting a Resource item removes resource_links where it is the resource."""
    resource = _make_item(session, "resource")
    project = _make_item(session, "project")
    _insert_resource_link(session, resource.id, project.id)
    assert _count_resource_links(session) >= 1

    item_service.delete_item(session, resource.id)
    session.flush()
    assert session.execute(
        text("SELECT COUNT(*) FROM resource_links WHERE resource_id = :r").bindparams(r=resource.id)
    ).scalar_one() == 0


def test_delete_project_removes_links_where_linked(session):
    """Deleting a Project item removes resource_links where it is the linked item."""
    resource = _make_item(session, "resource")
    project = _make_item(session, "project")
    _insert_resource_link(session, resource.id, project.id)
    before = _count_resource_links(session)

    item_service.delete_item(session, project.id)
    session.flush()
    after = _count_resource_links(session)
    assert after < before


def test_delete_removes_both_sides(session):
    """Deleting an item removes links from both FK columns."""
    r1 = _make_item(session, "resource")
    r2 = _make_item(session, "resource")
    p1 = _make_item(session, "project")

    # r1 links to p1; r2 also links to r1 (resource linking to resource)
    _insert_resource_link(session, r1.id, p1.id)
    _insert_resource_link(session, r2.id, r1.id)

    item_service.delete_item(session, r1.id)
    session.flush()

    # Both links involving r1 should be gone
    count = session.execute(
        text(
            "SELECT COUNT(*) FROM resource_links "
            "WHERE resource_id = :id OR linked_item_id = :id"
        ).bindparams(id=r1.id)
    ).scalar_one()
    assert count == 0
