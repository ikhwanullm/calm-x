"""tasks.completed_at: set on every path that completes a task, cleared on every path that reopens one."""
import sqlite3
from pathlib import Path

from backend.tests.test_api_meetings import HEADERS, _item, client  # noqa: F401


def _task(client, title="T", item_id=None):
    payload = {"title": title, **({"item_id": item_id} if item_id else {})}
    r = client.post("/api/tasks", json=payload, headers=HEADERS)
    assert r.status_code == 201, r.json()
    return r.json()


def _get(client, task_id):
    r = client.get(f"/api/tasks/{task_id}")
    assert r.status_code == 200, r.json()
    return r.json()


def _complete(client, task_id):
    r = client.post(f"/api/tasks/{task_id}/complete", headers=HEADERS)
    assert r.status_code == 200, r.json()
    return r.json()


def _subtask(client, task_id, title="sub"):
    r = client.post(f"/api/tasks/{task_id}/subtasks", json={"title": title}, headers=HEADERS)
    assert r.status_code == 201, r.json()
    return r.json()


# ── plain complete / reopen ──────────────────────────────────────────────────

def test_a_new_task_has_no_completed_at(client):
    assert _task(client)["completed_at"] is None


def test_complete_sets_it_as_utc_and_reopen_clears_it(client):
    t = _task(client)
    done = _complete(client, t["id"])
    assert done["is_complete"] is True
    assert done["completed_at"].endswith("Z") or done["completed_at"].endswith("+00:00")
    assert _get(client, t["id"])["completed_at"] == done["completed_at"]
    reopened = client.post(f"/api/tasks/{t['id']}/incomplete", headers=HEADERS).json()
    assert reopened["is_complete"] is False and reopened["completed_at"] is None


def test_completing_twice_keeps_the_first_date(client):
    t = _task(client)
    first = _complete(client, t["id"])["completed_at"]
    again = _complete(client, t["id"])["completed_at"]
    assert again == first


def test_completing_again_after_a_reopen_gives_a_new_date(client):
    t = _task(client)
    first = _complete(client, t["id"])["completed_at"]
    client.post(f"/api/tasks/{t['id']}/incomplete", headers=HEADERS)
    second = _complete(client, t["id"])["completed_at"]
    assert second >= first


def test_updating_a_task_does_not_touch_it(client):
    t = _task(client)
    done = _complete(client, t["id"])
    after = client.put(f"/api/tasks/{t['id']}", json={"title": "renamed"}, headers=HEADERS).json()
    assert after["completed_at"] == done["completed_at"]
    # and the update endpoint cannot be used to set it
    forged = client.put(f"/api/tasks/{t['id']}", json={"completed_at": "2020-01-01T00:00:00Z"}, headers=HEADERS).json()
    assert forged["completed_at"] == done["completed_at"]


# ── through subtasks ─────────────────────────────────────────────────────────

def test_completing_the_last_subtask_completes_the_task_with_a_date(client):
    t = _task(client)
    a, b = _subtask(client, t["id"], "a"), _subtask(client, t["id"], "b")
    client.post(f"/api/subtasks/{a['id']}/complete", headers=HEADERS)
    assert _get(client, t["id"])["completed_at"] is None
    client.post(f"/api/subtasks/{b['id']}/complete", headers=HEADERS)
    got = _get(client, t["id"])
    assert got["is_complete"] is True and got["completed_at"] is not None


def test_reopening_a_subtask_reopens_the_task_and_clears_the_date(client):
    t = _task(client)
    a = _subtask(client, t["id"])
    client.post(f"/api/subtasks/{a['id']}/complete", headers=HEADERS)
    assert _get(client, t["id"])["completed_at"] is not None
    client.post(f"/api/subtasks/{a['id']}/incomplete", headers=HEADERS)
    got = _get(client, t["id"])
    assert got["is_complete"] is False and got["completed_at"] is None


def test_adding_a_subtask_to_a_complete_task_reopens_it_and_clears_the_date(client):
    t = _task(client)
    _complete(client, t["id"])
    _subtask(client, t["id"])
    got = _get(client, t["id"])
    assert got["is_complete"] is False and got["completed_at"] is None


def test_deleting_the_open_subtask_can_complete_the_task_and_dates_it(client):
    t = _task(client)
    done_sub, open_sub = _subtask(client, t["id"], "done"), _subtask(client, t["id"], "open")
    client.post(f"/api/subtasks/{done_sub['id']}/complete", headers=HEADERS)
    assert client.delete(f"/api/subtasks/{open_sub['id']}", headers=HEADERS).status_code == 204
    got = _get(client, t["id"])
    assert got["is_complete"] is True and got["completed_at"] is not None


def test_completing_a_task_leaves_its_subtasks_and_date_consistent(client):
    t = _task(client)
    _subtask(client, t["id"])
    done = _complete(client, t["id"])
    assert done["completed_subtask_count"] == 1 and done["completed_at"] is not None


# ── undo, export and import ──────────────────────────────────────────────────

def test_undoing_a_delete_brings_back_the_completion_date(client):
    t = _task(client)
    done = _complete(client, t["id"])
    assert client.delete(f"/api/tasks/{t['id']}", headers=HEADERS).status_code == 204
    restored = client.post(f"/api/tasks/{t['id']}/restore", headers=HEADERS)
    assert restored.status_code == 201
    assert restored.json()["completed_at"] == done["completed_at"]


def test_an_old_undo_snapshot_without_the_field_restores_with_no_date(client):
    from sqlalchemy.orm import sessionmaker  # noqa: F401
    t = _task(client)
    _complete(client, t["id"])
    client.delete(f"/api/tasks/{t['id']}", headers=HEADERS)
    factory = next(iter(client.app.dependency_overrides.values()))
    session = next(factory())
    try:
        import json
        from backend.models.undo import UndoEntry
        entry = session.query(UndoEntry).one()
        payload = json.loads(entry.payload) if isinstance(entry.payload, str) else dict(entry.payload)
        payload.pop("completed_at")
        entry.payload = json.dumps(payload) if isinstance(entry.payload, str) else payload
        session.commit()
    finally:
        session.close()
    restored = client.post(f"/api/tasks/{t['id']}/restore", headers=HEADERS)
    assert restored.status_code == 201 and restored.json()["completed_at"] is None


def test_export_and_import_keep_the_date_and_old_files_import_as_null(client):
    t = _task(client)
    done = _complete(client, t["id"])
    exported = client.get("/api/export").json()
    assert exported["tasks"][0]["completed_at"].startswith(done["completed_at"][:19])
    assert client.post("/api/import?mode=merge", json=exported, headers=HEADERS).status_code == 200
    copies = [x for x in client.get("/api/tasks?scope=all").json() if x["id"] != t["id"]]
    assert len(copies) == 1 and copies[0]["completed_at"][:19] == done["completed_at"][:19]

    for row in exported["tasks"]:
        row.pop("completed_at")
    assert client.post("/api/import?mode=merge", json=exported, headers=HEADERS).status_code == 200
    third = [x for x in client.get("/api/tasks?scope=all").json() if x["id"] not in (t["id"], copies[0]["id"])]
    assert len(third) == 1 and third[0]["is_complete"] is True and third[0]["completed_at"] is None


def test_a_task_made_from_a_template_starts_open_without_a_date(client):
    r = client.post("/api/templates", json={"title": "Tpl", "description": ""}, headers=HEADERS)
    assert r.status_code == 201, r.json()
    tid = r.json()["id"]
    assert client.post(f"/api/templates/{tid}/tasks", json={"title": "Step"}, headers=HEADERS).status_code == 201
    made = client.post(f"/api/templates/{tid}/create-project", json={"title": "From template", "start_date": "2026-11-02"}, headers=HEADERS)
    assert made.status_code in (200, 201), made.json()
    tasks = client.get("/api/tasks?scope=all").json()
    assert tasks and all(x["completed_at"] is None and x["is_complete"] is False for x in tasks)


# ── migration 009 ────────────────────────────────────────────────────────────

def test_migration_009_adds_the_column_and_leaves_completed_tasks_without_a_date(tmp_path):
    db = tmp_path / "old.db"
    from alembic import command
    from alembic.config import Config as AlembicConfig
    import backend
    cfg = AlembicConfig()
    cfg.set_main_option("script_location", str(Path(backend.__file__).parent / "migrations"))
    cfg.set_main_option("sqlalchemy.url", f"sqlite:///{db}")
    cfg.set_main_option("path_separator", "os")
    command.upgrade(cfg, "008")

    con = sqlite3.connect(db)
    con.executemany(
        "INSERT INTO tasks (id, item_id, title, description, notes, priority, is_complete, sort_order, created_at, updated_at) "
        "VALUES (?, NULL, ?, '', '', 'high', ?, 0, '2026-10-01 00:00:00', '2026-10-02 00:00:00')",
        [(1, "Done before", 1), (2, "Still open", 0)],
    )
    con.commit()
    con.close()

    command.upgrade(cfg, "009")

    con = sqlite3.connect(db)
    assert "completed_at" in [r[1] for r in con.execute("PRAGMA table_info(tasks)")]
    assert con.execute("SELECT title, is_complete, priority, completed_at FROM tasks ORDER BY id").fetchall() == [
        ("Done before", 1, "high", None), ("Still open", 0, "high", None),
    ]
    assert con.execute("SELECT version_num FROM alembic_version").fetchone()[0] == "009"
    assert con.execute("PRAGMA foreign_key_check").fetchall() == []
    con.close()
