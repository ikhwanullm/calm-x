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


# ---------------------------------------------------------------------------
# Phase 7 Archive API tests
# ---------------------------------------------------------------------------


def test_list_archived_only(client):
    """archived=only returns only archived items."""
    # Create 2 projects, archive 1
    p1 = client.post("/api/items", json={"type": "project", "title": "Active"}, headers=HEADERS).json()
    p2 = client.post("/api/items", json={"type": "project", "title": "Archived"}, headers=HEADERS).json()
    client.post(f"/api/items/{p2['id']}/archive", headers=HEADERS)

    # Default list excludes archived
    resp = client.get("/api/items")
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["title"] == "Active"

    # archived=only returns only archived
    resp = client.get("/api/items?archived=only")
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["title"] == "Archived"
    assert resp.json()[0]["archived_at"] is not None


def test_archived_items_sorted_by_archived_at_desc(client):
    """archived=only sorts by archived_at descending (newest first)."""
    import time

    # Create 3 projects and archive them in order
    p1 = client.post("/api/items", json={"type": "project", "title": "First"}, headers=HEADERS).json()
    time.sleep(0.01)  # small delay to ensure different timestamps
    p2 = client.post("/api/items", json={"type": "project", "title": "Second"}, headers=HEADERS).json()
    time.sleep(0.01)
    p3 = client.post("/api/items", json={"type": "project", "title": "Third"}, headers=HEADERS).json()

    # Archive in order: First, Second, Third
    client.post(f"/api/items/{p1['id']}/archive", headers=HEADERS)
    time.sleep(0.01)
    client.post(f"/api/items/{p2['id']}/archive", headers=HEADERS)
    time.sleep(0.01)
    client.post(f"/api/items/{p3['id']}/archive", headers=HEADERS)

    # Get archived items - should be Third, Second, First (newest archived first)
    resp = client.get("/api/items?archived=only")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 3
    assert items[0]["title"] == "Third"
    assert items[1]["title"] == "Second"
    assert items[2]["title"] == "First"


def test_archive_search_by_title(client):
    """Search archived items by title."""
    p1 = client.post("/api/items", json={"type": "project", "title": "Alpha Project"}, headers=HEADERS).json()
    p2 = client.post("/api/items", json={"type": "area", "title": "Beta Area"}, headers=HEADERS).json()
    client.post(f"/api/items/{p1['id']}/archive", headers=HEADERS)
    client.post(f"/api/items/{p2['id']}/archive", headers=HEADERS)

    # Search for "Alpha"
    resp = client.get("/api/items?archived=only&q=Alpha")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["title"] == "Alpha Project"


def test_archive_search_by_description(client):
    """Search archived items by description."""
    p1 = client.post("/api/items", json={"type": "project", "title": "P1", "description": "Contains important data"}, headers=HEADERS).json()
    p2 = client.post("/api/items", json={"type": "project", "title": "P2", "description": "Nothing special"}, headers=HEADERS).json()
    client.post(f"/api/items/{p1['id']}/archive", headers=HEADERS)
    client.post(f"/api/items/{p2['id']}/archive", headers=HEADERS)

    # Search for "important"
    resp = client.get("/api/items?archived=only&q=important")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["title"] == "P1"


def test_archive_filter_by_type(client):
    """Filter archived items by type."""
    p1 = client.post("/api/items", json={"type": "project", "title": "Project"}, headers=HEADERS).json()
    a1 = client.post("/api/items", json={"type": "area", "title": "Area"}, headers=HEADERS).json()
    r1 = client.post("/api/items", json={"type": "resource", "title": "Resource"}, headers=HEADERS).json()
    client.post(f"/api/items/{p1['id']}/archive", headers=HEADERS)
    client.post(f"/api/items/{a1['id']}/archive", headers=HEADERS)
    client.post(f"/api/items/{r1['id']}/archive", headers=HEADERS)

    # Filter by type=project
    resp = client.get("/api/items?archived=only&type=project")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["type"] == "project"

    # Filter by type=area
    resp = client.get("/api/items?archived=only&type=area")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["type"] == "area"


def test_archive_filter_by_date_range(client):
    """Filter archived items by date range.

    Filters now accept ISO 8601 datetime strings with timezone offset so the
    server can compare correctly in UTC regardless of the client's timezone.
    """
    from datetime import date, timedelta

    today = date.today()
    yesterday = today - timedelta(days=1)
    tomorrow = today + timedelta(days=1)

    # Create and archive a project
    p1 = client.post("/api/items", json={"type": "project", "title": "P1"}, headers=HEADERS).json()
    client.post(f"/api/items/{p1['id']}/archive", headers=HEADERS)

    # Filter: archived from start of today UTC — should include the item
    resp = client.get(f"/api/items?archived=only&archived_from={today.isoformat()}T00:00:00Z")
    assert resp.status_code == 200
    assert len(resp.json()) == 1

    # Filter: archived to end of yesterday UTC — should exclude the item (archived today)
    resp = client.get(f"/api/items?archived=only&archived_to={yesterday.isoformat()}T23:59:59Z")
    assert resp.status_code == 200
    assert len(resp.json()) == 0

    # Filter: archived to end of tomorrow UTC — should include the item
    resp = client.get(f"/api/items?archived=only&archived_to={tomorrow.isoformat()}T23:59:59Z")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_archive_date_filter_requires_archived_mode(client):
    """archived_from/archived_to require archived=only or include_archived=true."""
    from datetime import date

    today_iso = f"{date.today().isoformat()}T00:00:00Z"

    # Without archived mode - should fail with CalmX ValidationError (not HTTPException)
    resp = client.get(f"/api/items?archived_from={today_iso}")
    assert resp.status_code == 400
    body = resp.json()
    # CalmX error contract: {"error": "...", "type": "..."}
    assert "archived_from" in body["error"]
    assert body["type"] == "validation_error"


def test_archive_combined_search_and_filter(client):
    """Combine search and type filter on archived items."""
    p1 = client.post("/api/items", json={"type": "project", "title": "Alpha Project"}, headers=HEADERS).json()
    a1 = client.post("/api/items", json={"type": "area", "title": "Alpha Area"}, headers=HEADERS).json()
    p2 = client.post("/api/items", json={"type": "project", "title": "Beta Project"}, headers=HEADERS).json()
    client.post(f"/api/items/{p1['id']}/archive", headers=HEADERS)
    client.post(f"/api/items/{a1['id']}/archive", headers=HEADERS)
    client.post(f"/api/items/{p2['id']}/archive", headers=HEADERS)

    # Search for "Alpha" + filter by type=project
    resp = client.get("/api/items?archived=only&q=Alpha&type=project")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["title"] == "Alpha Project"
    assert items[0]["type"] == "project"


def test_archive_search_escapes_sql_wildcards(client):
    """Search properly escapes SQL wildcards (%, _)."""
    # Create items with special characters in title
    p1 = client.post("/api/items", json={"type": "project", "title": "100% Complete"}, headers=HEADERS).json()
    p2 = client.post("/api/items", json={"type": "project", "title": "file_name.txt"}, headers=HEADERS).json()
    p3 = client.post("/api/items", json={"type": "project", "title": "Regular"}, headers=HEADERS).json()
    client.post(f"/api/items/{p1['id']}/archive", headers=HEADERS)
    client.post(f"/api/items/{p2['id']}/archive", headers=HEADERS)
    client.post(f"/api/items/{p3['id']}/archive", headers=HEADERS)

    # Search for "100%" - should match literally, not as wildcard
    resp = client.get("/api/items?archived=only&q=100%25")  # URL encoded %
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["title"] == "100% Complete"

    # Search for "file_" - underscore should not be wildcard
    resp = client.get("/api/items?archived=only&q=file_")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["title"] == "file_name.txt"


def test_archived_item_includes_task_count(client):
    """Archived items include task_count in response."""
    # Create project with tasks
    p1 = client.post("/api/items", json={"type": "project", "title": "P1"}, headers=HEADERS).json()
    client.post("/api/tasks", json={"title": "T1", "item_id": p1["id"]}, headers=HEADERS)
    client.post("/api/tasks", json={"title": "T2", "item_id": p1["id"]}, headers=HEADERS)
    t3_id = client.post("/api/tasks", json={"title": "T3", "item_id": p1["id"]}, headers=HEADERS).json()["id"]
    client.post(f"/api/tasks/{t3_id}/complete", headers=HEADERS)

    # Archive the project
    client.post(f"/api/items/{p1['id']}/archive", headers=HEADERS)

    # Get archived items
    resp = client.get("/api/items?archived=only")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["task_count"] == 3
    assert items[0]["completed_task_count"] == 1
    assert items[0]["progress_percentage"] == 33  # 1/3 = 33%


def test_delete_item_removes_all_related_data(client):
    """R7.9, R7.10: Deleting an item removes tasks, subtasks, task_tags, reference_links, resource_links.
    Tags themselves should NOT be deleted."""
    # Create a project with tasks, subtasks, tags, reference links
    proj = client.post("/api/items", json={"type": "project", "title": "Project"}, headers=HEADERS).json()
    proj_id = proj["id"]

    # Create a resource to link to the project
    res = client.post("/api/items", json={"type": "resource", "title": "Resource"}, headers=HEADERS).json()
    res_id = res["id"]

    # Create task with subtasks and tags
    task = client.post("/api/tasks", json={
        "title": "Task 1",
        "item_id": proj_id,
        "tag_names": ["tag1", "tag2"]
    }, headers=HEADERS).json()
    task_id = task["id"]

    # Create subtask
    subtask = client.post(f"/api/tasks/{task_id}/subtasks", json={"title": "Subtask 1"}, headers=HEADERS).json()
    subtask_id = subtask["id"]

    # Create reference link
    ref_link = client.post(f"/api/items/{proj_id}/links", json={"url": "https://example.com"}, headers=HEADERS).json()
    ref_link_id = ref_link["id"]

    # Link resource to project (note: the API expects 'linked_item_id')
    link_resp = client.post(f"/api/resources/{res_id}/link", json={"linked_item_id": proj_id}, headers=HEADERS)
    assert link_resp.status_code == 201, f"Failed to create resource link: {link_resp.text}"

    # Verify tags exist
    tags = client.get("/api/tags").json()
    assert len(tags) == 2

    # Verify resource link exists
    links = client.get(f"/api/resources/{res_id}/linked-items").json()
    assert len(links) == 1

    # Delete the project
    resp = client.delete(f"/api/items/{proj_id}", headers=HEADERS)
    assert resp.status_code == 204

    # Verify project is deleted
    assert client.get(f"/api/items/{proj_id}").status_code == 404

    # Verify resource links to deleted item should be removed
    links = client.get(f"/api/resources/{res_id}/linked-items").json()
    assert len(links) == 0, "Resource links to deleted item should be removed"

    # Verify tags still exist (tags are not deleted when items are deleted)
    tags = client.get("/api/tags").json()
    assert len(tags) == 2, "Tags should NOT be deleted when item is deleted"

    # Verify resource still exists
    assert client.get(f"/api/items/{res_id}").status_code == 200


def test_delete_archived_item_cleans_up_all_data(client):
    """Deleting an archived item also removes all related data."""
    # Create and archive a project with data
    proj = client.post("/api/items", json={"type": "project", "title": "Project"}, headers=HEADERS).json()
    proj_id = proj["id"]

    # Create task
    task = client.post("/api/tasks", json={"title": "Task 1", "item_id": proj_id}, headers=HEADERS).json()

    # Create reference link
    client.post(f"/api/items/{proj_id}/links", json={"url": "https://example.com"}, headers=HEADERS)

    # Archive the project
    client.post(f"/api/items/{proj_id}/archive", headers=HEADERS)

    # Verify it's in the archive
    resp = client.get("/api/items?archived=only")
    assert len(resp.json()) == 1

    # Delete the archived project
    resp = client.delete(f"/api/items/{proj_id}", headers=HEADERS)
    assert resp.status_code == 204

    # Verify archive is now empty
    resp = client.get("/api/items?archived=only")
    assert len(resp.json()) == 0
