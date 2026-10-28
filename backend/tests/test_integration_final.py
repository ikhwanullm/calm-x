"""11.10 Final integration tests: end-to-end flow via API.

Create project → add tasks + subtasks → complete all tasks → complete project
→ archive → restore → delete permanently.

All tests use tmp_path — never touch production data.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.config import Config
from backend.database import Base
from backend.main import create_app
from backend.api.deps import get_db_session

HEADERS = {"X-Calm-X": "1"}


@pytest.fixture
def client(tmp_path):
    cfg = Config(port=8080)
    app = create_app(cfg)
    # Use the project's database module so PRAGMA foreign_keys=ON is set up
    from sqlalchemy import create_engine, event
    from backend.database import Base
    from sqlalchemy import text

    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}")

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()

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


class TestEndToEndProjectLifecycle:
    """R1-R4, R7, R8: Full project lifecycle via API."""

    def test_create_project_add_tasks_complete_archive_restore_delete(self, client):
        # ── 1. Create project ─────────────────────────────────────────────
        proj = client.post(
            "/api/items",
            json={"type": "project", "title": "Integration Test Project",
                  "project_goal": "Test full lifecycle"},
            headers=HEADERS,
        ).json()
        assert proj["type"] == "project"
        assert proj["title"] == "Integration Test Project"
        project_id = proj["id"]

        # ── 2. Add tasks ──────────────────────────────────────────────────
        t1 = client.post(
            "/api/tasks",
            json={"title": "Task 1", "item_id": project_id, "priority": "high"},
            headers=HEADERS,
        ).json()
        t2 = client.post(
            "/api/tasks",
            json={"title": "Task 2", "item_id": project_id},
            headers=HEADERS,
        ).json()
        assert t1["item_id"] == project_id
        assert t2["item_id"] == project_id

        # ── 3. Add subtask to task 1 ──────────────────────────────────────
        sub = client.post(
            f"/api/tasks/{t1['id']}/subtasks",
            json={"title": "Subtask 1"},
            headers=HEADERS,
        ).json()
        assert sub["task_id"] == t1["id"]

        # ── 4. Complete subtask → parent auto-completes when all done ────
        client.post(f"/api/subtasks/{sub['id']}/complete", headers=HEADERS)
        t1_reloaded = client.get(f"/api/tasks/{t1['id']}").json()
        assert t1_reloaded["is_complete"] is True

        # ── 5. Complete task 2 ────────────────────────────────────────────
        client.post(f"/api/tasks/{t2['id']}/complete", headers=HEADERS)

        # ── 6. Mark project complete ──────────────────────────────────────
        proj_done = client.post(f"/api/items/{project_id}/complete", headers=HEADERS).json()
        assert proj_done["project_status"] == "completed"

        # ── 7. Archive project ────────────────────────────────────────────
        archived = client.post(f"/api/items/{project_id}/archive", headers=HEADERS).json()
        assert archived["archived_at"] is not None

        # ── 8. Verify it appears in archive ───────────────────────────────
        archive_list = client.get("/api/items?archived=only").json()
        archived_ids = [i["id"] for i in archive_list]
        assert project_id in archived_ids

        # ── 9. Restore project ────────────────────────────────────────────
        restored = client.post(f"/api/items/{project_id}/restore", headers=HEADERS).json()
        assert restored["archived_at"] is None

        # ── 10. Verify it's gone from archive ─────────────────────────────
        archive_list_2 = client.get("/api/items?archived=only").json()
        archived_ids_2 = [i["id"] for i in archive_list_2]
        assert project_id not in archived_ids_2

        # ── 11. Delete permanently ────────────────────────────────────────
        del_resp = client.delete(f"/api/items/{project_id}", headers=HEADERS)
        assert del_resp.status_code == 204

        # ── 12. Verify project, tasks and subtasks are gone ───────────────
        assert client.get(f"/api/items/{project_id}").status_code == 404
        assert client.get(f"/api/tasks/{t1['id']}").status_code == 404
        assert client.get(f"/api/tasks/{t2['id']}").status_code == 404
        # Inbox count unchanged (tasks belonged to project, not inbox)
        inbox_tasks = client.get("/api/tasks/inbox").json()
        assert all(t["id"] != t1["id"] for t in inbox_tasks)


class TestQuickCaptureToProject(object):
    """R3: Quick capture inbox tasks then move to project."""

    def test_quick_capture_then_move(self, client):
        # Capture to inbox
        task = client.post(
            "/api/tasks/quick-capture",
            json={"title": "Quick captured idea"},
            headers=HEADERS,
        ).json()
        assert task["item_id"] is None

        # Verify in inbox
        inbox = client.get("/api/tasks/inbox").json()
        assert any(t["id"] == task["id"] for t in inbox)

        # Create project and move
        project = client.post(
            "/api/items",
            json={"type": "project", "title": "Destination"},
            headers=HEADERS,
        ).json()
        moved = client.post(
            f"/api/tasks/{task['id']}/move",
            json={"item_id": project["id"]},
            headers=HEADERS,
        ).json()
        assert moved["item_id"] == project["id"]

        # No longer in inbox
        inbox2 = client.get("/api/tasks/inbox").json()
        assert not any(t["id"] == task["id"] for t in inbox2)


class TestTaggingAndSearch(object):
    """R12: Tag tasks, search, delete tag cascade."""

    def test_create_tag_assign_to_task_delete_cascade(self, client):
        # Create task with a tag
        project = client.post(
            "/api/items", json={"type": "area", "title": "Area"}, headers=HEADERS,
        ).json()
        task = client.post(
            "/api/tasks",
            json={"title": "Tagged task", "item_id": project["id"], "tag_names": ["urgent"]},
            headers=HEADERS,
        ).json()
        assert "urgent" in task["tags"]

        # Tag exists
        tags = client.get("/api/tags").json()
        urgent = next(t for t in tags if t["name"] == "urgent")

        # Delete tag — should cascade (remove from task)
        client.delete(f"/api/tags/{urgent['id']}", headers=HEADERS)

        # Task still exists but tags are empty
        reloaded = client.get(f"/api/tasks/{task['id']}").json()
        assert "urgent" not in reloaded["tags"]

        # Tag no longer in list
        tags2 = client.get("/api/tags").json()
        assert not any(t["name"] == "urgent" for t in tags2)


class TestTemplateToProject(object):
    """R11: Create template, use it to create a project with calculated due dates."""

    def test_template_creates_project_with_due_dates(self, client):
        from datetime import date, timedelta

        start = date.today()
        tmpl = client.post(
            "/api/templates",
            json={
                "title": "Test Template",
                "tasks": [
                    {"title": "Day 0 task", "relative_days": 0, "priority": "high"},
                    {"title": "Day 7 task", "relative_days": 7, "priority": "medium"},
                ],
            },
            headers=HEADERS,
        ).json()

        project = client.post(
            f"/api/templates/{tmpl['id']}/create-project",
            json={"title": "From Template", "start_date": start.isoformat()},
            headers=HEADERS,
        ).json()

        tasks = client.get(f"/api/items/{project['id']}/tasks").json()
        task_map = {t["title"]: t for t in tasks}

        assert task_map["Day 0 task"]["due_date"] == start.isoformat()
        assert task_map["Day 7 task"]["due_date"] == (start + timedelta(days=7)).isoformat()


class TestWeeklyReviewPersistence(object):
    """R10: Review actions persist even when review is not completed."""

    def test_inbox_task_move_persists_without_completing_review(self, client):
        # Create inbox task
        task = client.post(
            "/api/tasks/quick-capture",
            json={"title": "Inbox for review"},
            headers=HEADERS,
        ).json()

        # Create a project to move to
        project = client.post(
            "/api/items", json={"type": "project", "title": "P1"}, headers=HEADERS,
        ).json()

        # Move task (as if doing so during review)
        client.post(
            f"/api/tasks/{task['id']}/move",
            json={"item_id": project["id"]},
            headers=HEADERS,
        )

        # Exit review without completing (no POST to /weekly-review/complete)
        # Verify task is still moved
        reloaded = client.get(f"/api/tasks/{task['id']}").json()
        assert reloaded["item_id"] == project["id"]

        # No review record created
        history = client.get("/api/weekly-review/history").json()
        assert history["total"] == 0


class TestDashboard(object):
    """R9: Dashboard reflects accurate counts."""

    def test_dashboard_counts_update_after_operations(self, client):
        from datetime import date
        today = date.today().isoformat()

        dash_before = client.get(f"/api/dashboard?today={today}").json()
        initial_inbox = dash_before["inbox_count"]

        # Add inbox task
        client.post(
            "/api/tasks/quick-capture",
            json={"title": "Inbox item"},
            headers=HEADERS,
        )

        dash_after = client.get(f"/api/dashboard?today={today}").json()
        assert dash_after["inbox_count"] == initial_inbox + 1

    def test_dashboard_last_review_date_after_completing_review(self, client):
        from datetime import date
        today = date.today().isoformat()

        dash_before = client.get(f"/api/dashboard?today={today}").json()
        assert dash_before["last_review_date"] is None

        client.post(
            "/api/weekly-review/complete",
            json={"notes": "Integration test review"},
            headers=HEADERS,
        )

        dash_after = client.get(f"/api/dashboard?today={today}").json()
        assert dash_after["last_review_date"] == today
