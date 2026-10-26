"""Tests for Item Pydantic schemas."""
import datetime
import pytest

from backend.schemas.item import (
    ProjectCreate,
    AreaCreate,
    ResourceCreate,
    ItemUpdate,
    ProjectResponse,
    AreaResponse,
    ResourceResponse,
    item_to_response,
)


def test_project_create_strips_title():
    p = ProjectCreate(type="project", title="  My Project  ")
    assert p.title == "My Project"


def test_create_empty_title_raises():
    with pytest.raises(Exception):
        ProjectCreate(title="   ")


def test_project_create_defaults():
    p = ProjectCreate(type="project", title="Test")
    assert p.description == ""
    assert p.notes == ""
    assert p.project_goal is None
    assert p.project_deadline is None


def test_area_create_type():
    a = AreaCreate(type="area", title="Work")
    assert a.type == "area"


def test_resource_create_type():
    r = ResourceCreate(type="resource", title="Docs")
    assert r.type == "resource"


def test_item_update_partial():
    u = ItemUpdate(title="New title")
    assert u.title == "New title"
    assert u.description is None


def test_item_update_no_project_status_field():
    """project_status is no longer in ItemUpdate; it is ignored silently."""
    # project_status is not a field, so it should be treated as extra (and ignored)
    u = ItemUpdate()
    assert not hasattr(u, 'project_status') or getattr(u, 'project_status', 'MISSING') == 'MISSING' 


def test_project_response_has_project_fields():
    now = datetime.datetime(2024, 1, 1, tzinfo=datetime.timezone.utc)
    r = ProjectResponse(
        id=1, type="project", title="P", description="", notes="",
        created_at=now, updated_at=now,
        project_goal="Build it",
        project_deadline=datetime.date(2024, 12, 31),
        project_status="active",
    )
    assert r.project_goal == "Build it"
    assert r.project_status == "active"


def test_area_response_no_project_fields():
    """AreaResponse must not have project fields."""
    assert not hasattr(AreaResponse, "project_goal")
    assert not hasattr(AreaResponse, "project_deadline")


def test_resource_response_no_area_fields():
    assert not hasattr(ResourceResponse, "area_maintenance_notes")


def test_item_to_response_project(tmp_path):
    """item_to_response returns ProjectResponse for project type."""
    from backend.database import get_engine, Base
    from backend.models.item import Item
    from backend.models.utils import now_utc

    engine = get_engine(f"sqlite:///{tmp_path / 'r.db'}")
    Base.metadata.create_all(engine)

    from sqlalchemy.orm import Session
    with Session(engine) as session:
        item = Item(
            type="project", title="Test Project",
            description="", notes="",
            created_at=now_utc(), updated_at=now_utc(),
            project_status="active",
        )
        session.add(item)
        session.commit()
        session.refresh(item)
        response = item_to_response(item, task_count=8, completed_task_count=1)

    assert isinstance(response, ProjectResponse)
    assert response.task_count == 8
    assert response.progress_percentage == 13  # 1/8 = 13 (round-half-up)


def test_item_to_response_area(tmp_path):
    from backend.database import get_engine, Base
    from backend.models.item import Item
    from backend.models.utils import now_utc

    engine = get_engine(f"sqlite:///{tmp_path / 'a.db'}")
    Base.metadata.create_all(engine)

    from sqlalchemy.orm import Session
    with Session(engine) as session:
        item = Item(
            type="area", title="Work",
            description="", notes="",
            created_at=now_utc(), updated_at=now_utc(),
            area_maintenance_notes="Check weekly",
        )
        session.add(item)
        session.commit()
        session.refresh(item)
        response = item_to_response(item)

    assert isinstance(response, AreaResponse)
    assert response.area_maintenance_notes == "Check weekly"
