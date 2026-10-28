"""API tests for the Today view and Waiting-for on tasks."""
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
TODAY = "2026-10-28"


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


def test_focus_puts_task_on_today_and_null_removes_it(client):
    tid = _task(client, "Write report")
    assert _put(client, tid, focus_date=TODAY)["focus_date"] == TODAY
    assert _today(client)["focused"] == ["Write report"]
    _put(client, tid, focus_date=None)
    assert _today(client)["focused"] == []


def test_overdue_and_due_today_use_the_client_date(client):
    _task(client, "Late", due_date="2026-10-27")
    _task(client, "Due now", due_date=TODAY)
    _task(client, "Later", due_date="2026-10-29")
    lists = _today(client)
    assert lists["overdue"] == ["Late"]
    assert lists["due_today"] == ["Due now"]
    # From the next day's point of view, "Due now" is overdue
    assert _today(client, "2026-10-29")["overdue"] == ["Late", "Due now"]


def test_each_task_appears_once(client):
    tid = _task(client, "Due and focused", due_date=TODAY)
    _put(client, tid, focus_date=TODAY)
    lists = _today(client)
    assert lists["due_today"] == ["Due and focused"]
    assert lists["focused"] == []


def test_waiting_task_leaves_the_work_lists(client):
    tid = _task(client, "Approval", due_date="2026-10-20")
    _put(client, tid, focus_date=TODAY)
    task = _put(client, tid, waiting_for="  Security team  ")
    assert task["waiting_for"] == "Security team"
    assert task["waiting_since"] is not None
    lists = _today(client)
    assert lists["waiting"] == ["Approval"]
    assert lists["overdue"] == [] and lists["focused"] == []


def test_clearing_waiting_returns_task_to_its_list(client):
    tid = _task(client, "Approval", due_date="2026-10-20")
    _put(client, tid, waiting_for="Vendor")
    task = _put(client, tid, waiting_for="")
    assert task["waiting_for"] is None and task["waiting_since"] is None
    assert _today(client)["overdue"] == ["Approval"]


def test_waiting_since_only_resets_when_the_text_changes(client):
    tid = _task(client, "Approval")
    first = _put(client, tid, waiting_for="Vendor")["waiting_since"]
    same = _put(client, tid, waiting_for="Vendor", title="Approval v2")["waiting_since"]
    assert same == first


def test_completed_and_archived_tasks_are_excluded(client):
    done = _task(client, "Done", due_date=TODAY)
    client.post(f"/api/tasks/{done}/complete", headers=HEADERS)
    project = client.post("/api/items", json={"type": "project", "title": "Old"}, headers=HEADERS).json()
    _task(client, "In archived", item_id=project["id"], due_date=TODAY)
    client.post(f"/api/items/{project['id']}/archive", headers=HEADERS)
    assert _today(client) == {"overdue": [], "due_today": [], "focused": [], "waiting": []}


def test_tasks_carry_their_item_title(client):
    project = client.post("/api/items", json={"type": "project", "title": "Migrate CML"}, headers=HEADERS).json()
    _task(client, "Plan", item_id=project["id"], due_date=TODAY)
    task = client.get(f"/api/tasks/today?today={TODAY}").json()["due_today"][0]
    assert task["item_title"] == "Migrate CML"
    assert task["item_type"] == "project"


def test_today_requires_a_valid_date(client):
    assert client.get("/api/tasks/today").status_code == 400
    assert client.get("/api/tasks/today?today=nope").status_code == 400


def test_waiting_for_length_is_limited(client):
    tid = _task(client, "T")
    r = client.put(f"/api/tasks/{tid}", json={"waiting_for": "x" * 201}, headers=HEADERS)
    assert r.status_code == 400


def test_export_import_keeps_today_and_waiting(client):
    tid = _task(client, "Kept")
    _put(client, tid, focus_date=TODAY, waiting_for="Vendor")
    exported = client.get("/api/export").json()
    assert exported["tasks"][0]["focus_date"] == TODAY
    assert client.post("/api/import?mode=merge", json=exported, headers=HEADERS).status_code == 200
    tasks = client.get("/api/tasks?scope=all").json()
    assert [(t["focus_date"], t["waiting_for"]) for t in tasks] == [(TODAY, "Vendor")] * 2


def test_migration_005_adds_columns_without_touching_rows(tmp_path):
    db = tmp_path / "old.db"
    url = f"sqlite:///{db}"
    from alembic import command
    from alembic.config import Config as AlembicConfig
    import backend
    cfg = AlembicConfig()
    cfg.set_main_option("script_location", str(Path(backend.__file__).parent / "migrations"))
    cfg.set_main_option("sqlalchemy.url", url)
    cfg.set_main_option("path_separator", "os")
    command.upgrade(cfg, "004")

    con = sqlite3.connect(db)
    con.execute(
        "INSERT INTO tasks (id, item_id, title, description, notes, priority, is_complete, sort_order, created_at, updated_at) "
        "VALUES (1, NULL, 'Keep task', '', '', 'high', 0, 0, '2026-10-01 00:00:00', '2026-10-01 00:00:00')"
    )
    con.commit()
    con.close()

    command.upgrade(cfg, "005")

    con = sqlite3.connect(db)
    cols = [r[1] for r in con.execute("PRAGMA table_info(tasks)")]
    assert {"focus_date", "waiting_for", "waiting_since"} <= set(cols)
    assert con.execute("SELECT title, priority, focus_date, waiting_for FROM tasks").fetchall() == [
        ("Keep task", "high", None, None)
    ]
    assert con.execute("SELECT version_num FROM alembic_version").fetchone()[0] == "005"
    con.close()
