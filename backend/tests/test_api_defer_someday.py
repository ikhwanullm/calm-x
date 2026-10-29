"""API tests for Defer (defer_until) and Someday (is_someday) on tasks."""
import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from backend.api.deps import get_db_session
from backend.config import Config
from backend.database import Base, get_engine
from backend.main import create_app

HEADERS = {"X-Calm-X": "1"}
TODAY = "2026-10-29"


@pytest.fixture
def client(tmp_path):
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
    return TestClient(app, base_url="http://localhost:8080", raise_server_exceptions=False)


def _task(client, title, **extra):
    r = client.post("/api/tasks", json={"title": title, **extra}, headers=HEADERS)
    assert r.status_code == 201, r.json()
    return r.json()["id"]


def _put(client, task_id, **fields):
    r = client.put(f"/api/tasks/{task_id}", json=fields, headers=HEADERS)
    assert r.status_code == 200, r.json()
    return r.json()


def _today(client, today=TODAY):
    r = client.get(f"/api/tasks/today?today={today}")
    assert r.status_code == 200, r.json()
    return {k: [t["title"] for t in v] for k, v in r.json().items()}


def test_new_tasks_are_not_deferred_or_someday(client):
    tid = _task(client, "Plain")
    task = client.get(f"/api/tasks/{tid}").json()
    assert task["defer_until"] is None and task["is_someday"] is False


def test_defer_and_someday_round_trip(client):
    tid = _task(client, "Later")
    task = _put(client, tid, defer_until="2026-11-05", is_someday=True)
    assert task["defer_until"] == "2026-11-05" and task["is_someday"] is True
    task = _put(client, tid, defer_until=None, is_someday=False)
    assert task["defer_until"] is None and task["is_someday"] is False


def test_unrelated_update_keeps_defer_and_someday(client):
    tid = _task(client, "Keep")
    _put(client, tid, defer_until="2026-11-05", is_someday=True)
    task = _put(client, tid, title="Keep v2")
    assert task["defer_until"] == "2026-11-05" and task["is_someday"] is True


def test_null_is_someday_is_ignored(client):
    tid = _task(client, "Keep")
    _put(client, tid, is_someday=True)
    assert _put(client, tid, is_someday=None)["is_someday"] is True


def test_deferred_task_is_hidden_from_today_until_its_date(client):
    tid = _task(client, "Starts later", due_date="2026-10-29")
    _put(client, tid, defer_until="2026-10-29", focus_date=TODAY)
    assert _today(client)["due_today"] == ["Starts later"]
    # Same task seen from an earlier day: deferred, so hidden.
    assert _today(client, "2026-10-28") == {"overdue": [], "due_today": [], "focused": [], "waiting": []}


def test_deferred_focus_and_waiting_tasks_are_hidden_then_return(client):
    focus = _task(client, "Focus later")
    wait = _task(client, "Wait later")
    _put(client, focus, focus_date=TODAY, defer_until="2026-11-02")
    _put(client, wait, waiting_for="Vendor", defer_until="2026-11-02")
    assert _today(client) == {"overdue": [], "due_today": [], "focused": [], "waiting": []}
    shown = _today(client, "2026-11-02")
    assert shown["focused"] == ["Focus later"] and shown["waiting"] == ["Wait later"]


def test_someday_task_is_hidden_from_today_even_if_overdue(client):
    overdue = _task(client, "Old idea", due_date="2026-10-01")
    focus = _task(client, "Parked focus")
    _put(client, overdue, is_someday=True)
    _put(client, focus, focus_date=TODAY, is_someday=True)
    assert _today(client) == {"overdue": [], "due_today": [], "focused": [], "waiting": []}


def test_due_before_defer_is_rejected(client):
    tid = _task(client, "Bad", due_date="2026-11-01")
    r = client.put(f"/api/tasks/{tid}", json={"defer_until": "2026-11-02"}, headers=HEADERS)
    assert r.status_code == 400
    assert client.get(f"/api/tasks/{tid}").json()["defer_until"] is None


def test_moving_due_before_existing_defer_is_rejected(client):
    tid = _task(client, "Bad")
    _put(client, tid, defer_until="2026-11-02")
    r = client.put(f"/api/tasks/{tid}", json={"due_date": "2026-11-01"}, headers=HEADERS)
    assert r.status_code == 400
    # Same day is allowed, and setting both in one request is checked together.
    assert _put(client, tid, due_date="2026-11-02")["due_date"] == "2026-11-02"
    assert _put(client, tid, due_date="2026-12-01", defer_until="2026-12-01")["defer_until"] == "2026-12-01"


def test_someday_list_has_only_open_someday_tasks(client):
    a = _task(client, "Idea A")
    b = _task(client, "Idea B")
    c = _task(client, "Done idea")
    _task(client, "Normal")
    for tid in (a, b, c):
        _put(client, tid, is_someday=True)
    assert client.post(f"/api/tasks/{c}/complete", headers=HEADERS).status_code == 200
    titles = {t["title"] for t in client.get("/api/tasks/someday").json()}
    assert titles == {"Idea A", "Idea B"}


def test_someday_list_excludes_tasks_in_archived_items(client):
    item = client.post("/api/items", json={"type": "project", "title": "P"}, headers=HEADERS).json()
    tid = _task(client, "In project", item_id=item["id"])
    _put(client, tid, is_someday=True)
    assert [t["title"] for t in client.get("/api/tasks/someday").json()] == ["In project"]
    assert client.post(f"/api/items/{item['id']}/archive", headers=HEADERS).status_code == 200
    assert client.get("/api/tasks/someday").json() == []


def test_someday_tasks_leave_inbox_review_and_dashboard_count(client):
    keep = _task(client, "Process me")
    parked = _task(client, "Parked idea")
    _put(client, parked, is_someday=True)
    assert [t["title"] for t in client.get("/api/tasks/inbox").json()] == ["Process me"]
    review = client.get("/api/weekly-review/inbox")
    assert review.status_code == 200, review.text
    assert [t["title"] for t in review.json()] == ["Process me"]
    assert client.get(f"/api/dashboard?today={TODAY}").json()["inbox_count"] == 1
    # Moving it back to active returns it to the Inbox.
    _put(client, parked, is_someday=False)
    assert {t["title"] for t in client.get("/api/tasks/inbox").json()} == {"Process me", "Parked idea"}
    assert keep


def test_export_import_keeps_defer_and_someday(client):
    a = _task(client, "Deferred")
    b = _task(client, "Parked")
    _put(client, a, defer_until="2026-11-05")
    _put(client, b, is_someday=True)
    exported = client.get("/api/export").json()
    assert client.post("/api/import?mode=merge", json=exported, headers=HEADERS).status_code == 200
    tasks = client.get("/api/tasks?scope=all").json()
    assert sorted((t["title"], t["defer_until"], t["is_someday"]) for t in tasks) == sorted([
        ("Deferred", "2026-11-05", False), ("Parked", None, True),
    ] * 2)


def test_import_rejects_a_bad_defer_date(client):
    _task(client, "x")
    exported = client.get("/api/export").json()
    exported["tasks"][0]["defer_until"] = "not-a-date"
    assert client.post("/api/import?mode=merge", json=exported, headers=HEADERS).status_code == 400


def test_undo_restores_defer_and_someday(client):
    tid = _task(client, "Gone")
    _put(client, tid, defer_until="2026-11-05", is_someday=True)
    assert client.delete(f"/api/tasks/{tid}", headers=HEADERS).status_code == 204
    r = client.post(f"/api/tasks/{tid}/restore", headers=HEADERS)
    assert r.status_code == 201, r.json()
    assert (r.json()["defer_until"], r.json()["is_someday"]) == ("2026-11-05", True)


def test_migration_007_adds_columns_without_touching_rows(tmp_path):
    db = tmp_path / "old.db"
    url = f"sqlite:///{db}"
    from alembic import command
    from alembic.config import Config as AlembicConfig
    import backend
    cfg = AlembicConfig()
    cfg.set_main_option("script_location", str(Path(backend.__file__).parent / "migrations"))
    cfg.set_main_option("sqlalchemy.url", url)
    cfg.set_main_option("path_separator", "os")
    command.upgrade(cfg, "006")

    con = sqlite3.connect(db)
    con.execute(
        "INSERT INTO tasks (id, item_id, title, description, notes, priority, is_complete, sort_order, created_at, updated_at) "
        "VALUES (1, NULL, 'Keep task', '', '', 'high', 0, 0, '2026-10-01 00:00:00', '2026-10-01 00:00:00')"
    )
    con.commit()
    con.close()

    command.upgrade(cfg, "007")

    con = sqlite3.connect(db)
    cols = [r[1] for r in con.execute("PRAGMA table_info(tasks)")]
    assert {"defer_until", "is_someday"} <= set(cols)
    assert con.execute("SELECT title, priority, defer_until, is_someday FROM tasks").fetchall() == [
        ("Keep task", "high", None, 0)
    ]
    assert con.execute("SELECT version_num FROM alembic_version").fetchone()[0] == "007"
    con.close()
