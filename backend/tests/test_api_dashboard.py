"""API and service tests for GET /api/dashboard (task 4.15 regression)."""
import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from backend.api.deps import get_db_session
from backend.config import Config
from backend.database import Base
from backend.main import create_app
from backend.models.item import Item, Task
from backend.models.utils import now_utc
from backend.services.dashboard_service import get_dashboard_data

HEADERS = {"X-Calm-X": "1"}
TODAY = date.today()
TODAY_STR = str(TODAY)


@pytest.fixture
def engine(tmp_path):
    e = create_engine(f"sqlite:///{tmp_path / 'd.db'}")
    Base.metadata.create_all(e)
    return e


@pytest.fixture
def client(tmp_path):
    cfg = Config(port=8080)
    app = create_app(cfg)
    e = create_engine(f"sqlite:///{tmp_path / 'api.db'}")
    Base.metadata.create_all(e)
    f = sessionmaker(bind=e)
    def override():
        s = f()
        try: yield s; s.commit()
        except Exception: s.rollback(); raise
        finally: s.close()
    app.dependency_overrides[get_db_session] = override
    return TestClient(app, base_url="http://localhost:8080", raise_server_exceptions=False)


def _project(s, title, deadline=None, status="active", archived=False):
    now = now_utc()
    item = Item(
        type="project", title=title, description="", notes="",
        project_status=status,
        project_deadline=date.fromisoformat(deadline) if deadline else None,
        archived_at=now if archived else None,
        created_at=now, updated_at=now,
    )
    s.add(item); s.flush(); return item


def _task(s, title, item_id=None, due=None, done=0):
    now = now_utc()
    t = Task(
        item_id=item_id, title=title, description="", notes="",
        priority="medium", is_complete=done, sort_order=0,
        due_date=date.fromisoformat(due) if due else None,
        created_at=now, updated_at=now,
    )
    s.add(t); s.flush(); return t


# ---------- API smoke tests ----------

def test_dashboard_ok(client):
    r = client.get(f"/api/dashboard?today={TODAY_STR}", headers=HEADERS)
    assert r.status_code == 200
    b = r.json()
    assert "inbox_count" in b and "upcoming_deadlines" in b

def test_dashboard_bad_date(client):
    r = client.get("/api/dashboard?today=bad", headers=HEADERS)
    assert r.status_code == 400

def test_dashboard_missing_today(client):
    r = client.get("/api/dashboard", headers=HEADERS)
    assert r.status_code in (400, 422)

# ---------- Service-level regression tests (4.15) ----------

def test_overdue_project_in_needs_attention(engine):
    """Regression 4.15: overdue project appears in upcoming_deadlines."""
    yesterday = str(TODAY - timedelta(days=1))
    with Session(engine) as s:
        _project(s, "Late P", deadline=yesterday)
        s.commit()
    with Session(engine) as s:
        data = get_dashboard_data(s, TODAY)
    assert len(data.upcoming_deadlines) == 1
    assert data.upcoming_deadlines[0].is_overdue is True
    assert data.upcoming_deadlines[0].type == "project"

def test_approaching_task_in_needs_attention(engine):
    """Task due tomorrow (within default threshold=3) appears."""
    tomorrow = str(TODAY + timedelta(days=1))
    with Session(engine) as s:
        _task(s, "Soon task", due=tomorrow)
        s.commit()
    with Session(engine) as s:
        data = get_dashboard_data(s, TODAY)
    assert any(d.type == "task" and not d.is_overdue for d in data.upcoming_deadlines)

def test_completed_task_excluded(engine):
    """Completed tasks do not appear in upcoming_deadlines."""
    yesterday = str(TODAY - timedelta(days=1))
    with Session(engine) as s:
        _task(s, "Done", due=yesterday, done=1)
        s.commit()
    with Session(engine) as s:
        data = get_dashboard_data(s, TODAY)
    assert len(data.upcoming_deadlines) == 0

def test_archived_project_excluded_from_deadlines(engine):
    """Archived projects do not appear in upcoming_deadlines."""
    yesterday = str(TODAY - timedelta(days=1))
    with Session(engine) as s:
        _project(s, "Archived P", deadline=yesterday, archived=True)
        s.commit()
    with Session(engine) as s:
        data = get_dashboard_data(s, TODAY)
    assert len(data.upcoming_deadlines) == 0

def test_on_track_project_not_in_needs_attention(engine):
    """Project due far in the future is NOT in upcoming_deadlines."""
    far_future = str(TODAY + timedelta(days=30))
    with Session(engine) as s:
        _project(s, "Far P", deadline=far_future)
        s.commit()
    with Session(engine) as s:
        data = get_dashboard_data(s, TODAY)
    assert len(data.upcoming_deadlines) == 0

def test_overdue_sorted_before_approaching(engine):
    """Overdue items come before approaching items."""
    yesterday = str(TODAY - timedelta(days=1))
    tomorrow = str(TODAY + timedelta(days=1))
    with Session(engine) as s:
        _project(s, "Approaching P", deadline=tomorrow)
        _project(s, "Overdue P", deadline=yesterday)
        s.commit()
    with Session(engine) as s:
        data = get_dashboard_data(s, TODAY)
    assert len(data.upcoming_deadlines) == 2
    assert data.upcoming_deadlines[0].is_overdue is True
    assert data.upcoming_deadlines[1].is_overdue is False

def test_inbox_count_only_open_tasks(engine):
    """inbox_count counts only open inbox tasks."""
    with Session(engine) as s:
        _task(s, "Open inbox")
        _task(s, "Done inbox", done=1)
        s.commit()
    with Session(engine) as s:
        data = get_dashboard_data(s, TODAY)
    assert data.inbox_count == 1

def test_overall_progress_empty_when_no_eligible_projects(engine):
    """overall_progress is None when no eligible projects."""
    with Session(engine) as s:
        data = get_dashboard_data(s, TODAY)
    assert data.overall_progress is None


def test_dashboard_bad_date_returns_error_contract(client):
    """Fix 6: invalid today returns {error, type} not {detail: ...}."""
    r = client.get("/api/dashboard?today=not-a-date", headers=HEADERS)
    assert r.status_code == 400
    body = r.json()
    assert "error" in body, f"Missing 'error' key in {body}"
    assert "type" in body, f"Missing 'type' key in {body}"
    assert "detail" not in body, f"Should not use FastAPI detail format"


def test_dashboard_progress_1_of_8_is_13(engine):
    """Fix 4: calculate_progress(1,8)=13 not 12 (round-half-up formula)."""
    from backend.services.progress_service import calculate_progress
    assert calculate_progress(1, 8) == 13

    TODAY_LOCAL = date.today()
    with Session(engine) as s:
        now = now_utc()
        proj = Item(type="project", title="P", description="", notes="",
                    project_status="active", archived_at=None, created_at=now, updated_at=now)
        s.add(proj); s.flush()
        for i in range(8):
            t = Task(item_id=proj.id, title=f"T{i}", description="", notes="",
                     priority="medium", is_complete=1 if i == 0 else 0,
                     sort_order=i, created_at=now, updated_at=now)
            s.add(t)
        s.commit()

    with Session(engine) as s:
        data = get_dashboard_data(s, TODAY)
    assert data.active_projects[0].progress_percentage == 13
    assert data.overall_progress == 13


def test_dashboard_reference_link_count_for_resources(engine):
    """Fix 3: reference_link_count counts reference links on non-archived resources."""
    from backend.services.reference_link_service import add_reference_link
    from backend.schemas.link import ReferenceLinkCreate

    with Session(engine) as s:
        now = now_utc()
        resource = Item(type="resource", title="R", description="", notes="",
                        created_at=now, updated_at=now)
        s.add(resource); s.flush()
        resource_id = resource.id
        s.commit()
        with Session(engine) as s2:
            add_reference_link(s2, resource_id, ReferenceLinkCreate(url="https://a.com"))
            add_reference_link(s2, resource_id, ReferenceLinkCreate(url="https://b.com"))
            s2.commit()

    with Session(engine) as s:
        data = get_dashboard_data(s, TODAY)
    assert data.reference_link_count == 2


# ---------- Needs attention follows the Today rules ----------

def _needs_attention(engine):
    with Session(engine) as s:
        return {d.title: d for d in get_dashboard_data(s, TODAY).upcoming_deadlines}


def test_someday_task_is_not_in_needs_attention(engine):
    with Session(engine) as s:
        t = _task(s, "Parked", due=str(TODAY - timedelta(days=3)))
        t.is_someday = 1
        _task(s, "Normal", due=str(TODAY - timedelta(days=3)))
        s.commit()
    assert set(_needs_attention(engine)) == {"Normal"}


def test_task_deferred_past_today_is_not_in_needs_attention_until_its_date(engine):
    with Session(engine) as s:
        t = _task(s, "Starts later", due=str(TODAY + timedelta(days=2)))
        t.defer_until = TODAY + timedelta(days=1)
        s.commit()
    assert _needs_attention(engine) == {}
    with Session(engine) as s:
        on_start_day = get_dashboard_data(s, TODAY + timedelta(days=1)).upcoming_deadlines
    assert [d.title for d in on_start_day] == ["Starts later"]


def test_task_whose_defer_date_has_passed_is_in_needs_attention(engine):
    with Session(engine) as s:
        t = _task(s, "Started", due=str(TODAY - timedelta(days=1)))
        t.defer_until = TODAY - timedelta(days=5)
        s.commit()
    assert set(_needs_attention(engine)) == {"Started"}


def test_waiting_task_stays_in_needs_attention_with_who_it_waits_on(engine):
    with Session(engine) as s:
        t = _task(s, "Firewall rule", due=str(TODAY - timedelta(days=2)))
        t.waiting_for = "Security team"
        _task(s, "Plain", due=str(TODAY - timedelta(days=1)))
        s.commit()
    found = _needs_attention(engine)
    assert found["Firewall rule"].waiting_for == "Security team"
    assert found["Plain"].waiting_for is None


def test_dashboard_api_returns_waiting_for_on_deadline_items(client):
    r = client.post("/api/tasks", json={"title": "Wait", "due_date": str(TODAY)}, headers=HEADERS)
    tid = r.json()["id"]
    client.put(f"/api/tasks/{tid}", json={"waiting_for": "Vendor"}, headers=HEADERS)
    items = client.get(f"/api/dashboard?today={TODAY_STR}").json()["upcoming_deadlines"]
    assert [(i["title"], i["waiting_for"]) for i in items] == [("Wait", "Vendor")]
