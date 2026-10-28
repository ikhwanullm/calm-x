"""Tests for GET /api/search (tasks 6.6, 6.7)."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.api.deps import get_db_session
from backend.config import Config
from backend.database import Base
from backend.main import create_app

HEADERS = {"X-Calm-X": "1"}


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


def test_search_returns_items(client):
    client.post("/api/items", json={"type": "project", "title": "Alpha project"}, headers=HEADERS)
    r = client.get("/api/search?q=Alpha")
    assert r.status_code == 200
    titles = [x["title"] for x in r.json()]
    assert any("Alpha" in t for t in titles)


def test_search_empty_query_returns_empty(client):
    client.post("/api/items", json={"type": "project", "title": "P"}, headers=HEADERS)
    r = client.get("/api/search?q=")
    assert r.status_code == 200
    assert r.json() == []


def test_search_escapes_percent(client):
    client.post("/api/items", json={"type": "project", "title": "50% done"}, headers=HEADERS)
    client.post("/api/items", json={"type": "area", "title": "Other"}, headers=HEADERS)
    r = client.get("/api/search?q=50%25")  # URL-encoded %
    results = r.json()
    assert any("50%" in x["title"] for x in results)
    # Must not return "Other" (which would happen if % was treated as wildcard)
    assert not any("Other" in x["title"] for x in results)


def test_search_escapes_underscore(client):
    client.post("/api/items", json={"type": "area", "title": "A_B test"}, headers=HEADERS)
    client.post("/api/items", json={"type": "area", "title": "ACB test"}, headers=HEADERS)
    r = client.get("/api/search?q=A_B")
    results = r.json()
    titles = [x["title"] for x in results]
    assert "A_B test" in titles
    assert "ACB test" not in titles


def test_search_archived_label(client):
    item = client.post("/api/items", json={"type": "project", "title": "Archived proj"}, headers=HEADERS).json()
    client.post(f"/api/items/{item['id']}/archive", headers=HEADERS)
    r = client.get("/api/search?q=Archived+proj")
    results = r.json()
    assert any("(Archived)" in x["title"] for x in results)


def test_search_tasks_by_title(client):
    client.post("/api/tasks", json={"title": "Find this task"}, headers=HEADERS)
    r = client.get("/api/search?q=Find+this")
    assert any(x["type"] == "task" and "Find this" in x["title"] for x in r.json())
