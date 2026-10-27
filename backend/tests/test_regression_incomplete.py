"""Regression 3.40: POST /tasks/{id}/incomplete persists is_complete=False."""
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
    engine = create_engine(f"sqlite:///{tmp_path / 'reg.db'}")
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


def test_incomplete_persists_false(client):
    """Regression 3.40: /incomplete sets and persists is_complete=False."""
    # Create task
    r = client.post("/api/tasks", json={"title": "Complete me"}, headers=HEADERS)
    task_id = r.json()["id"]
    # Complete it
    client.post(f"/api/tasks/{task_id}/complete", headers=HEADERS)
    # Add subtask so we also test subtask cascade
    client.post(f"/api/tasks/{task_id}/subtasks", json={"title": "Sub"}, headers=HEADERS)
    # Mark incomplete
    resp = client.post(f"/api/tasks/{task_id}/incomplete", headers=HEADERS)
    assert resp.status_code == 200
    assert resp.json()["is_complete"] is False
    # Reload from API to confirm persistence
    reloaded = client.get(f"/api/tasks/{task_id}")
    assert reloaded.json()["is_complete"] is False
    # Subtask also reset
    subs = client.get(f"/api/tasks/{task_id}/subtasks")
    assert all(s["is_complete"] is False for s in subs.json())


def test_incomplete_resets_subtasks(client):
    """Regression 3.40: all subtasks also reset to incomplete."""
    r = client.post("/api/tasks", json={"title": "Task"}, headers=HEADERS)
    task_id = r.json()["id"]
    s1 = client.post(f"/api/tasks/{task_id}/subtasks", json={"title": "S1"}, headers=HEADERS).json()["id"]
    s2 = client.post(f"/api/tasks/{task_id}/subtasks", json={"title": "S2"}, headers=HEADERS).json()["id"]
    # Complete all
    client.post(f"/api/tasks/{task_id}/complete", headers=HEADERS)
    # Mark task incomplete
    client.post(f"/api/tasks/{task_id}/incomplete", headers=HEADERS)
    subs = client.get(f"/api/tasks/{task_id}/subtasks")
    assert all(s["is_complete"] is False for s in subs.json())
