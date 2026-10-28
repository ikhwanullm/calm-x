"""API integration tests for GET /api/tasks filter params (tasks 6.2, 6.3)."""
import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from backend.api.deps import get_db_session
from backend.config import Config
from backend.database import Base
from backend.main import create_app
from backend.models.item import Item, Tag, Task, TaskTag
from backend.models.utils import now_utc

HEADERS = {"X-Calm-X": "1"}
TODAY = str(date.today())


@pytest.fixture
def client(tmp_path):
    cfg = Config(port=8080)
    app = create_app(cfg)
    engine = create_engine(f"sqlite:///{tmp_path / 'db.sqlite'}")
    Base.metadata.create_all(engine)
    f = sessionmaker(bind=engine)
    def override():
        s = f()
        try: yield s; s.commit()
        except Exception: s.rollback(); raise
        finally: s.close()
    app.dependency_overrides[get_db_session] = override
    return TestClient(app, base_url="http://localhost:8080", raise_server_exceptions=False)


def _proj(s, title="P"):
    now = now_utc()
    i = Item(type="project", title=title, description="", notes="",
             project_status="active", created_at=now, updated_at=now)
    s.add(i); s.flush(); return i

def _task(s, title="T", item_id=None, priority="medium", due=None):
    now = now_utc()
    t = Task(item_id=item_id, title=title, description="", notes="",
             priority=priority, is_complete=0, sort_order=0,
             due_date=date.fromisoformat(due) if due else None,
             created_at=now, updated_at=now)
    s.add(t); s.flush(); return t

def _tag(s, name):
    now = now_utc()
    t = Tag(name=name, created_at=now)
    s.add(t); s.flush(); return t

def _assign(s, task, tag):
    tt = TaskTag(task_id=task.id, tag_id=tag.id)
    s.add(tt); s.flush()


def test_filter_by_tag_or_logic(client):
    """Tags use OR: task with tag1 OR tag2 must appear."""
    t1 = client.post("/api/tags", json={"name": "work"}, headers=HEADERS).json()
    t2 = client.post("/api/tags", json={"name": "urgent"}, headers=HEADERS).json()
    t3 = client.post("/api/tags", json={"name": "other"}, headers=HEADERS).json()
    ta = client.post("/api/tasks", json={"title": "A", "tag_names": ["work"]}, headers=HEADERS).json()
    tb = client.post("/api/tasks", json={"title": "B", "tag_names": ["urgent"]}, headers=HEADERS).json()
    tc = client.post("/api/tasks", json={"title": "C", "tag_names": ["other"]}, headers=HEADERS).json()
    # Filter by tag1 OR tag2
    r = client.get(f"/api/tasks?tags={t1['id']},{t2['id']}").json()
    ids = {t["id"] for t in r}
    assert ta["id"] in ids
    assert tb["id"] in ids
    assert tc["id"] not in ids


def test_filter_by_priority(client):
    """Priority filter: only high-priority tasks."""
    client.post("/api/tasks", json={"title": "Hi", "priority": "high"}, headers=HEADERS)
    client.post("/api/tasks", json={"title": "Lo", "priority": "low"}, headers=HEADERS)
    r = client.get("/api/tasks?priorities=high").json()
    assert all(t["priority"] == "high" for t in r)


def test_filter_invalid_priority_returns_400(client):
    r = client.get("/api/tasks?priorities=mega")
    assert r.status_code == 400


def test_filter_invalid_date_returns_400(client):
    r = client.get("/api/tasks?due_start=not-a-date")
    assert r.status_code == 400


def test_filter_due_date_range(client):
    """due_start and due_end are inclusive."""
    today = date.today()
    yesterday = str(today - timedelta(days=1))
    tomorrow = str(today + timedelta(days=1))
    client.post("/api/tasks", json={"title": "Old", "due_date": yesterday}, headers=HEADERS)
    client.post("/api/tasks", json={"title": "Today", "due_date": TODAY}, headers=HEADERS)
    client.post("/api/tasks", json={"title": "New", "due_date": tomorrow}, headers=HEADERS)
    r = client.get(f"/api/tasks?due_start={TODAY}&due_end={TODAY}").json()
    titles = {t["title"] for t in r}
    assert "Today" in titles
    assert "Old" not in titles
    assert "New" not in titles


def test_filter_category_inbox(client):
    item_id = client.post("/api/items", json={"type": "project", "title": "P"}, headers=HEADERS).json()["id"]
    client.post("/api/tasks", json={"title": "Inbox T"}, headers=HEADERS)
    client.post("/api/tasks", json={"title": "Item T", "item_id": item_id}, headers=HEADERS)
    r = client.get("/api/tasks?category=inbox").json()
    assert all(t["item_id"] is None for t in r)


def test_filter_excludes_archived_item_tasks(client):
    item_id = client.post("/api/items", json={"type": "project", "title": "P"}, headers=HEADERS).json()["id"]
    client.post("/api/tasks", json={"title": "T", "item_id": item_id}, headers=HEADERS)
    client.post(f"/api/items/{item_id}/archive", headers=HEADERS)
    r = client.get(f"/api/tasks?item_id={item_id}").json()
    # Tasks on archived item should NOT appear
    assert len(r) == 0
