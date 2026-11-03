"""API tests for undoing task and subtask deletion."""
import sqlite3
from datetime import timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.orm import sessionmaker

from backend.api.deps import get_db_session
from backend.config import Config
from backend.database import Base, get_engine
from backend.main import create_app
from backend.models.undo import UndoEntry
from backend.models.utils import now_utc

HEADERS = {"X-Calm-X": "1"}


@pytest.fixture
def ctx(tmp_path):
    app = create_app(Config(port=8080))
    engine = get_engine(f"sqlite:///{tmp_path / 'db.sqlite'}")
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
    client = TestClient(app, base_url="http://localhost:8080", raise_server_exceptions=False)
    return client, factory


def _post(client, url, body=None, status=201):
    r = client.post(url, json=body, headers=HEADERS)
    assert r.status_code == status, r.json()
    return r.json()


def test_restore_task_with_subtasks_tags_and_fields(ctx):
    client, _ = ctx
    project = _post(client, "/api/items", {"type": "project", "title": "P"})
    task = _post(client, "/api/tasks", {
        "title": "Report", "item_id": project["id"], "priority": "high",
        "due_date": "2026-11-02", "tag_names": ["work"],
    })
    client.put(f"/api/tasks/{task['id']}", json={"waiting_for": "Vendor", "focus_date": "2026-10-28"}, headers=HEADERS)
    _post(client, f"/api/tasks/{task['id']}/subtasks", {"title": "Draft"})
    _post(client, f"/api/tasks/{task['id']}/subtasks", {"title": "Review"})

    assert client.delete(f"/api/tasks/{task['id']}", headers=HEADERS).status_code == 204
    assert client.get(f"/api/tasks/{task['id']}").status_code == 404

    restored = _post(client, f"/api/tasks/{task['id']}/restore")
    assert restored["id"] == task["id"]
    assert restored["item_id"] == project["id"]
    assert (restored["title"], restored["priority"], restored["due_date"]) == ("Report", "high", "2026-11-02")
    assert restored["tags"] == ["work"]
    assert (restored["waiting_for"], restored["focus_date"]) == ("Vendor", "2026-10-28")
    subtasks = client.get(f"/api/tasks/{task['id']}/subtasks").json()
    assert [s["title"] for s in subtasks] == ["Draft", "Review"]
    assert client.get(f"/api/items/{project['id']}").json()["task_count"] == 1


def test_restore_is_one_shot(ctx):
    client, _ = ctx
    task = _post(client, "/api/tasks", {"title": "Once"})
    client.delete(f"/api/tasks/{task['id']}", headers=HEADERS)
    _post(client, f"/api/tasks/{task['id']}/restore")
    _post(client, f"/api/tasks/{task['id']}/restore", status=404)


def test_restore_without_deletion_is_404(ctx):
    client, _ = ctx
    _post(client, "/api/tasks/999/restore", status=404)


def test_restore_after_the_window_is_404(ctx):
    client, factory = ctx
    task = _post(client, "/api/tasks", {"title": "Old"})
    client.delete(f"/api/tasks/{task['id']}", headers=HEADERS)
    with factory() as s:
        s.execute(update(UndoEntry).values(created_at=now_utc() - timedelta(hours=25)))
        s.commit()
    _post(client, f"/api/tasks/{task['id']}/restore", status=404)


def test_task_returns_to_inbox_when_its_project_is_gone(ctx):
    client, _ = ctx
    project = _post(client, "/api/items", {"type": "project", "title": "Gone"})
    task = _post(client, "/api/tasks", {"title": "Orphan", "item_id": project["id"]})
    client.delete(f"/api/tasks/{task['id']}", headers=HEADERS)
    client.delete(f"/api/items/{project['id']}", headers=HEADERS)
    restored = _post(client, f"/api/tasks/{task['id']}/restore")
    assert restored["item_id"] is None


def test_task_returns_to_inbox_when_its_project_is_archived(ctx):
    client, _ = ctx
    project = _post(client, "/api/items", {"type": "project", "title": "Shelved"})
    task = _post(client, "/api/tasks", {"title": "T", "item_id": project["id"]})
    client.delete(f"/api/tasks/{task['id']}", headers=HEADERS)
    client.post(f"/api/items/{project['id']}/archive", headers=HEADERS)
    assert _post(client, f"/api/tasks/{task['id']}/restore")["item_id"] is None


def test_restore_subtask_and_reevaluate_task(ctx):
    client, _ = ctx
    task = _post(client, "/api/tasks", {"title": "T"})
    done = _post(client, f"/api/tasks/{task['id']}/subtasks", {"title": "Done"})
    open_sub = _post(client, f"/api/tasks/{task['id']}/subtasks", {"title": "Open"})
    client.post(f"/api/subtasks/{done['id']}/complete", headers=HEADERS)
    # Deleting the only open subtask completes the task (R8 sync)...
    client.delete(f"/api/subtasks/{open_sub['id']}", headers=HEADERS)
    assert client.get(f"/api/tasks/{task['id']}").json()["is_complete"] is True
    # ...and undoing it reopens the task
    restored = _post(client, f"/api/subtasks/{open_sub['id']}/restore")
    assert (restored["id"], restored["title"], restored["is_complete"]) == (open_sub["id"], "Open", False)
    assert client.get(f"/api/tasks/{task['id']}").json()["is_complete"] is False


def test_restore_subtask_of_deleted_task_is_404(ctx):
    client, _ = ctx
    task = _post(client, "/api/tasks", {"title": "T"})
    sub = _post(client, f"/api/tasks/{task['id']}/subtasks", {"title": "S"})
    client.delete(f"/api/subtasks/{sub['id']}", headers=HEADERS)
    client.delete(f"/api/tasks/{task['id']}", headers=HEADERS)
    _post(client, f"/api/subtasks/{sub['id']}/restore", status=404)


def test_old_snapshots_are_pruned(ctx):
    client, factory = ctx
    old = _post(client, "/api/tasks", {"title": "Old"})
    client.delete(f"/api/tasks/{old['id']}", headers=HEADERS)
    with factory() as s:
        s.execute(update(UndoEntry).values(created_at=now_utc() - timedelta(hours=25)))
        s.commit()
    new = _post(client, "/api/tasks", {"title": "New"})
    client.delete(f"/api/tasks/{new['id']}", headers=HEADERS)
    with factory() as s:
        assert [e.entity_id for e in s.query(UndoEntry).all()] == [new["id"]]


def test_migration_006_creates_table(tmp_path):
    from alembic import command
    from alembic.config import Config as AlembicConfig
    import backend
    db = tmp_path / "m.db"
    cfg = AlembicConfig()
    cfg.set_main_option("script_location", str(Path(backend.__file__).parent / "migrations"))
    cfg.set_main_option("sqlalchemy.url", f"sqlite:///{db}")
    cfg.set_main_option("path_separator", "os")
    command.upgrade(cfg, "006")
    con = sqlite3.connect(db)
    cols = [r[1] for r in con.execute("PRAGMA table_info(undo_entries)")]
    assert cols == ["id", "kind", "entity_id", "payload", "created_at"]
    con.close()


# ── undoing a completion ─────────────────────────────────────────────────────

def _task_with_subtasks(client, done_first=True):
    task = _post(client, "/api/tasks", {"title": "Report"})
    subs = [_post(client, f"/api/tasks/{task['id']}/subtasks", {"title": t}) for t in ("A", "B", "C")]
    if done_first:
        # one subtask is already done before the task is completed
        _post(client, f"/api/subtasks/{subs[0]['id']}/complete", status=200)
    return task, subs


def test_undo_complete_restores_subtask_states_and_clears_the_date(ctx):
    client, _ = ctx
    task, _subs = _task_with_subtasks(client)
    before = client.get(f"/api/tasks/{task['id']}", headers=HEADERS).json()
    assert before["completed_subtask_count"] == 1

    done = _post(client, f"/api/tasks/{task['id']}/complete", status=200)
    assert done["completed_subtask_count"] == 3 and done["completed_at"] is not None

    undone = _post(client, f"/api/tasks/{task['id']}/undo-complete", status=200)
    assert undone["is_complete"] is False
    assert undone["completed_at"] is None
    assert undone["completed_subtask_count"] == 1  # not 0: the subtask done before stays done


def test_undo_complete_twice_is_refused(ctx):
    client, _ = ctx
    task = _post(client, "/api/tasks", {"title": "Report"})
    _post(client, f"/api/tasks/{task['id']}/complete", status=200)
    _post(client, f"/api/tasks/{task['id']}/undo-complete", status=200)
    r = client.post(f"/api/tasks/{task['id']}/undo-complete", headers=HEADERS)
    assert r.status_code == 409


def test_undo_complete_after_a_manual_reopen_is_refused(ctx):
    client, _ = ctx
    task = _post(client, "/api/tasks", {"title": "Report"})
    _post(client, f"/api/tasks/{task['id']}/complete", status=200)
    _post(client, f"/api/tasks/{task['id']}/incomplete", status=200)
    r = client.post(f"/api/tasks/{task['id']}/undo-complete", headers=HEADERS)
    assert r.status_code == 409


def test_undo_of_an_older_completion_is_refused_after_completing_again(ctx):
    client, _ = ctx
    task = _post(client, "/api/tasks", {"title": "Report"})
    _post(client, f"/api/tasks/{task['id']}/complete", status=200)
    _post(client, f"/api/tasks/{task['id']}/incomplete", status=200)
    _post(client, f"/api/tasks/{task['id']}/complete", status=200)
    # the newest completion can be undone; the one before it cannot come back
    _post(client, f"/api/tasks/{task['id']}/undo-complete", status=200)
    assert client.post(f"/api/tasks/{task['id']}/undo-complete", headers=HEADERS).status_code == 409


def test_undo_complete_of_a_deleted_task_is_refused(ctx):
    client, _ = ctx
    task = _post(client, "/api/tasks", {"title": "Report"})
    _post(client, f"/api/tasks/{task['id']}/complete", status=200)
    client.delete(f"/api/tasks/{task['id']}", headers=HEADERS)
    assert client.post(f"/api/tasks/{task['id']}/undo-complete", headers=HEADERS).status_code == 409


def test_completing_an_already_complete_task_records_nothing_to_undo(ctx):
    client, _ = ctx
    task = _post(client, "/api/tasks", {"title": "Report"})
    _post(client, f"/api/tasks/{task['id']}/complete", status=200)
    _post(client, f"/api/tasks/{task['id']}/complete", status=200)
    _post(client, f"/api/tasks/{task['id']}/undo-complete", status=200)
    assert client.post(f"/api/tasks/{task['id']}/undo-complete", headers=HEADERS).status_code == 409
