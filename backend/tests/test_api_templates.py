"""Integration tests for Templates API router."""
from datetime import date, timedelta

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


# ---------------------------------------------------------------------------
# Template CRUD tests
# ---------------------------------------------------------------------------

def test_create_template_empty(client):
    """Create a template with no tasks."""
    resp = client.post(
        "/api/templates",
        json={"title": "Empty Template", "description": "No tasks yet"},
        headers=HEADERS,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Empty Template"
    assert data["description"] == "No tasks yet"
    assert data["task_count"] == 0
    assert data["tasks"] == []


def test_create_template_with_tasks(client):
    """Create a template with initial tasks."""
    resp = client.post(
        "/api/templates",
        json={
            "title": "Project Kickoff",
            "description": "Standard project setup",
            "tasks": [
                {"title": "Define requirements", "relative_days": 0, "priority": "high"},
                {"title": "Create project plan", "relative_days": 3, "priority": "medium"},
                {"title": "Kickoff meeting", "relative_days": 7, "priority": "high"},
            ],
        },
        headers=HEADERS,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Project Kickoff"
    assert data["task_count"] == 3
    assert len(data["tasks"]) == 3
    assert data["tasks"][0]["title"] == "Define requirements"
    assert data["tasks"][0]["relative_days"] == 0
    assert data["tasks"][1]["relative_days"] == 3
    assert data["tasks"][2]["relative_days"] == 7


def test_create_template_exceeds_50_tasks(client):
    """Creating a template with more than 50 tasks should fail."""
    tasks = [{"title": f"Task {i}", "relative_days": i % 30} for i in range(51)]
    resp = client.post(
        "/api/templates",
        json={"title": "Too Many Tasks", "tasks": tasks},
        headers=HEADERS,
    )
    assert resp.status_code == 400
    # Pydantic validation error
    data = resp.json()
    assert "error" in data
    # Either Pydantic or service-level error message
    assert "50" in str(data) or "tasks" in str(data)


def test_list_templates(client):
    """List all templates."""
    client.post("/api/templates", json={"title": "Template A"}, headers=HEADERS)
    client.post("/api/templates", json={"title": "Template B"}, headers=HEADERS)

    resp = client.get("/api/templates")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    # Ordered by title
    assert data[0]["title"] == "Template A"
    assert data[1]["title"] == "Template B"


def test_get_template(client):
    """Get a single template with tasks."""
    create_resp = client.post(
        "/api/templates",
        json={
            "title": "Test Template",
            "tasks": [{"title": "Task 1", "relative_days": 5}],
        },
        headers=HEADERS,
    )
    template_id = create_resp.json()["id"]

    resp = client.get(f"/api/templates/{template_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Test Template"
    assert len(data["tasks"]) == 1
    assert data["tasks"][0]["title"] == "Task 1"


def test_get_template_not_found(client):
    """Getting a non-existent template returns 404."""
    resp = client.get("/api/templates/9999")
    assert resp.status_code == 404


def test_update_template(client):
    """Update a template's title and description."""
    create_resp = client.post(
        "/api/templates",
        json={"title": "Old Title", "description": "Old desc"},
        headers=HEADERS,
    )
    template_id = create_resp.json()["id"]

    resp = client.put(
        f"/api/templates/{template_id}",
        json={"title": "New Title", "description": "New desc"},
        headers=HEADERS,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "New Title"
    assert data["description"] == "New desc"


def test_delete_template(client):
    """Delete a template."""
    create_resp = client.post(
        "/api/templates",
        json={"title": "To Delete"},
        headers=HEADERS,
    )
    template_id = create_resp.json()["id"]

    resp = client.delete(f"/api/templates/{template_id}", headers=HEADERS)
    assert resp.status_code == 204

    # Verify it's gone
    assert client.get(f"/api/templates/{template_id}").status_code == 404


# ---------------------------------------------------------------------------
# Template Task CRUD tests
# ---------------------------------------------------------------------------

def test_add_task_to_template(client):
    """Add a task to an existing template."""
    create_resp = client.post(
        "/api/templates",
        json={"title": "My Template"},
        headers=HEADERS,
    )
    template_id = create_resp.json()["id"]

    resp = client.post(
        f"/api/templates/{template_id}/tasks",
        json={"title": "New Task", "relative_days": 14, "priority": "low"},
        headers=HEADERS,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "New Task"
    assert data["relative_days"] == 14
    assert data["priority"] == "low"
    assert data["template_id"] == template_id


def test_add_task_exceeds_50_limit(client):
    """Adding a task when template already has 50 should fail."""
    tasks = [{"title": f"Task {i}", "relative_days": 0} for i in range(50)]
    create_resp = client.post(
        "/api/templates",
        json={"title": "Full Template", "tasks": tasks},
        headers=HEADERS,
    )
    template_id = create_resp.json()["id"]

    resp = client.post(
        f"/api/templates/{template_id}/tasks",
        json={"title": "One too many"},
        headers=HEADERS,
    )
    assert resp.status_code == 400
    assert "50" in resp.json()["error"]


def test_update_template_task(client):
    """Update a template task."""
    create_resp = client.post(
        "/api/templates",
        json={
            "title": "Template",
            "tasks": [{"title": "Original", "relative_days": 5}],
        },
        headers=HEADERS,
    )
    task_id = create_resp.json()["tasks"][0]["id"]

    resp = client.put(
        f"/api/templates/tasks/{task_id}",
        json={"title": "Updated", "relative_days": 10, "priority": "high"},
        headers=HEADERS,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Updated"
    assert data["relative_days"] == 10
    assert data["priority"] == "high"


def test_delete_template_task(client):
    """Delete a template task."""
    create_resp = client.post(
        "/api/templates",
        json={
            "title": "Template",
            "tasks": [{"title": "To Delete"}],
        },
        headers=HEADERS,
    )
    template_id = create_resp.json()["id"]
    task_id = create_resp.json()["tasks"][0]["id"]

    resp = client.delete(f"/api/templates/tasks/{task_id}", headers=HEADERS)
    assert resp.status_code == 204

    # Verify template task count is 0
    get_resp = client.get(f"/api/templates/{template_id}")
    assert get_resp.json()["task_count"] == 0


def test_reorder_template_tasks(client):
    """Reorder template tasks."""
    create_resp = client.post(
        "/api/templates",
        json={
            "title": "Template",
            "tasks": [
                {"title": "Task A"},
                {"title": "Task B"},
                {"title": "Task C"},
            ],
        },
        headers=HEADERS,
    )
    template_id = create_resp.json()["id"]
    tasks = create_resp.json()["tasks"]
    # Original order: A, B, C
    # New order: C, A, B
    new_order = [tasks[2]["id"], tasks[0]["id"], tasks[1]["id"]]

    resp = client.put(
        f"/api/templates/{template_id}/tasks/reorder",
        json={"task_ids": new_order},
        headers=HEADERS,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data[0]["title"] == "Task C"
    assert data[1]["title"] == "Task A"
    assert data[2]["title"] == "Task B"


# ---------------------------------------------------------------------------
# Create project from template tests
# ---------------------------------------------------------------------------

def test_create_project_from_template_basic(client):
    """Create a project from a template with calculated due dates."""
    create_resp = client.post(
        "/api/templates",
        json={
            "title": "Sprint Template",
            "description": "Two-week sprint",
            "tasks": [
                {"title": "Sprint planning", "relative_days": 0, "priority": "high"},
                {"title": "Daily standups", "relative_days": 1, "priority": "medium"},
                {"title": "Sprint review", "relative_days": 14, "priority": "high"},
            ],
        },
        headers=HEADERS,
    )
    template_id = create_resp.json()["id"]

    today = date.today()
    resp = client.post(
        f"/api/templates/{template_id}/create-project",
        json={
            "title": "Sprint 1",
            "start_date": today.isoformat(),
            "project_goal": "Complete MVP",
            "project_deadline": (today + timedelta(days=14)).isoformat(),
        },
        headers=HEADERS,
    )
    assert resp.status_code == 201
    project = resp.json()
    assert project["type"] == "project"
    assert project["title"] == "Sprint 1"
    assert project["project_goal"] == "Complete MVP"
    assert project["description"] == "Two-week sprint"  # Copied from template

    # Verify tasks were created
    tasks_resp = client.get(f"/api/items/{project['id']}/tasks")
    tasks = tasks_resp.json()
    assert len(tasks) == 3

    # Check due dates are calculated correctly
    task_map = {t["title"]: t for t in tasks}
    assert task_map["Sprint planning"]["due_date"] == today.isoformat()
    assert task_map["Daily standups"]["due_date"] == (today + timedelta(days=1)).isoformat()
    assert task_map["Sprint review"]["due_date"] == (today + timedelta(days=14)).isoformat()


def test_create_project_from_template_defaults_start_date(client):
    """When start_date is not provided, it defaults to today."""
    create_resp = client.post(
        "/api/templates",
        json={
            "title": "Quick Template",
            "tasks": [{"title": "Day 0 task", "relative_days": 0}],
        },
        headers=HEADERS,
    )
    template_id = create_resp.json()["id"]

    resp = client.post(
        f"/api/templates/{template_id}/create-project",
        json={"title": "Auto Start Date Project"},
        headers=HEADERS,
    )
    assert resp.status_code == 201
    project = resp.json()

    # Verify task has today's date
    tasks_resp = client.get(f"/api/items/{project['id']}/tasks")
    tasks = tasks_resp.json()
    assert tasks[0]["due_date"] == date.today().isoformat()


def test_create_project_from_template_preserves_priority(client):
    """Task priorities from template are preserved in created project."""
    create_resp = client.post(
        "/api/templates",
        json={
            "title": "Priority Template",
            "tasks": [
                {"title": "High priority", "priority": "high"},
                {"title": "Low priority", "priority": "low"},
            ],
        },
        headers=HEADERS,
    )
    template_id = create_resp.json()["id"]

    resp = client.post(
        f"/api/templates/{template_id}/create-project",
        json={"title": "Priority Project"},
        headers=HEADERS,
    )
    project = resp.json()

    tasks_resp = client.get(f"/api/items/{project['id']}/tasks")
    tasks = tasks_resp.json()
    task_map = {t["title"]: t for t in tasks}
    assert task_map["High priority"]["priority"] == "high"
    assert task_map["Low priority"]["priority"] == "low"


def test_create_project_from_nonexistent_template(client):
    """Creating a project from a non-existent template returns 404."""
    resp = client.post(
        "/api/templates/9999/create-project",
        json={"title": "Orphan Project"},
        headers=HEADERS,
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Validation tests
# ---------------------------------------------------------------------------

def test_template_title_validation(client):
    """Template title must not be empty."""
    resp = client.post(
        "/api/templates",
        json={"title": "   "},
        headers=HEADERS,
    )
    assert resp.status_code == 400


def test_template_task_relative_days_range(client):
    """relative_days must be between 0 and 365."""
    # Negative
    resp = client.post(
        "/api/templates",
        json={
            "title": "Template",
            "tasks": [{"title": "Bad task", "relative_days": -1}],
        },
        headers=HEADERS,
    )
    assert resp.status_code == 400

    # Over 365
    resp = client.post(
        "/api/templates",
        json={
            "title": "Template",
            "tasks": [{"title": "Bad task", "relative_days": 400}],
        },
        headers=HEADERS,
    )
    assert resp.status_code == 400
