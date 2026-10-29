"""API tests for meeting notes (CRUD, action lines, processing, undo, export/import)."""
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
HELD = "2026-10-28T03:00:00Z"
NOTES = "## Actions\n- [ ] Send the report\n@Budi: send the logs\n- [ ] Book the room\n? Who owns it?\n! Ship Friday\n"


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


def _item(client, kind="project", title="Migrate CML"):
    r = client.post("/api/items", json={"type": kind, "title": title}, headers=HEADERS)
    assert r.status_code == 201, r.json()
    return r.json()["id"]


def _meeting(client, item_id, **extra):
    payload = {"title": "Kickoff", "held_at": HELD, "body": NOTES, **extra}
    r = client.post(f"/api/items/{item_id}/meetings", json=payload, headers=HEADERS)
    assert r.status_code == 201, r.json()
    return r.json()


def _process(client, meeting_id, *actions):
    return client.post(f"/api/meetings/{meeting_id}/process", json={"actions": list(actions)}, headers=HEADERS)


# ── create / read / update ───────────────────────────────────────────────────

def test_create_returns_the_meeting_with_its_item_and_action_count(client):
    item = _item(client, title="Migrate CML")
    m = _meeting(client, item, title="  Kickoff  ", attendees=" Budi, Sari ")
    assert m["title"] == "Kickoff" and m["attendees"] == "Budi, Sari"
    assert m["item_id"] == item and m["item_title"] == "Migrate CML" and m["item_type"] == "project"
    assert m["held_at"].startswith("2026-10-28T03:00:00")
    assert m["body"] == NOTES and m["open_action_count"] == 3 and m["processed_at"] is None
    assert client.get(f"/api/meetings/{m['id']}").json() == m


def test_meetings_work_on_areas_but_not_resources_or_missing_items(client):
    area = _item(client, "area", "Ops")
    assert _meeting(client, area)["item_type"] == "area"
    resource = _item(client, "resource", "Wiki")
    r = client.post(f"/api/items/{resource}/meetings", json={"title": "x", "held_at": HELD}, headers=HEADERS)
    assert r.status_code == 400
    r = client.post("/api/items/9999/meetings", json={"title": "x", "held_at": HELD}, headers=HEADERS)
    assert r.status_code == 404


def test_title_is_required_and_limited(client):
    item = _item(client)
    for title in ("", "   ", "x" * 201):
        r = client.post(f"/api/items/{item}/meetings", json={"title": title, "held_at": HELD}, headers=HEADERS)
        assert r.status_code == 400, title


def test_archived_item_makes_its_meetings_read_only(client):
    item = _item(client)
    m = _meeting(client, item)
    assert client.post(f"/api/items/{item}/archive", headers=HEADERS).status_code == 200
    assert client.put(f"/api/meetings/{m['id']}", json={"title": "New"}, headers=HEADERS).status_code == 403
    assert client.delete(f"/api/meetings/{m['id']}", headers=HEADERS).status_code == 403
    assert _process(client, m["id"], {"line": 1, "text": "Send the report"}).status_code == 403
    r = client.post(f"/api/items/{item}/meetings", json={"title": "x", "held_at": HELD}, headers=HEADERS)
    assert r.status_code == 403
    assert client.get(f"/api/meetings/{m['id']}").status_code == 200   # still readable


def test_update_changes_only_the_given_fields(client):
    m = _meeting(client, _item(client), attendees="Budi")
    r = client.put(f"/api/meetings/{m['id']}", json={"body": "[ ] Only one\n", "title": " Renamed "}, headers=HEADERS)
    assert r.status_code == 200
    got = r.json()
    assert got["title"] == "Renamed" and got["body"] == "[ ] Only one\n" and got["attendees"] == "Budi"
    assert got["open_action_count"] == 1 and got["held_at"] == m["held_at"]
    got = client.put(f"/api/meetings/{m['id']}", json={"held_at": "2026-11-02T08:30:00+07:00"}, headers=HEADERS).json()
    assert got["held_at"].startswith("2026-11-02T01:30:00")


@pytest.mark.parametrize("field", ["title", "held_at", "body"])
def test_required_fields_cannot_be_nulled(client, field):
    m = _meeting(client, _item(client))
    r = client.put(f"/api/meetings/{m['id']}", json={field: None}, headers=HEADERS)
    assert r.status_code == 400


def test_body_is_limited_to_50000_chars(client):
    item = _item(client)
    m = _meeting(client, item, body="x" * 50000)
    assert client.put(f"/api/meetings/{m['id']}", json={"body": "x" * 50001}, headers=HEADERS).status_code == 400


# ── lists and search ─────────────────────────────────────────────────────────

def test_item_list_is_newest_first_and_omits_the_body(client):
    item = _item(client)
    _meeting(client, item, title="Old", held_at="2026-10-01T09:00:00Z")
    _meeting(client, item, title="New", held_at="2026-10-20T09:00:00Z")
    _meeting(client, _item(client, title="Other"), title="Elsewhere")
    rows = client.get(f"/api/items/{item}/meetings").json()
    assert [r["title"] for r in rows] == ["New", "Old"]
    assert "body" not in rows[0]
    assert client.get("/api/items/9999/meetings").status_code == 404


def test_global_list_searches_title_attendees_and_notes(client):
    a, b = _item(client, title="A"), _item(client, title="B")
    _meeting(client, a, title="Budget review", attendees="Sari", body="nothing")
    _meeting(client, b, title="Weekly", attendees="Budi", body="talked about the firewall")
    _meeting(client, b, title="Other", attendees="", body="100% sure")

    def titles(q):
        return {m["title"] for m in client.get("/api/meetings", params={"q": q}).json()}

    assert titles("budget") == {"Budget review"}
    assert titles("budi") == {"Weekly"}
    assert titles("FIREWALL") == {"Weekly"}
    assert titles("%") == {"Other"}          # LIKE wildcards are escaped
    assert titles("_") == set()
    assert len(client.get("/api/meetings").json()) == 3


def test_global_search_finds_meetings(client):
    item = _item(client)
    m = _meeting(client, item, title="Firewall sync")
    hits = [r for r in client.get("/api/search", params={"q": "firewall"}).json() if r["type"] == "meeting"]
    assert [(h["id"], h["title"], h["item_id"], h["item_type"]) for h in hits] == [(m["id"], "Firewall sync", item, "project")]


# ── action lines ─────────────────────────────────────────────────────────────

def test_actions_endpoint_lists_lines_questions_and_decisions(client):
    m = _meeting(client, _item(client))
    data = client.get(f"/api/meetings/{m['id']}/actions").json()
    assert data["actions"] == [
        {"line": 1, "kind": "mine", "text": "Send the report", "who": None},
        {"line": 2, "kind": "waiting", "text": "send the logs", "who": "Budi"},
        {"line": 3, "kind": "mine", "text": "Book the room", "who": None},
    ]
    assert data["questions"] == [{"line": 4, "text": "Who owns it?"}]
    assert data["decisions"] == [{"line": 5, "text": "Ship Friday"}]
    assert data["converted"] == 0


# ── processing ───────────────────────────────────────────────────────────────

def test_process_creates_tasks_links_them_and_marks_the_lines(client):
    item = _item(client)
    m = _meeting(client, item)
    r = _process(
        client, m["id"],
        {"line": 1, "text": "Send the report", "due_date": "2026-11-05", "priority": "high"},
        {"line": 2, "text": "send the logs"},
    )
    assert r.status_code == 200, r.json()
    created = {t["title"]: t for t in r.json()["created"]}
    mine, waiting = created["Send the report"], created["send the logs"]
    assert mine["item_id"] == item and mine["meeting_id"] == m["id"] and mine["meeting_title"] == "Kickoff"
    assert mine["due_date"] == "2026-11-05" and mine["priority"] == "high" and mine["waiting_for"] is None
    assert waiting["waiting_for"] == "Budi" and waiting["waiting_since"] is not None and waiting["meeting_id"] == m["id"]
    meeting = r.json()["meeting"]
    assert meeting["processed_at"] is not None and meeting["open_action_count"] == 1
    assert meeting["body"] == "## Actions\n- [→] Send the report\n@→Budi: send the logs\n- [ ] Book the room\n? Who owns it?\n! Ship Friday\n"
    # The drawer data and the item's task list see the link too
    assert client.get(f"/api/tasks/{mine['id']}").json()["meeting_held_at"].startswith("2026-10-28T03:00:00")
    assert len(client.get(f"/api/items/{item}/tasks").json()) == 2


def test_processing_the_same_line_again_creates_nothing(client):
    item = _item(client)
    m = _meeting(client, item)
    assert _process(client, m["id"], {"line": 1, "text": "Send the report"}).status_code == 200
    again = _process(client, m["id"], {"line": 1, "text": "Send the report"})
    assert again.status_code == 409
    assert len(client.get(f"/api/items/{item}/tasks").json()) == 1


def test_a_changed_or_moved_line_is_refused_and_nothing_is_created(client):
    item = _item(client)
    m = _meeting(client, item)
    r = _process(client, m["id"], {"line": 1, "text": "Send the report"}, {"line": 3, "text": "Wrong text"})
    assert r.status_code == 409
    assert client.get(f"/api/items/{item}/tasks").json() == []
    assert client.get(f"/api/meetings/{m['id']}").json()["body"] == NOTES
    assert _process(client, m["id"], {"line": 0, "text": "Actions"}).status_code == 409   # not an action line
    assert _process(client, m["id"], {"line": 99, "text": "x"}).status_code == 409


def test_choosing_a_line_twice_or_nothing_is_a_400(client):
    m = _meeting(client, _item(client))
    assert _process(client, m["id"], {"line": 1, "text": "Send the report"}, {"line": 1, "text": "Send the report"}).status_code == 400
    assert _process(client, m["id"]).status_code == 400


def test_process_respects_the_100_task_limit_all_or_nothing(client):
    item = _item(client)
    for i in range(99):
        assert client.post("/api/tasks", json={"title": f"t{i}", "item_id": item}, headers=HEADERS).status_code == 201
    m = _meeting(client, item)
    r = _process(client, m["id"], {"line": 1, "text": "Send the report"}, {"line": 3, "text": "Book the room"})
    assert r.status_code == 400
    assert len(client.get(f"/api/items/{item}/tasks").json()) == 99
    assert _process(client, m["id"], {"line": 1, "text": "Send the report"}).status_code == 200


def test_a_very_long_action_line_becomes_a_truncated_title_with_the_full_text_in_the_description(client):
    long_text = "word " * 80  # 400 chars
    m = _meeting(client, _item(client), body=f"[ ] {long_text}\n")
    r = _process(client, m["id"], {"line": 0, "text": long_text.strip()})
    task = r.json()["created"][0]
    assert len(task["title"]) <= 200 and task["title"].endswith("…")
    assert task["description"] == long_text.strip()


# ── delete and undo ──────────────────────────────────────────────────────────

def test_deleting_a_meeting_keeps_its_tasks_but_unlinks_them(client):
    item = _item(client)
    m = _meeting(client, item)
    tid = _process(client, m["id"], {"line": 1, "text": "Send the report"}).json()["created"][0]["id"]
    assert client.delete(f"/api/meetings/{m['id']}", headers=HEADERS).status_code == 204
    assert client.get(f"/api/meetings/{m['id']}").status_code == 404
    task = client.get(f"/api/tasks/{tid}").json()
    assert task["meeting_id"] is None and task["meeting_title"] is None


def test_undo_restores_the_meeting_and_relinks_its_tasks(client):
    item = _item(client)
    m = _meeting(client, item, attendees="Budi")
    made = _process(client, m["id"], {"line": 1, "text": "Send the report"}).json()
    tid = made["created"][0]["id"]
    body_after = made["meeting"]["body"]
    client.delete(f"/api/meetings/{m['id']}", headers=HEADERS)
    r = client.post(f"/api/meetings/{m['id']}/restore", headers=HEADERS)
    assert r.status_code == 201, r.json()
    back = r.json()
    assert back["id"] == m["id"] and back["body"] == body_after and back["attendees"] == "Budi"
    assert back["held_at"] == m["held_at"] and back["processed_at"] is not None
    assert client.get(f"/api/tasks/{tid}").json()["meeting_id"] == m["id"]
    assert client.post(f"/api/meetings/{m['id']}/restore", headers=HEADERS).status_code == 404   # used up


def test_undo_is_refused_when_the_item_is_archived_or_gone(client):
    item = _item(client)
    m = _meeting(client, item)
    client.delete(f"/api/meetings/{m['id']}", headers=HEADERS)
    client.post(f"/api/items/{item}/archive", headers=HEADERS)
    assert client.post(f"/api/meetings/{m['id']}/restore", headers=HEADERS).status_code == 403
    client.delete(f"/api/items/{item}", headers=HEADERS)
    assert client.post(f"/api/meetings/{m['id']}/restore", headers=HEADERS).status_code == 404


def test_undoing_a_deleted_task_keeps_its_meeting_link(client):
    m = _meeting(client, _item(client))
    tid = _process(client, m["id"], {"line": 1, "text": "Send the report"}).json()["created"][0]["id"]
    client.delete(f"/api/tasks/{tid}", headers=HEADERS)
    assert client.post(f"/api/tasks/{tid}/restore", headers=HEADERS).json()["meeting_id"] == m["id"]


def test_deleting_an_item_deletes_its_meetings(client):
    item = _item(client)
    _meeting(client, item)
    _meeting(client, _item(client, title="Other"), title="Stays")
    assert client.delete(f"/api/items/{item}", headers=HEADERS).status_code == 204
    assert [m["title"] for m in client.get("/api/meetings").json()] == ["Stays"]


def test_an_item_with_meetings_cannot_become_a_resource(client):
    item = _item(client)
    m = _meeting(client, item)
    r = client.post(f"/api/items/{item}/convert", json={"target_type": "resource"}, headers=HEADERS)
    assert r.status_code == 400 and "meeting" in r.json()["error"]
    assert client.post(f"/api/items/{item}/convert", json={"target_type": "area"}, headers=HEADERS).status_code == 200
    client.delete(f"/api/meetings/{m['id']}", headers=HEADERS)
    assert client.post(f"/api/items/{item}/convert", json={"target_type": "resource"}, headers=HEADERS).status_code == 200


# ── export / import ──────────────────────────────────────────────────────────

def test_export_import_round_trip_remaps_meetings_and_task_links(client):
    item = _item(client)
    m = _meeting(client, item, attendees="Budi")
    _process(client, m["id"], {"line": 1, "text": "Send the report"})
    exported = client.get("/api/export").json()
    assert [x["title"] for x in exported["meetings"]] == ["Kickoff"]
    assert exported["tasks"][0]["meeting_id"] == m["id"]

    assert client.post("/api/import?mode=merge", json=exported, headers=HEADERS).status_code == 200
    meetings = client.get("/api/meetings").json()
    assert len(meetings) == 2 and len({x["id"] for x in meetings}) == 2
    copy_id = next(x["id"] for x in meetings if x["id"] != m["id"])
    copied = client.get(f"/api/meetings/{copy_id}").json()
    assert copied["attendees"] == "Budi" and copied["held_at"] == m["held_at"] and copied["item_id"] != item
    linked = {t["meeting_id"] for t in client.get("/api/tasks?scope=all").json()}
    assert linked == {m["id"], copy_id}


def test_an_export_from_before_meetings_still_imports(client):
    _item(client)
    exported = client.get("/api/export").json()
    exported.pop("meetings")
    for t in exported["tasks"]:
        t.pop("meeting_id", None)
    assert client.post("/api/import?mode=merge", json=exported, headers=HEADERS).status_code == 200


@pytest.mark.parametrize("mutate", [
    lambda d: d["meetings"][0].update(item_id=9999),
    lambda d: d["meetings"][0].update(title=""),
    lambda d: d["meetings"][0].update(held_at="not a date"),
    lambda d: d["meetings"][0].update(body="x" * 50001),
    lambda d: d["tasks"][0].update(meeting_id=9999),
    lambda d: d.update(meetings="nope"),
])
def test_import_rejects_broken_meeting_data(client, mutate):
    item = _item(client)
    m = _meeting(client, item)
    _process(client, m["id"], {"line": 1, "text": "Send the report"})
    exported = client.get("/api/export").json()
    mutate(exported)
    assert client.post("/api/import?mode=merge", json=exported, headers=HEADERS).status_code == 400


# ── migration ────────────────────────────────────────────────────────────────

def test_migration_008_adds_meetings_without_touching_rows(tmp_path):
    db = tmp_path / "old.db"
    from alembic import command
    from alembic.config import Config as AlembicConfig
    import backend
    cfg = AlembicConfig()
    cfg.set_main_option("script_location", str(Path(backend.__file__).parent / "migrations"))
    cfg.set_main_option("sqlalchemy.url", f"sqlite:///{db}")
    cfg.set_main_option("path_separator", "os")
    command.upgrade(cfg, "007")

    con = sqlite3.connect(db)
    con.execute(
        "INSERT INTO tasks (id, item_id, title, description, notes, priority, is_complete, sort_order, created_at, updated_at) "
        "VALUES (1, NULL, 'Keep task', '', '', 'high', 0, 0, '2026-10-01 00:00:00', '2026-10-01 00:00:00')"
    )
    con.commit()
    con.close()

    command.upgrade(cfg, "008")

    con = sqlite3.connect(db)
    assert "meeting_id" in [r[1] for r in con.execute("PRAGMA table_info(tasks)")]
    assert [r[1] for r in con.execute("PRAGMA table_info(meetings)")] == [
        "id", "item_id", "title", "held_at", "attendees", "body", "processed_at", "created_at", "updated_at",
    ]
    assert con.execute("SELECT title, priority, meeting_id FROM tasks").fetchall() == [("Keep task", "high", None)]
    assert con.execute("SELECT version_num FROM alembic_version").fetchone()[0] == "008"
    con.close()
