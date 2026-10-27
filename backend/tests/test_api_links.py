"""API integration tests for Reference Links, Resource Links, and Type Conversion."""
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
    factory = sessionmaker(bind=engine)

    def override():
        s = factory()
        try:
            yield s
            s.commit()
        except Exception:
            s.rollback()
            raise
        finally:
            s.close()

    app.dependency_overrides[get_db_session] = override
    return TestClient(app, base_url="http://localhost:8080", raise_server_exceptions=False)


def _create_item(client, item_type="project", title="P"):
    r = client.post(
        "/api/items", json={"type": item_type, "title": title}, headers=HEADERS
    )
    assert r.status_code == 201, r.json()
    return r.json()["id"]


# --- Reference links ---

def test_add_reference_link(client):
    item_id = _create_item(client)
    r = client.post(
        f"/api/items/{item_id}/links",
        json={"url": "https://example.com"},
        headers=HEADERS,
    )
    assert r.status_code == 201
    assert r.json()["url"] == "https://example.com"


def test_add_link_invalid_url_rejected(client):
    item_id = _create_item(client)
    r = client.post(
        f"/api/items/{item_id}/links",
        json={"url": "javascript:alert(1)"},
        headers=HEADERS,
    )
    assert r.status_code in (400, 422)


def test_add_link_data_url_rejected(client):
    item_id = _create_item(client)
    r = client.post(
        f"/api/items/{item_id}/links",
        json={"url": "data:text/html,<h1>XSS</h1>"},
        headers=HEADERS,
    )
    assert r.status_code in (400, 422)


def test_list_reference_links(client):
    item_id = _create_item(client)
    client.post(f"/api/items/{item_id}/links", json={"url": "https://a.com"}, headers=HEADERS)
    client.post(f"/api/items/{item_id}/links", json={"url": "https://b.com"}, headers=HEADERS)
    r = client.get(f"/api/items/{item_id}/links")
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_delete_reference_link(client):
    item_id = _create_item(client)
    link = client.post(
        f"/api/items/{item_id}/links",
        json={"url": "https://example.com"},
        headers=HEADERS,
    ).json()
    r = client.delete(f"/api/links/{link['id']}", headers=HEADERS)
    assert r.status_code == 204


def test_archived_item_cannot_add_link(client):
    item_id = _create_item(client)
    client.post(f"/api/items/{item_id}/archive", headers=HEADERS)
    r = client.post(
        f"/api/items/{item_id}/links",
        json={"url": "https://example.com"},
        headers=HEADERS,
    )
    assert r.status_code == 403


# --- Resource links ---

def test_link_resource_to_project(client):
    resource_id = _create_item(client, "resource", "R")
    project_id = _create_item(client, "project", "P")
    r = client.post(
        f"/api/resources/{resource_id}/link",
        json={"linked_item_id": project_id},
        headers=HEADERS,
    )
    assert r.status_code == 201
    assert r.json()["resource_id"] == resource_id
    assert r.json()["linked_item_id"] == project_id


def test_link_resource_to_resource_rejected(client):
    r1 = _create_item(client, "resource", "R1")
    r2 = _create_item(client, "resource", "R2")
    r = client.post(
        f"/api/resources/{r1}/link",
        json={"linked_item_id": r2},
        headers=HEADERS,
    )
    assert r.status_code == 400


def test_duplicate_resource_link_rejected(client):
    resource_id = _create_item(client, "resource", "R")
    project_id = _create_item(client, "project", "P")
    client.post(f"/api/resources/{resource_id}/link", json={"linked_item_id": project_id}, headers=HEADERS)
    r = client.post(f"/api/resources/{resource_id}/link", json={"linked_item_id": project_id}, headers=HEADERS)
    assert r.status_code == 409


def test_unlink_resource(client):
    resource_id = _create_item(client, "resource", "R")
    project_id = _create_item(client, "project", "P")
    client.post(f"/api/resources/{resource_id}/link", json={"linked_item_id": project_id}, headers=HEADERS)
    r = client.delete(f"/api/resources/{resource_id}/link/{project_id}", headers=HEADERS)
    assert r.status_code == 204


# --- Type Conversion ---

def test_convert_project_to_area(client):
    item_id = _create_item(client, "project", "P")
    r = client.post(f"/api/items/{item_id}/convert", json={"target_type": "area"}, headers=HEADERS)
    assert r.status_code == 200
    assert r.json()["type"] == "area"


def test_convert_area_to_project(client):
    item_id = _create_item(client, "area", "A")
    r = client.post(f"/api/items/{item_id}/convert", json={"target_type": "project"}, headers=HEADERS)
    assert r.status_code == 200
    assert r.json()["type"] == "project"
    assert r.json()["project_status"] == "active"


def test_convert_to_resource_moves_tasks_to_inbox(client):
    item_id = _create_item(client, "project", "P")
    t1 = client.post("/api/tasks", json={"title": "T1", "item_id": item_id}, headers=HEADERS).json()["id"]
    t2 = client.post("/api/tasks", json={"title": "T2", "item_id": item_id}, headers=HEADERS).json()["id"]
    client.post(f"/api/tasks/{t2}/complete", headers=HEADERS)
    r = client.post(f"/api/items/{item_id}/convert", json={"target_type": "resource"}, headers=HEADERS)
    assert r.status_code == 200
    # Both tasks (open + completed) must be in inbox
    t1_data = client.get(f"/api/tasks/{t1}").json()
    t2_data = client.get(f"/api/tasks/{t2}").json()
    assert t1_data["item_id"] is None
    assert t2_data["item_id"] is None


def test_convert_same_type_rejected(client):
    item_id = _create_item(client, "project", "P")
    r = client.post(f"/api/items/{item_id}/convert", json={"target_type": "project"}, headers=HEADERS)
    assert r.status_code == 409


def test_convert_archived_item_rejected(client):
    item_id = _create_item(client, "project", "P")
    client.post(f"/api/items/{item_id}/archive", headers=HEADERS)
    r = client.post(f"/api/items/{item_id}/convert", json={"target_type": "area"}, headers=HEADERS)
    assert r.status_code == 403


def test_convert_to_resource_deletes_resource_links(client):
    """Converting TO resource deletes inbound resource links (R2.8)."""
    project_id = _create_item(client, "project", "P")
    resource_id = _create_item(client, "resource", "R")
    client.post(f"/api/resources/{resource_id}/link", json={"linked_item_id": project_id}, headers=HEADERS)
    # Convert project to resource -> inbound resource_links from R to P must be deleted
    client.post(f"/api/items/{project_id}/convert", json={"target_type": "resource"}, headers=HEADERS)
    linked = client.get(f"/api/resources/{resource_id}/linked-items").json()
    assert not any(i["id"] == project_id for i in linked)


def test_convert_from_resource_deletes_outbound_links(client):
    """Converting FROM resource deletes outbound resource links (R2.7)."""
    resource_id = _create_item(client, "resource", "R")
    project_id = _create_item(client, "project", "P")
    client.post(f"/api/resources/{resource_id}/link", json={"linked_item_id": project_id}, headers=HEADERS)
    # Convert resource to area -> outbound links from R must be deleted
    client.post(f"/api/items/{resource_id}/convert", json={"target_type": "area"}, headers=HEADERS)
    linked = client.get(f"/api/resources/{resource_id}/linked-items").json()
    assert len(linked) == 0


def test_convert_preview(client):
    item_id = _create_item(client, "project", "P")
    client.post("/api/tasks", json={"title": "T1", "item_id": item_id}, headers=HEADERS)
    r = client.get(f"/api/items/{item_id}/convert/preview?target_type=resource")
    assert r.status_code == 200
    assert r.json()["task_count"] == 1
