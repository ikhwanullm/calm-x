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


def test_quick_capture_json_body(client):
    """Fix 8: quick-capture accepts JSON body {title}, creates Inbox task."""
    resp = client.post(
        "/api/tasks/quick-capture",
        json={"title": "Captured task"},
        headers=HEADERS,
    )
    assert resp.status_code == 201, resp.json()
    body = resp.json()
    assert body["title"] == "Captured task"
    assert body["item_id"] is None
    assert body["priority"] == "medium"


def test_inbox_not_limited_at_100(client):
    """Fix 5: Inbox (item_id=None) can exceed 100 tasks."""
    # Create 101 Inbox tasks - all should succeed
    for i in range(101):
        resp = client.post("/api/tasks", json={"title": f"Inbox {i}"}, headers=HEADERS)
        assert resp.status_code == 201, f"Task {i} failed: {resp.json()}"
    # Verify inbox count
    resp = client.get("/api/tasks/inbox")
    assert len(resp.json()) == 101


def test_reorder_archived_item_rejected(client):
    """Fix 6: reordering tasks in archived item returns 403."""
    # Create item, add tasks, archive item
    item_id = _create_item(client, "ReorderTarget")
    t1 = client.post("/api/tasks", json={"title": "T1", "item_id": item_id}, headers=HEADERS).json()["id"]
    t2 = client.post("/api/tasks", json={"title": "T2", "item_id": item_id}, headers=HEADERS).json()["id"]
    client.post(f"/api/items/{item_id}/archive", headers=HEADERS)
    resp = client.put(f"/api/items/{item_id}/tasks/reorder", json={"task_ids": [t2, t1]}, headers=HEADERS)
    assert resp.status_code == 403


def test_reorder_invalid_task_ids_rejected(client):
    """Fix 6: task_ids not belonging to item returns 400."""
    item_id = _create_item(client, "ItemA")
    other_item_id = _create_item(client, "ItemB")
    ta = client.post("/api/tasks", json={"title": "TA", "item_id": item_id}, headers=HEADERS).json()["id"]
    tb = client.post("/api/tasks", json={"title": "TB", "item_id": other_item_id}, headers=HEADERS).json()["id"]
    # Try to reorder item_id with a task belonging to other_item_id
    resp = client.put(f"/api/items/{item_id}/tasks/reorder", json={"task_ids": [ta, tb]}, headers=HEADERS)
    assert resp.status_code == 400


def test_create_task_with_tags(client):
    """Fix 2: creating a task with tag_names assigns tags and returns them."""
    resp = client.post("/api/tasks", json={"title": "Tagged", "tag_names": ["work", "urgent"]}, headers=HEADERS)
    assert resp.status_code == 201
    body = resp.json()
    assert set(body["tags"]) == {"work", "urgent"}


def test_update_task_tags_replaces(client):
    """Fix 2: updating tag_names replaces all existing tags."""
    r = client.post("/api/tasks", json={"title": "T", "tag_names": ["old"]}, headers=HEADERS)
    task_id = r.json()["id"]
    resp = client.put(f"/api/tasks/{task_id}", json={"tag_names": ["new1", "new2"]}, headers=HEADERS)
    assert resp.status_code == 200
    tags = resp.json()["tags"]
    assert "old" not in tags
    assert set(tags) == {"new1", "new2"}


def test_clear_task_tags(client):
    """Fix 2: setting tag_names=[] clears all tags."""
    r = client.post("/api/tasks", json={"title": "T", "tag_names": ["x"]}, headers=HEADERS)
    task_id = r.json()["id"]
    resp = client.put(f"/api/tasks/{task_id}", json={"tag_names": []}, headers=HEADERS)
    assert resp.json()["tags"] == []


def test_quick_capture_empty_title_returns_400(client):
    """Fix 5: quick-capture with empty title returns 400, not 500."""
    resp = client.post("/api/tasks/quick-capture", json={"title": ""}, headers=HEADERS)
    assert resp.status_code == 422 or resp.status_code == 400, resp.json()


def test_quick_capture_whitespace_title_returns_400(client):
    """Fix 5: quick-capture with whitespace-only title returns 400."""
    resp = client.post("/api/tasks/quick-capture", json={"title": "   "}, headers=HEADERS)
    assert resp.status_code == 422 or resp.status_code == 400, resp.json()


def test_update_task_21_tags_rejected(client):
    """Fix 6: TaskUpdate with 21 tags returns 400/422."""
    r = client.post("/api/tasks", json={"title": "T"}, headers=HEADERS)
    task_id = r.json()["id"]
    tags = [f"tag{i}" for i in range(21)]
    resp = client.put(f"/api/tasks/{task_id}", json={"tag_names": tags}, headers=HEADERS)
    assert resp.status_code in (400, 422), resp.json()


def test_update_task_20_tags_accepted(client):
    """Fix 6: TaskUpdate with exactly 20 tags is allowed."""
    r = client.post("/api/tasks", json={"title": "T"}, headers=HEADERS)
    task_id = r.json()["id"]
    tags = [f"tag{i}" for i in range(20)]
    resp = client.put(f"/api/tasks/{task_id}", json={"tag_names": tags}, headers=HEADERS)
    assert resp.status_code == 200
    assert len(resp.json()["tags"]) == 20


def test_create_task_on_resource_rejected(client):
    """R3.7: cannot create a task whose item_id points to a Resource."""
    resource = client.post("/api/items", json={"type": "resource", "title": "R"}, headers=HEADERS).json()
    r = client.post("/api/tasks", json={"title": "T", "item_id": resource["id"]}, headers=HEADERS)
    assert r.status_code == 400
    body = r.json()
    assert "error" in body
    assert "type" in body


def test_move_task_to_resource_rejected(client):
    """R3.7: cannot move a task to a Resource."""
    resource = client.post("/api/items", json={"type": "resource", "title": "R"}, headers=HEADERS).json()
    task = client.post("/api/tasks", json={"title": "T"}, headers=HEADERS).json()
    r = client.post(f"/api/tasks/{task['id']}/move", json={"item_id": resource["id"]}, headers=HEADERS)
    assert r.status_code == 400
    body = r.json()
    assert "error" in body
