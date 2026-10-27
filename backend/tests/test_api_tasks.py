"""Integration tests for Tasks and Subtasks API."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.api.deps import get_db_session
from backend.config import Config
from backend.database import Base
from backend.main import create_app


@pytest.fixture
def client(tmp_path):
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


def _create_item(client, title="Project"):
    r = client.post("/api/items", json={"type": "project", "title": title}, headers=HEADERS)
    assert r.status_code == 201
    return r.json()["id"]


def test_create_task(client):
    resp = client.post("/api/tasks", json={"title": "My task"}, headers=HEADERS)
    assert resp.status_code == 201
    assert resp.json()["title"] == "My task"
    assert resp.json()["item_id"] is None  # Inbox


def test_create_task_on_item(client):
    item_id = _create_item(client)
    resp = client.post("/api/tasks", json={"title": "Task", "item_id": item_id}, headers=HEADERS)
    assert resp.status_code == 201
    assert resp.json()["item_id"] == item_id


def test_list_inbox_tasks(client):
    client.post("/api/tasks", json={"title": "Inbox 1"}, headers=HEADERS)
    resp = client.get("/api/tasks/inbox")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


def test_mark_task_complete(client):
    r = client.post("/api/tasks", json={"title": "T"}, headers=HEADERS)
    task_id = r.json()["id"]
    resp = client.post(f"/api/tasks/{task_id}/complete", headers=HEADERS)
    assert resp.status_code == 200
    assert resp.json()["is_complete"] is True


def test_mark_task_incomplete(client):
    r = client.post("/api/tasks", json={"title": "T"}, headers=HEADERS)
    task_id = r.json()["id"]
    client.post(f"/api/tasks/{task_id}/complete", headers=HEADERS)
    resp = client.post(f"/api/tasks/{task_id}/incomplete", headers=HEADERS)
    assert resp.json()["is_complete"] is False


def test_move_task(client):
    item_id = _create_item(client)
    r = client.post("/api/tasks", json={"title": "T"}, headers=HEADERS)
    task_id = r.json()["id"]
    resp = client.post(f"/api/tasks/{task_id}/move", json={"item_id": item_id}, headers=HEADERS)
    assert resp.status_code == 200
    assert resp.json()["item_id"] == item_id


def test_delete_task(client):
    r = client.post("/api/tasks", json={"title": "T"}, headers=HEADERS)
    task_id = r.json()["id"]
    resp = client.delete(f"/api/tasks/{task_id}", headers=HEADERS)
    assert resp.status_code == 204


def test_create_subtask(client):
    r = client.post("/api/tasks", json={"title": "Task"}, headers=HEADERS)
    task_id = r.json()["id"]
    resp = client.post(f"/api/tasks/{task_id}/subtasks", json={"title": "Sub"}, headers=HEADERS)
    assert resp.status_code == 201
    assert resp.json()["title"] == "Sub"


def test_mark_subtask_complete(client):
    r = client.post("/api/tasks", json={"title": "T"}, headers=HEADERS)
    task_id = r.json()["id"]
    s = client.post(f"/api/tasks/{task_id}/subtasks", json={"title": "Sub"}, headers=HEADERS)
    sub_id = s.json()["id"]
    resp = client.post(f"/api/subtasks/{sub_id}/complete", headers=HEADERS)
    assert resp.status_code == 200
    assert resp.json()["is_complete"] is True


def test_subtask_complete_auto_completes_task(client):
    """API integration: completing last subtask auto-completes the task."""
    r = client.post("/api/tasks", json={"title": "T"}, headers=HEADERS)
    task_id = r.json()["id"]
    s = client.post(f"/api/tasks/{task_id}/subtasks", json={"title": "Only sub"}, headers=HEADERS)
    sub_id = s.json()["id"]
    client.post(f"/api/subtasks/{sub_id}/complete", headers=HEADERS)
    task_resp = client.get(f"/api/tasks/{task_id}")
    assert task_resp.json()["is_complete"] is True


def test_create_task_without_type_is_inbox(client):
    resp = client.post("/api/tasks", json={"title": "Inbox task"}, headers=HEADERS)
    assert resp.status_code == 201
    assert resp.json()["item_id"] is None


def test_reorder_tasks(client):
    item_id = _create_item(client)
    t1 = client.post("/api/tasks", json={"title": "T1", "item_id": item_id}, headers=HEADERS).json()["id"]
    t2 = client.post("/api/tasks", json={"title": "T2", "item_id": item_id}, headers=HEADERS).json()["id"]
    resp = client.put(f"/api/items/{item_id}/tasks/reorder", json={"task_ids": [t2, t1]}, headers=HEADERS)
    assert resp.status_code == 200
    tasks = resp.json()
    assert tasks[0]["id"] == t2
    assert tasks[1]["id"] == t1
