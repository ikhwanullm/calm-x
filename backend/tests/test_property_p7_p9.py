"""Property tests P7-P9, P19-P20, P22 for Phase 5."""
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from backend.database import Base
from backend.exceptions import LimitExceededError
from backend.models.item import Item, ResourceLink, Task
from backend.models.utils import now_utc
from backend.schemas.link import ReferenceLinkCreate, TypeConversionPayload
from backend.services.reference_link_service import add_reference_link
from backend.services.resource_link_service import link_resource
from backend.services.type_conversion_service import convert_item


def _engine():
    e = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(e)
    return e


def _item(s, item_type="project", title="P"):
    now = now_utc()
    item = Item(
        type=item_type, title=title, description="", notes="",
        project_status="active" if item_type == "project" else None,
        created_at=now, updated_at=now,
    )
    s.add(item)
    s.flush()
    return item.id   # return ID directly to avoid DetachedInstanceError


def _task(s, item_id=None, title="T", is_complete=0):
    now = now_utc()
    t = Task(
        item_id=item_id, title=title, description="", notes="",
        priority="medium", is_complete=is_complete, sort_order=0,
        created_at=now, updated_at=now,
    )
    s.add(t)
    s.flush()
    return t.id


@pytest.fixture
def engine():
    return _engine()


# ---- P7: Type conversion preserves common fields ----

def test_p7_conversion_preserves_title_description_notes(engine):
    """P7: title, description, notes survive type conversion."""
    with Session(engine) as s:
        item_id = _item(s, "project", "My Project")
        item = s.get(Item, item_id)
        item.description = "desc"
        item.notes = "notes"
        s.commit()

    with Session(engine) as s:
        convert_item(s, item_id, TypeConversionPayload(target_type="area"))
        s.commit()

    with Session(engine) as s:
        updated = s.get(Item, item_id)
        assert updated.title == "My Project"
        assert updated.description == "desc"
        assert updated.notes == "notes"


# ---- P8: Fields hidden but preserved ----

def test_p8_project_deadline_preserved_after_convert_to_area(engine):
    """P8: project_deadline is preserved in DB when converting to Area."""
    from datetime import date
    with Session(engine) as s:
        item_id = _item(s, "project")
        item = s.get(Item, item_id)
        item.project_deadline = date(2025, 12, 31)
        item.project_goal = "Finish it"
        s.commit()

    with Session(engine) as s:
        convert_item(s, item_id, TypeConversionPayload(target_type="area"))
        s.commit()

    with Session(engine) as s:
        updated = s.get(Item, item_id)
        assert updated.type == "area"
        assert updated.project_deadline == date(2025, 12, 31)
        assert updated.project_goal == "Finish it"


def test_p8_maintenance_notes_preserved_after_convert_to_resource(engine):
    """P8: area_maintenance_notes preserved when converting Area to Resource."""
    with Session(engine) as s:
        item_id = _item(s, "area")
        item = s.get(Item, item_id)
        item.area_maintenance_notes = "Keep clean"
        s.commit()

    with Session(engine) as s:
        convert_item(s, item_id, TypeConversionPayload(target_type="resource"))
        s.commit()

    with Session(engine) as s:
        updated = s.get(Item, item_id)
        assert updated.type == "resource"
        assert updated.area_maintenance_notes == "Keep clean"


def test_p8_fields_restored_when_converting_back(engine):
    """P8: deadline and goal restored when converting Area back to Project."""
    from datetime import date
    with Session(engine) as s:
        item_id = _item(s, "project")
        item = s.get(Item, item_id)
        item.project_deadline = date(2025, 12, 31)
        item.project_goal = "Goal"
        s.commit()

    with Session(engine) as s:
        convert_item(s, item_id, TypeConversionPayload(target_type="area"))
        s.commit()

    with Session(engine) as s:
        convert_item(s, item_id, TypeConversionPayload(target_type="project"))
        s.commit()

    with Session(engine) as s:
        updated = s.get(Item, item_id)
        assert updated.type == "project"
        assert updated.project_status == "active"
        assert updated.project_deadline == date(2025, 12, 31)


# ---- P9: Tasks move to Inbox on Resource conversion ----

@given(
    n_open=st.integers(min_value=0, max_value=5),
    n_done=st.integers(min_value=0, max_value=5),
)
@settings(max_examples=20, deadline=None)
def test_p9_all_tasks_move_to_inbox_on_resource_conversion(n_open, n_done):
    """P9: ALL tasks (open + completed) move to inbox when converting to Resource."""
    e = _engine()
    with Session(e) as s:
        item_id = _item(s, "project")
        for i in range(n_open):
            _task(s, item_id, f"Open {i}", 0)
        for i in range(n_done):
            _task(s, item_id, f"Done {i}", 1)
        s.commit()

    with Session(e) as s:
        convert_item(s, item_id, TypeConversionPayload(target_type="resource"))
        s.commit()

    with Session(e) as s:
        tasks = s.execute(
            select(Task).where(Task.item_id.is_(None))
        ).scalars().all()
        assert len(tasks) == n_open + n_done


# ---- P19: Reference link maximum ----

def test_p19_adding_51st_reference_link_raises(engine):
    """P19: adding the 51st reference link raises LimitExceededError."""
    from backend.services.reference_link_service import MAX_REFERENCE_LINKS
    item_id = None
    with Session(engine) as s:
        item_id = _item(s)
        s.commit()
        for i in range(MAX_REFERENCE_LINKS):
            add_reference_link(s, item_id, ReferenceLinkCreate(url=f"https://example.com/{i}"))
        s.commit()

    with Session(engine) as s:
        with pytest.raises(LimitExceededError):
            add_reference_link(s, item_id, ReferenceLinkCreate(url="https://overflow.com"))


# ---- P20: Resource link maximum ----

def test_p20_adding_21st_resource_link_raises(engine):
    """P20: adding the 21st resource link raises LimitExceededError."""
    from backend.services.resource_link_service import MAX_RESOURCE_LINKS
    resource_id = None
    extra_id = None
    with Session(engine) as s:
        resource_id = _item(s, "resource")
        project_ids = [_item(s, "project", f"P{i}") for i in range(MAX_RESOURCE_LINKS)]
        extra_id = _item(s, "project", "Extra")
        s.commit()
        for pid in project_ids:
            link_resource(s, resource_id, pid)
        s.commit()

    with Session(engine) as s:
        with pytest.raises(LimitExceededError):
            link_resource(s, resource_id, extra_id)


# ---- P22: Resource link cleanup on conversion ----

def test_p22_from_resource_clears_outbound_links(engine):
    """P22: converting FROM Resource deletes its outbound resource_links (R2.7)."""
    with Session(engine) as s:
        resource_id = _item(s, "resource")
        project_id = _item(s, "project")
        s.commit()
        link_resource(s, resource_id, project_id)
        s.commit()

    with Session(engine) as s:
        convert_item(s, resource_id, TypeConversionPayload(target_type="area"))
        s.commit()

    with Session(engine) as s:
        links = s.execute(
            select(ResourceLink).where(ResourceLink.resource_id == resource_id)
        ).scalars().all()
        assert len(links) == 0


def test_p22_to_resource_clears_inbound_links(engine):
    """P22: converting TO Resource deletes resource_links pointing to it (R2.8)."""
    with Session(engine) as s:
        resource_id = _item(s, "resource")
        project_id = _item(s, "project")
        s.commit()
        link_resource(s, resource_id, project_id)
        s.commit()

    with Session(engine) as s:
        convert_item(s, project_id, TypeConversionPayload(target_type="resource"))
        s.commit()

    with Session(engine) as s:
        links = s.execute(
            select(ResourceLink).where(ResourceLink.linked_item_id == project_id)
        ).scalars().all()
        assert len(links) == 0
