"""API tests for the optional parent Area of a Project (items.area_id)."""
import sqlite3

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from backend.api.deps import get_db_session
from backend.config import Config
from backend.database import Base, get_engine, _run_migrations
from backend.main import create_app

HEADERS = {"X-Calm-X": "1"}


@pytest.fixture
def client(tmp_path):
    app = create_app(Config(port=8080))
    # get_engine turns on PRAGMA foreign_keys, as in the running app,
    # so ON DELETE SET NULL is exercised for real.
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


def _create(client, item_type, title, **extra):
    r = client.post("/api/items", json={"type": item_type, "title": title, **extra}, headers=HEADERS)
    assert r.status_code == 201, r.json()
    return r.json()


def test_create_project_in_area(client):
    area = _create(client, "area", "Platform")
    project = _create(client, "project", "Migrate CML", area_id=area["id"])
    assert project["area_id"] == area["id"]
    assert project["area_title"] == "Platform"
    assert project["area_archived"] is False


def test_project_without_area_has_null_fields(client):
    project = _create(client, "project", "Solo")
    assert project["area_id"] is None
    assert project["area_title"] is None


def test_area_id_must_point_to_an_area(client):
    other = _create(client, "project", "Not an area")
    r = client.post("/api/items", json={"type": "project", "title": "P", "area_id": other["id"]}, headers=HEADERS)
    assert r.status_code == 400
    r = client.post("/api/items", json={"type": "project", "title": "P", "area_id": 999}, headers=HEADERS)
    assert r.status_code == 400


def test_archived_area_cannot_receive_projects(client):
    area = _create(client, "area", "Old")
    client.post(f"/api/items/{area['id']}/archive", headers=HEADERS)
    r = client.post("/api/items", json={"type": "project", "title": "P", "area_id": area["id"]}, headers=HEADERS)
    assert r.status_code == 403


def test_set_change_and_clear_area(client):
    a1 = _create(client, "area", "A1")
    a2 = _create(client, "area", "A2")
    project = _create(client, "project", "P")
    r = client.put(f"/api/items/{project['id']}", json={"area_id": a1["id"]}, headers=HEADERS)
    assert r.json()["area_title"] == "A1"
    r = client.put(f"/api/items/{project['id']}", json={"area_id": a2["id"]}, headers=HEADERS)
    assert r.json()["area_title"] == "A2"
    r = client.put(f"/api/items/{project['id']}", json={"area_id": None}, headers=HEADERS)
    assert r.status_code == 200
    assert r.json()["area_id"] is None


def test_only_projects_can_belong_to_an_area(client):
    area = _create(client, "area", "A")
    other_area = _create(client, "area", "B")
    r = client.put(f"/api/items/{other_area['id']}", json={"area_id": area["id"]}, headers=HEADERS)
    assert r.status_code == 400


def test_list_projects_of_an_area(client):
    area = _create(client, "area", "A")
    _create(client, "project", "In area", area_id=area["id"])
    _create(client, "project", "Elsewhere")
    r = client.get(f"/api/items?type=project&area_id={area['id']}")
    assert [p["title"] for p in r.json()] == ["In area"]


def test_archiving_area_keeps_membership(client):
    area = _create(client, "area", "A")
    project = _create(client, "project", "P", area_id=area["id"])
    client.post(f"/api/items/{area['id']}/archive", headers=HEADERS)
    r = client.get(f"/api/items/{project['id']}").json()
    assert r["area_id"] == area["id"]
    assert r["area_archived"] is True
    client.post(f"/api/items/{area['id']}/restore", headers=HEADERS)
    assert client.get(f"/api/items/{project['id']}").json()["area_archived"] is False


def test_deleting_area_detaches_projects(client):
    area = _create(client, "area", "A")
    project = _create(client, "project", "P", area_id=area["id"])
    assert client.delete(f"/api/items/{area['id']}", headers=HEADERS).status_code == 204
    r = client.get(f"/api/items/{project['id']}")
    assert r.status_code == 200
    assert r.json()["area_id"] is None


def test_converting_area_detaches_its_projects(client):
    area = _create(client, "area", "A")
    project = _create(client, "project", "P", area_id=area["id"])
    preview = client.get(f"/api/items/{area['id']}/convert/preview?target_type=resource").json()
    assert preview["area_project_count"] == 1
    r = client.post(f"/api/items/{area['id']}/convert", json={"target_type": "resource"}, headers=HEADERS)
    assert r.status_code == 200
    assert client.get(f"/api/items/{project['id']}").json()["area_id"] is None


def test_converting_project_leaves_its_area(client):
    area = _create(client, "area", "A")
    project = _create(client, "project", "P", area_id=area["id"])
    preview = client.get(f"/api/items/{project['id']}/convert/preview?target_type=area").json()
    assert preview["leaves_area"] is True
    client.post(f"/api/items/{project['id']}/convert", json={"target_type": "area"}, headers=HEADERS)
    r = client.post(f"/api/items/{project['id']}/convert", json={"target_type": "project"}, headers=HEADERS)
    assert r.json()["area_id"] is None


def test_create_project_from_template_in_area(client):
    area = _create(client, "area", "Platform")
    template = client.post("/api/templates", json={"title": "Sprint"}, headers=HEADERS).json()
    client.post(f"/api/templates/{template['id']}/tasks", json={"title": "Plan", "relative_days": 0}, headers=HEADERS)
    r = client.post(
        f"/api/templates/{template['id']}/create-project",
        json={"title": "Sprint 1", "area_id": area["id"]},
        headers=HEADERS,
    )
    assert r.status_code == 201, r.json()
    assert r.json()["area_title"] == "Platform"
    assert r.json()["task_count"] == 1


def test_export_import_merge_keeps_area_membership(client):
    area = _create(client, "area", "Platform")
    _create(client, "project", "Migrate", area_id=area["id"])
    exported = client.get("/api/export").json()
    assert [i["area_id"] for i in exported["items"] if i["type"] == "project"] == [area["id"]]

    r = client.post("/api/import?mode=merge", json=exported, headers=HEADERS)
    assert r.status_code == 200, r.json()

    projects = client.get("/api/items?type=project").json()
    areas = {a["id"]: a["title"] for a in client.get("/api/items?type=area").json()}
    assert len(projects) == 2
    # Each copy points at its own Area, and the imported copy at the new Area id
    assert {p["area_title"] for p in projects} == {"Platform"}
    assert len({p["area_id"] for p in projects}) == 2
    assert all(p["area_id"] in areas for p in projects)


def test_import_rejects_area_id_that_is_not_an_area(client):
    exported = client.get("/api/export").json()
    exported["items"] = [
        {"id": 1, "type": "project", "title": "A", "area_id": 2},
        {"id": 2, "type": "project", "title": "B"},
    ]
    r = client.post("/api/import?mode=merge", json=exported, headers=HEADERS)
    assert r.status_code == 400
    assert client.get("/api/items?type=project").json() == []


def test_migration_004_adds_area_id_without_touching_rows(tmp_path):
    """Upgrade a database that already holds items and tasks to head."""
    db = tmp_path / "old.db"
    url = f"sqlite:///{db}"
    from alembic import command
    from alembic.config import Config as AlembicConfig
    from pathlib import Path
    import backend
    cfg = AlembicConfig()
    cfg.set_main_option("script_location", str(Path(backend.__file__).parent / "migrations"))
    cfg.set_main_option("sqlalchemy.url", url)
    cfg.set_main_option("path_separator", "os")
    command.upgrade(cfg, "003")

    con = sqlite3.connect(db)
    con.execute(
        "INSERT INTO items (id, type, title, description, notes, created_at, updated_at, project_status) "
        "VALUES (1, 'project', 'Keep me', '', '', '2026-10-01 00:00:00', '2026-10-01 00:00:00', 'active')"
    )
    con.execute(
        "INSERT INTO tasks (id, item_id, title, description, notes, priority, is_complete, sort_order, created_at, updated_at) "
        "VALUES (1, 1, 'Keep task', '', '', 'medium', 0, 0, '2026-10-01 00:00:00', '2026-10-01 00:00:00')"
    )
    con.commit()
    con.close()

    _run_migrations(url)

    con = sqlite3.connect(db)
    cols = [r[1] for r in con.execute("PRAGMA table_info(items)")]
    assert "area_id" in cols
    assert con.execute("SELECT title, area_id FROM items").fetchall() == [("Keep me", None)]
    assert con.execute("SELECT title, item_id FROM tasks").fetchall() == [("Keep task", 1)]
    assert con.execute("SELECT version_num FROM alembic_version").fetchone()[0] == "004"
    con.close()
