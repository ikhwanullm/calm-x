"""Integration tests for Weekly Review API and property test P16."""
from datetime import date, datetime, timezone, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.main import create_app
from backend.config import Config
from backend.api.deps import get_db_session

HEADERS = {"X-Calm-X": "1"}
TODAY = date.today().isoformat()


@pytest.fixture
def client(tmp_path):
    """TestClient with an isolated SQLite database."""
    cfg = Config(port=8080)
    app = create_app(cfg)
    engine = create_engine(f"sqlite:///{tmp_path / 'review_test.db'}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)

    def override_db():
        session = factory()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    app.dependency_overrides[get_db_session] = override_db
    return TestClient(app, base_url="http://localhost:8080", raise_server_exceptions=False)


def _create_project(client):
    return client.post("/api/items", json={"type": "project", "title": "Test Project"},
                       headers=HEADERS).json()


def _create_task(client, title="Test task", item_id=None):
    payload = {"title": title}
    if item_id:
        payload["item_id"] = item_id
    return client.post("/api/tasks", json=payload, headers=HEADERS).json()


# ---------------------------------------------------------------------------
# Review status endpoint
# ---------------------------------------------------------------------------

def test_review_status_no_reviews(client):
    """GET /status with no reviews returns null dates."""
    resp = client.get(f"/api/weekly-review/status?today={TODAY}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["last_review_date"] is None
    assert body["last_review_days_ago"] is None


def test_review_status_after_complete(client):
    """After completing a review, status returns today's date."""
    client.post("/api/weekly-review/complete", json={"notes": ""}, headers=HEADERS)
    resp = client.get(f"/api/weekly-review/status?today={TODAY}")
    assert resp.status_code == 200
    assert resp.json()["last_review_date"] == TODAY
    assert resp.json()["last_review_days_ago"] == 0


# ---------------------------------------------------------------------------
# Inbox endpoint
# ---------------------------------------------------------------------------

def test_review_inbox_returns_open_inbox_tasks(client):
    """GET /inbox returns open inbox tasks (item_id IS NULL)."""
    # Create inbox tasks
    _create_task(client, "Inbox task 1")
    _create_task(client, "Inbox task 2")
    # Create project task — should NOT appear in inbox
    project = _create_project(client)
    _create_task(client, "Project task", item_id=project["id"])

    resp = client.get("/api/weekly-review/inbox")
    assert resp.status_code == 200
    tasks = resp.json()
    assert len(tasks) == 2
    titles = {t["title"] for t in tasks}
    assert "Inbox task 1" in titles
    assert "Inbox task 2" in titles
    assert "Project task" not in titles


def test_review_inbox_excludes_complete_tasks(client):
    """Completed inbox tasks do not appear in review inbox."""
    task = _create_task(client, "Done task")
    client.post(f"/api/tasks/{task['id']}/complete", headers=HEADERS)
    resp = client.get("/api/weekly-review/inbox")
    assert resp.status_code == 200
    assert len(resp.json()) == 0


# ---------------------------------------------------------------------------
# Projects endpoint
# ---------------------------------------------------------------------------

def test_review_projects_returns_active_projects(client):
    """GET /projects returns active non-archived projects."""
    p1 = _create_project(client)
    p2 = client.post("/api/items", json={"type": "project", "title": "P2"}, headers=HEADERS).json()
    # Archive p2 — should not appear
    client.post(f"/api/items/{p2['id']}/archive", headers=HEADERS)

    resp = client.get(f"/api/weekly-review/projects?today={TODAY}")
    assert resp.status_code == 200
    projects = resp.json()
    ids = [p["id"] for p in projects]
    assert p1["id"] in ids
    assert p2["id"] not in ids


def test_review_projects_includes_staleness(client):
    """Projects response includes days_since_update and is_stale."""
    _create_project(client)
    resp = client.get(f"/api/weekly-review/projects?today={TODAY}")
    project = resp.json()[0]
    assert "days_since_update" in project
    assert "is_stale" in project
    # Just created: should not be stale
    assert project["is_stale"] is False


# ---------------------------------------------------------------------------
# Areas endpoint
# ---------------------------------------------------------------------------

def test_review_areas_returns_active_areas(client):
    """GET /areas returns active non-archived areas."""
    a1 = client.post("/api/items", json={"type": "area", "title": "Work"}, headers=HEADERS).json()
    resp = client.get(f"/api/weekly-review/areas?today={TODAY}")
    assert resp.status_code == 200
    ids = [a["id"] for a in resp.json()]
    assert a1["id"] in ids


def test_review_areas_shows_next_task(client):
    """Areas response shows next_task_title for areas with open tasks."""
    area = client.post("/api/items", json={"type": "area", "title": "Home"}, headers=HEADERS).json()
    _create_task(client, "Fix roof", item_id=area["id"])

    resp = client.get(f"/api/weekly-review/areas?today={TODAY}")
    area_data = next(a for a in resp.json() if a["id"] == area["id"])
    assert area_data["next_task_title"] == "Fix roof"
    assert area_data["open_task_count"] == 1


# ---------------------------------------------------------------------------
# Resources endpoint
# ---------------------------------------------------------------------------

def test_review_resources_sorted_least_recently_updated(client):
    """GET /resources returns resources sorted by least recently updated."""
    r1 = client.post("/api/items", json={"type": "resource", "title": "Oldest"}, headers=HEADERS).json()
    r2 = client.post("/api/items", json={"type": "resource", "title": "Newest"}, headers=HEADERS).json()
    # Update r2 to make it more recently updated
    client.put(f"/api/items/{r2['id']}", json={"description": "updated"}, headers=HEADERS)

    resp = client.get(f"/api/weekly-review/resources?today={TODAY}")
    assert resp.status_code == 200
    resources = resp.json()
    # r1 should appear before r2 (older)
    ids = [r["id"] for r in resources]
    assert ids.index(r1["id"]) < ids.index(r2["id"])


# ---------------------------------------------------------------------------
# Complete endpoint
# ---------------------------------------------------------------------------

def test_complete_review(client):
    """POST /complete creates a review record."""
    resp = client.post(
        "/api/weekly-review/complete",
        json={"notes": "Good week!"},
        headers=HEADERS,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["notes"] == "Good week!"
    assert "completed_at" in body
    assert "id" in body


def test_complete_review_empty_notes(client):
    """Review can be completed with empty notes."""
    resp = client.post(
        "/api/weekly-review/complete",
        json={"notes": ""},
        headers=HEADERS,
    )
    assert resp.status_code == 201
    assert resp.json()["notes"] == ""


def test_complete_review_notes_too_long(client):
    """Notes exceeding 500 chars are rejected."""
    resp = client.post(
        "/api/weekly-review/complete",
        json={"notes": "x" * 501},
        headers=HEADERS,
    )
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# History endpoint
# ---------------------------------------------------------------------------

def test_review_history(client):
    """GET /history returns past reviews."""
    client.post("/api/weekly-review/complete", json={"notes": "Week 1"}, headers=HEADERS)
    client.post("/api/weekly-review/complete", json={"notes": "Week 2"}, headers=HEADERS)

    resp = client.get("/api/weekly-review/history")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    assert len(body["reviews"]) == 2


# ---------------------------------------------------------------------------
# Property P16: Weekly Review Action Persistence
# ---------------------------------------------------------------------------

def test_p16_task_completion_saved_immediately(client):
    """P16: Completing a task during review persists immediately to DB.

    Even if the review is never completed (Exit review), the task
    completion is preserved.
    """
    task = _create_task(client, "Persistent task")

    # Simulate completing task during review (via existing tasks API)
    complete_resp = client.post(f"/api/tasks/{task['id']}/complete", headers=HEADERS)
    assert complete_resp.status_code == 200

    # Verify task is complete WITHOUT completing the review
    get_resp = client.get(f"/api/tasks/{task['id']}")
    assert get_resp.json()["is_complete"] is True

    # No review record created (exit review without completing)
    history_resp = client.get("/api/weekly-review/history")
    assert history_resp.json()["total"] == 0


def test_p16_task_move_saved_immediately(client):
    """P16: Moving inbox task to a project persists immediately, not on review completion."""
    project = _create_project(client)
    task = _create_task(client, "Inbox task to move")

    # Move task during review
    move_resp = client.post(
        f"/api/tasks/{task['id']}/move",
        json={"item_id": project["id"]},
        headers=HEADERS,
    )
    assert move_resp.status_code == 200

    # Verify task is now in project, NOT in inbox
    inbox_resp = client.get("/api/tasks/inbox")
    inbox_ids = [t["id"] for t in inbox_resp.json()]
    assert task["id"] not in inbox_ids

    project_tasks_resp = client.get(f"/api/items/{project['id']}/tasks")
    project_task_ids = [t["id"] for t in project_tasks_resp.json()]
    assert task["id"] in project_task_ids

    # Exit review (no POST to complete) — verify changes persist
    history_resp = client.get("/api/weekly-review/history")
    assert history_resp.json()["total"] == 0   # no review record
    # Task is still in project — persistent
    final_task = client.get(f"/api/tasks/{task['id']}").json()
    assert final_task["item_id"] == project["id"]


def test_p16_dashboard_last_review_date_updates(client):
    """P16/R10.13: After completing review, dashboard reflects new last_review_date."""
    # Dashboard shows None before any review
    dash_before = client.get(f"/api/dashboard?today={TODAY}").json()
    assert dash_before["last_review_date"] is None

    # Complete a review
    client.post("/api/weekly-review/complete", json={"notes": ""}, headers=HEADERS)

    # Dashboard now shows today
    dash_after = client.get(f"/api/dashboard?today={TODAY}").json()
    assert dash_after["last_review_date"] == TODAY
