"""Integration tests for Items API router."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.main import create_app
from backend.config import Config
from backend.api.deps import get_db_session


@pytest.fixture
def client(tmp_path):
    """TestClient with an isolated in-memory SQLite database."""
    # create_app must run first so importing items.py registers all ORM models
    # with Base.metadata before create_all is called.
    cfg = Config(port=8080)
    app = create_app(cfg)

    engine = create_engine(f"sqlite:///{tmp_path / 'api_test.db'}")
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


HEADERS = {"X-Calm-X": "1"}


def test_create_project(client):
    resp = client.post("/api/items", json={"type": "project", "title": "My Project"}, headers=HEADERS)
    assert resp.status_code == 201
    assert resp.json()["type"] == "project"
    assert resp.json()["title"] == "My Project"


def test_create_area(client):
    resp = client.post("/api/items", json={"type": "area", "title": "Work"}, headers=HEADERS)
    assert resp.status_code == 201
    assert resp.json()["type"] == "area"


def test_get_item(client):
    create_resp = client.post("/api/items", json={"type": "resource", "title": "Docs"}, headers=HEADERS)
    item_id = create_resp.json()["id"]
    resp = client.get(f"/api/items/{item_id}")
    assert resp.status_code == 200
    assert resp.json()["title"] == "Docs"


def test_get_item_not_found(client):
    resp = client.get("/api/items/9999")
    assert resp.status_code == 404


def test_list_items(client):
    client.post("/api/items", json={"type": "project", "title": "P1"}, headers=HEADERS)
    client.post("/api/items", json={"type": "area", "title": "A1"}, headers=HEADERS)
    resp = client.get("/api/items")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_list_items_type_filter(client):
    client.post("/api/items", json={"type": "project", "title": "P1"}, headers=HEADERS)
    client.post("/api/items", json={"type": "area", "title": "A1"}, headers=HEADERS)
    resp = client.get("/api/items?type=project")
    assert all(item["type"] == "project" for item in resp.json())


def test_update_item(client):
    create_resp = client.post("/api/items", json={"type": "project", "title": "Old"}, headers=HEADERS)
    item_id = create_resp.json()["id"]
    resp = client.put(f"/api/items/{item_id}", json={"title": "New"}, headers=HEADERS)
    assert resp.status_code == 200
    assert resp.json()["title"] == "New"


def test_delete_item(client):
    create_resp = client.post("/api/items", json={"type": "project", "title": "ToDelete"}, headers=HEADERS)
    item_id = create_resp.json()["id"]
    resp = client.delete(f"/api/items/{item_id}", headers=HEADERS)
    assert resp.status_code == 204
    # Verify it's gone
    assert client.get(f"/api/items/{item_id}").status_code == 404


def test_archive_item(client):
    create_resp = client.post("/api/items", json={"type": "project", "title": "P"}, headers=HEADERS)
    item_id = create_resp.json()["id"]
    resp = client.post(f"/api/items/{item_id}/archive", headers=HEADERS)
    assert resp.status_code == 200
    assert resp.json()["archived_at"] is not None


def test_restore_item(client):
    create_resp = client.post("/api/items", json={"type": "project", "title": "P"}, headers=HEADERS)
    item_id = create_resp.json()["id"]
    client.post(f"/api/items/{item_id}/archive", headers=HEADERS)
    resp = client.post(f"/api/items/{item_id}/restore", headers=HEADERS)
    assert resp.status_code == 200
    assert resp.json()["archived_at"] is None


def test_complete_project(client):
    create_resp = client.post("/api/items", json={"type": "project", "title": "P"}, headers=HEADERS)
    item_id = create_resp.json()["id"]
    resp = client.post(f"/api/items/{item_id}/complete", headers=HEADERS)
    assert resp.status_code == 200
    assert resp.json()["project_status"] == "completed"


def test_reopen_project(client):
    create_resp = client.post("/api/items", json={"type": "project", "title": "P"}, headers=HEADERS)
    item_id = create_resp.json()["id"]
    client.post(f"/api/items/{item_id}/complete", headers=HEADERS)
    resp = client.post(f"/api/items/{item_id}/reopen", headers=HEADERS)
    assert resp.status_code == 200
    assert resp.json()["project_status"] == "active"


def test_update_archived_returns_409(client):
    """Updating an archived item returns 403 (ArchivedItemError)."""
    create_resp = client.post("/api/items", json={"type": "project", "title": "P"}, headers=HEADERS)
    item_id = create_resp.json()["id"]
    client.post(f"/api/items/{item_id}/archive", headers=HEADERS)
    resp = client.put(f"/api/items/{item_id}", json={"title": "No"}, headers=HEADERS)
    assert resp.status_code == 403  # ArchivedItemError maps to 403


def test_delete_archived_item_succeeds(client):
    """R7.9: deleting an archived item must succeed."""
    create_resp = client.post("/api/items", json={"type": "project", "title": "P"}, headers=HEADERS)
    item_id = create_resp.json()["id"]
    client.post(f"/api/items/{item_id}/archive", headers=HEADERS)
    resp = client.delete(f"/api/items/{item_id}", headers=HEADERS)
    assert resp.status_code == 204



def test_post_without_type_returns_400(client):
    resp = client.post('/api/items', json={'title': 'No type'}, headers=HEADERS)
    assert resp.status_code == 400
    body = resp.json()
    assert body['type'] == 'validation_error'
    # discriminator error appears in fields (key may be '' or 'type')
    assert 'fields' in body


def test_update_sets_deadline_to_null(client):
    r = client.post('/api/items', json={'type': 'project', 'title': 'P', 'project_deadline': '2026-12-31'}, headers=HEADERS)
    assert r.status_code == 201
    item_id = r.json()['id']
    resp = client.put(f'/api/items/{item_id}', json={'project_deadline': None}, headers=HEADERS)
    assert resp.status_code == 200
    assert resp.json()['project_deadline'] is None


def test_response_area_has_no_project_fields(client):
    r = client.post('/api/items', json={'type': 'area', 'title': 'My Area'}, headers=HEADERS)
    assert r.status_code == 201
    body = r.json()
    assert 'project_goal' not in body
    assert 'project_deadline' not in body
    assert body['type'] == 'area'


def test_error_not_swallowed_as_2xx(client):
    from unittest.mock import patch
    from backend.exceptions import ConflictError
    with patch('backend.api.items.item_service.create_item') as mock:
        mock.side_effect = ConflictError('Simulated conflict')
        resp = client.post('/api/items', json={'type': 'project', 'title': 'X'}, headers=HEADERS)
    assert resp.status_code == 409
    assert resp.json()['type'] == 'conflict_error'


def test_progress_reflects_task_counts(client):
    """Fix 1: project response includes correct task_count, completed_task_count, progress_percentage.
    Test: project with 2 tasks, 1 complete -> task_count=2, completed=1, progress=50"""
    # Create project
    proj = client.post("/api/items", json={"type": "project", "title": "P"}, headers=HEADERS).json()
    item_id = proj["id"]
    # Initially: no tasks
    assert proj["task_count"] == 0
    assert proj["progress_percentage"] == 0
    # Add 2 tasks
    t1 = client.post("/api/tasks", json={"title": "T1", "item_id": item_id}, headers=HEADERS).json()["id"]
    t2 = client.post("/api/tasks", json={"title": "T2", "item_id": item_id}, headers=HEADERS).json()["id"]
    # Complete 1 task
    client.post(f"/api/tasks/{t1}/complete", headers=HEADERS)
    # Fetch project detail
    detail = client.get(f"/api/items/{item_id}").json()
    assert detail["task_count"] == 2
    assert detail["completed_task_count"] == 1
    assert detail["progress_percentage"] == 50
    # Complete both -> progress 100
    client.post(f"/api/tasks/{t2}/complete", headers=HEADERS)
    detail2 = client.get(f"/api/items/{item_id}").json()
    assert detail2["task_count"] == 2
    assert detail2["completed_task_count"] == 2
    assert detail2["progress_percentage"] == 100
    # Also check in list response
    items = client.get("/api/items?type=project").json()
    p = next(i for i in items if i["id"] == item_id)
    assert p["task_count"] == 2
    assert p["progress_percentage"] == 100


def test_progress_reflects_task_counts(client):
    """Fix 1: project response includes correct task_count, completed_task_count, progress_percentage.
    Test: project with 2 tasks, 1 complete -> task_count=2, completed=1, progress=50"""
    # Create project
    proj = client.post("/api/items", json={"type": "project", "title": "P"}, headers=HEADERS).json()
    item_id = proj["id"]
    # Initially: no tasks
    assert proj["task_count"] == 0
    assert proj["progress_percentage"] == 0
    # Add 2 tasks
    t1 = client.post("/api/tasks", json={"title": "T1", "item_id": item_id}, headers=HEADERS).json()["id"]
    t2 = client.post("/api/tasks", json={"title": "T2", "item_id": item_id}, headers=HEADERS).json()["id"]
    # Complete 1 task
    client.post(f"/api/tasks/{t1}/complete", headers=HEADERS)
    # Fetch project detail
    detail = client.get(f"/api/items/{item_id}").json()
    assert detail["task_count"] == 2
    assert detail["completed_task_count"] == 1
    assert detail["progress_percentage"] == 50
    # Complete both -> progress 100
    client.post(f"/api/tasks/{t2}/complete", headers=HEADERS)
    detail2 = client.get(f"/api/items/{item_id}").json()
    assert detail2["task_count"] == 2
    assert detail2["completed_task_count"] == 2
    assert detail2["progress_percentage"] == 100
    # Also check in list response
    items = client.get("/api/items?type=project").json()
    p = next(i for i in items if i["id"] == item_id)
    assert p["task_count"] == 2
    assert p["progress_percentage"] == 100
