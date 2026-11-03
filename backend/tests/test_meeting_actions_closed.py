"""meetings.actions_closed_at: "Nothing more to process" takes a meeting out of every to-process list."""
import sqlite3
from pathlib import Path

from backend.tests.test_api_meetings import HEADERS, HELD, NOTES, _item, _meeting, _process, client  # noqa: F401

TODAY = "2026-10-29"  # HELD is 2026-10-28, inside the review window


def _review(client):
    r = client.get("/api/weekly-review/meetings", params={"today": TODAY})
    assert r.status_code == 200, r.json()
    return [m["id"] for m in r.json()]


def _close(client, meeting_id):
    return client.post(f"/api/meetings/{meeting_id}/close-actions", headers=HEADERS)


def _reopen(client, meeting_id):
    return client.post(f"/api/meetings/{meeting_id}/reopen-actions", headers=HEADERS)


def test_a_new_meeting_is_not_closed(client):
    m = _meeting(client, _item(client))
    assert m["actions_closed_at"] is None and m["open_action_count"] == 3


def test_closing_takes_the_meeting_out_of_the_review_and_zeroes_its_open_actions(client):
    m = _meeting(client, _item(client))
    assert _review(client) == [m["id"]]

    r = _close(client, m["id"])
    assert r.status_code == 200, r.json()
    assert r.json()["actions_closed_at"] is not None and r.json()["open_action_count"] == 0
    assert _review(client) == []
    assert client.get(f"/api/meetings/{m['id']}").json()["open_action_count"] == 0
    assert [x["open_action_count"] for x in client.get("/api/meetings").json()] == [0]
    # the lines are still in the notes as written, and still listed for the meeting page
    assert client.get(f"/api/meetings/{m['id']}").json()["body"] == NOTES
    assert len(client.get(f"/api/meetings/{m['id']}/actions").json()["actions"]) == 3


def test_reopening_brings_the_meeting_back(client):
    m = _meeting(client, _item(client))
    _close(client, m["id"])
    r = _reopen(client, m["id"])
    assert r.status_code == 200 and r.json()["actions_closed_at"] is None and r.json()["open_action_count"] == 3
    assert _review(client) == [m["id"]]


def test_new_lines_typed_later_do_not_reopen_it(client):
    m = _meeting(client, _item(client))
    _close(client, m["id"])
    client.put(f"/api/meetings/{m['id']}", json={"body": NOTES + "- [ ] A new one\n"}, headers=HEADERS)
    assert client.get(f"/api/meetings/{m['id']}").json()["actions_closed_at"] is not None
    assert _review(client) == []


def test_processing_still_works_on_a_closed_meeting_and_keeps_it_closed(client):
    m = _meeting(client, _item(client))
    _close(client, m["id"])
    r = _process(client, m["id"], {"line": 1, "text": "Send the report"})
    assert r.status_code == 200, r.json()
    assert r.json()["meeting"]["actions_closed_at"] is not None
    assert len(r.json()["created"]) == 1


def test_closing_is_refused_for_an_archived_item_and_an_unknown_meeting(client):
    item = _item(client)
    m = _meeting(client, item)
    client.post(f"/api/items/{item}/archive", headers=HEADERS)
    assert _close(client, m["id"]).status_code == 403
    assert _reopen(client, m["id"]).status_code == 403
    assert _close(client, 9999).status_code == 404


def test_export_and_import_keep_the_flag_and_old_files_import_open(client):
    m = _meeting(client, _item(client))
    _close(client, m["id"])
    exported = client.get("/api/export").json()
    assert exported["meetings"][0]["actions_closed_at"] is not None
    assert client.post("/api/import?mode=merge", json=exported, headers=HEADERS).status_code == 200
    copies = [x for x in client.get("/api/meetings").json() if x["id"] != m["id"]]
    assert len(copies) == 1 and copies[0]["actions_closed_at"] is not None

    for row in exported["meetings"]:
        row.pop("actions_closed_at")
    assert client.post("/api/import?mode=merge", json=exported, headers=HEADERS).status_code == 200
    ids = {m["id"], copies[0]["id"]}
    third = [x for x in client.get("/api/meetings").json() if x["id"] not in ids]
    assert len(third) == 1 and third[0]["actions_closed_at"] is None


def test_undoing_a_deleted_closed_meeting_keeps_the_flag(client):
    m = _meeting(client, _item(client))
    _close(client, m["id"])
    assert client.delete(f"/api/meetings/{m['id']}", headers=HEADERS).status_code == 204
    r = client.post(f"/api/meetings/{m['id']}/restore", headers=HEADERS)
    assert r.status_code in (200, 201), r.json()
    assert r.json()["actions_closed_at"] is not None and r.json()["open_action_count"] == 0


def test_migration_011_adds_the_column_and_leaves_existing_meetings_open(tmp_path):
    db = tmp_path / "old.db"
    from alembic import command
    from alembic.config import Config as AlembicConfig
    import backend
    cfg = AlembicConfig()
    cfg.set_main_option("script_location", str(Path(backend.__file__).parent / "migrations"))
    cfg.set_main_option("sqlalchemy.url", f"sqlite:///{db}")
    cfg.set_main_option("path_separator", "os")
    command.upgrade(cfg, "010")

    con = sqlite3.connect(db)
    con.execute(
        "INSERT INTO items (id, type, title, description, notes, created_at, updated_at) "
        "VALUES (1, 'area', 'Home', '', '', '2026-10-01 00:00:00', '2026-10-02 00:00:00')"
    )
    con.execute(
        "INSERT INTO meetings (id, item_id, title, held_at, attendees, body, created_at, updated_at) "
        "VALUES (1, 1, 'Old', '2026-10-01 03:00:00', '', '[ ] x', '2026-10-01 00:00:00', '2026-10-02 00:00:00')"
    )
    con.commit()
    con.close()

    command.upgrade(cfg, "011")

    con = sqlite3.connect(db)
    assert "actions_closed_at" in [r[1] for r in con.execute("PRAGMA table_info(meetings)")]
    assert con.execute("SELECT title, actions_closed_at FROM meetings").fetchall() == [("Old", None)]
    assert con.execute("SELECT version_num FROM alembic_version").fetchone()[0] == "011"
    assert con.execute("PRAGMA foreign_key_check").fetchall() == []
    con.close()
