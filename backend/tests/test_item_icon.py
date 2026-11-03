"""items.icon / items.color: stored on every item type, validated, exported, and shown on tasks."""
import sqlite3
from pathlib import Path

import pytest

from backend.tests.test_api_meetings import HEADERS, client  # noqa: F401


def _make(client, type_="project", **extra):
    r = client.post("/api/items", json={"type": type_, "title": "Item", **extra}, headers=HEADERS)
    assert r.status_code == 201, r.json()
    return r.json()


def _put(client, item_id, body):
    return client.put(f"/api/items/{item_id}", json=body, headers=HEADERS)


def test_a_new_item_has_no_icon_or_color(client):
    item = _make(client)
    assert item["icon"] is None and item["color"] is None


@pytest.mark.parametrize("type_", ["project", "area", "resource"])
def test_every_item_type_can_have_an_icon_and_color(client, type_):
    item = _make(client, type_, icon="database", color="teal")
    assert (item["icon"], item["color"]) == ("database", "teal")
    changed = _put(client, item["id"], {"icon": "git-branch", "color": "pink"}).json()
    assert (changed["icon"], changed["color"]) == ("git-branch", "pink")
    assert client.get(f"/api/items/{item['id']}").json()["icon"] == "git-branch"


def test_an_explicit_null_removes_the_icon_and_color_but_an_omitted_field_keeps_them(client):
    item = _make(client, icon="rocket", color="purple")
    kept = _put(client, item["id"], {"title": "Renamed"}).json()
    assert (kept["icon"], kept["color"]) == ("rocket", "purple")
    cleared = _put(client, item["id"], {"icon": None, "color": None}).json()
    assert cleared["icon"] is None and cleared["color"] is None


@pytest.mark.parametrize("color", ["red", "green", "orange", "amber", "Purple", ""])
def test_a_color_outside_the_five_tints_is_refused(client, color):
    item = _make(client)
    assert _put(client, item["id"], {"color": color}).status_code == 400
    assert client.post("/api/items", json={"type": "area", "title": "A", "color": color}, headers=HEADERS).status_code == 400


@pytest.mark.parametrize("icon", ["Database", "has space", "x" * 41, "", "semi;colon", "under_score"])
def test_an_icon_key_must_be_lowercase_letters_digits_and_hyphens_up_to_40(client, icon):
    item = _make(client)
    assert _put(client, item["id"], {"icon": icon}).status_code == 400


def test_an_unknown_but_well_formed_icon_key_is_accepted(client):
    item = _make(client)
    assert _put(client, item["id"], {"icon": "not-in-the-frontend-list"}).json()["icon"] == "not-in-the-frontend-list"


def test_lists_carry_the_icon_and_color(client):
    _make(client, "area", icon="home", color="slate")
    row = client.get("/api/items?type=area").json()[0]
    assert (row["icon"], row["color"]) == ("home", "slate")


def test_an_archived_item_cannot_change_its_icon(client):
    item = _make(client, icon="home")
    client.post(f"/api/items/{item['id']}/archive", headers=HEADERS)
    assert _put(client, item["id"], {"icon": "star"}).status_code == 403


def test_tasks_carry_the_icon_and_color_of_their_item(client):
    item = _make(client, icon="server", color="blue")
    r = client.post("/api/tasks", json={"title": "T", "item_id": item["id"]}, headers=HEADERS)
    assert (r.json()["item_icon"], r.json()["item_color"]) == ("server", "blue")
    inbox = client.post("/api/tasks", json={"title": "Loose"}, headers=HEADERS).json()
    assert inbox["item_icon"] is None and inbox["item_color"] is None
    today = client.get("/api/tasks?scope=all").json()
    assert {t["title"]: t["item_icon"] for t in today} == {"T": "server", "Loose": None}


def test_export_and_import_round_trip_and_old_files_import_without_them(client):
    _make(client, "area", icon="heart", color="pink")
    exported = client.get("/api/export").json()
    assert (exported["items"][0]["icon"], exported["items"][0]["color"]) == ("heart", "pink")
    assert client.post("/api/import?mode=merge", json=exported, headers=HEADERS).status_code == 200
    areas = client.get("/api/items?type=area").json()
    assert sorted((a["icon"], a["color"]) for a in areas) == [("heart", "pink"), ("heart", "pink")]

    for row in exported["items"]:
        row.pop("icon"), row.pop("color")
    assert client.post("/api/import?mode=merge", json=exported, headers=HEADERS).status_code == 200
    areas = client.get("/api/items?type=area").json()
    assert len(areas) == 3 and sum(1 for a in areas if a["icon"] is None) == 1


def test_import_refuses_a_bad_color_or_icon(client):
    _make(client, "area")
    exported = client.get("/api/export").json()
    exported["items"][0]["color"] = "red"
    assert client.post("/api/import?mode=merge", json=exported, headers=HEADERS).status_code == 400
    exported["items"][0]["color"] = None
    exported["items"][0]["icon"] = "Bad Key"
    assert client.post("/api/import?mode=merge", json=exported, headers=HEADERS).status_code == 400


def test_migration_010_adds_the_columns_and_leaves_existing_rows_null(tmp_path):
    db = tmp_path / "old.db"
    from alembic import command
    from alembic.config import Config as AlembicConfig
    import backend
    cfg = AlembicConfig()
    cfg.set_main_option("script_location", str(Path(backend.__file__).parent / "migrations"))
    cfg.set_main_option("sqlalchemy.url", f"sqlite:///{db}")
    cfg.set_main_option("path_separator", "os")
    command.upgrade(cfg, "009")

    con = sqlite3.connect(db)
    con.execute(
        "INSERT INTO items (id, type, title, description, notes, created_at, updated_at) "
        "VALUES (1, 'area', 'Home', '', '', '2026-10-01 00:00:00', '2026-10-02 00:00:00')"
    )
    con.execute(
        "INSERT INTO tasks (id, item_id, title, description, notes, priority, is_complete, sort_order, created_at, updated_at) "
        "VALUES (1, 1, 'T', '', '', 'medium', 0, 0, '2026-10-01 00:00:00', '2026-10-02 00:00:00')"
    )
    con.commit()
    con.close()

    command.upgrade(cfg, "010")

    con = sqlite3.connect(db)
    columns = [r[1] for r in con.execute("PRAGMA table_info(items)")]
    assert "icon" in columns and "color" in columns
    assert con.execute("SELECT title, icon, color FROM items").fetchall() == [("Home", None, None)]
    assert con.execute("SELECT COUNT(*) FROM tasks").fetchone()[0] == 1  # no cascade: the table was not rebuilt
    assert con.execute("SELECT version_num FROM alembic_version").fetchone()[0] == "010"
    assert con.execute("PRAGMA foreign_key_check").fetchall() == []
    con.close()
