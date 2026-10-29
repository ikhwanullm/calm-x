"""Meeting notes part B: carry-over from the previous meeting and the Weekly Review meetings list."""
import pytest

from backend.tests.test_api_meetings import HEADERS, _item, _meeting, _process, client  # noqa: F401

TODAY = "2026-10-29"


def _carry(client, item_id):
    r = client.get(f"/api/items/{item_id}/meetings/carry-over")
    assert r.status_code == 200, r.json()
    return r.json()


def _review(client, today=TODAY, **params):
    r = client.get("/api/weekly-review/meetings", params={"today": today, **params})
    assert r.status_code == 200, r.json()
    return r.json()


# ── carry-over ───────────────────────────────────────────────────────────────

def test_carry_over_is_null_for_an_item_without_meetings(client):
    assert _carry(client, _item(client)) is None


def test_carry_over_of_an_unknown_item_is_404(client):
    assert client.get("/api/items/9999/meetings/carry-over").status_code == 404


def test_carry_over_lists_questions_and_open_tasks_of_the_newest_meeting(client):
    item = _item(client)
    _meeting(client, item, title="Old", held_at="2026-10-01T03:00:00Z", body="? Old question\n")
    m = _meeting(client, item, title="Newest", held_at="2026-10-28T03:00:00Z",
                 body="? Who owns it?\n! Ship Friday\n- [ ] Send report\n@Budi: send logs\n- [ ] Book room\n")
    _process(client, m["id"],
             {"line": 2, "text": "Send report"}, {"line": 3, "text": "send logs"}, {"line": 4, "text": "Book room"})
    done = [t for t in client.get(f"/api/items/{item}/tasks").json() if t["title"] == "Send report"][0]
    assert client.post(f"/api/tasks/{done['id']}/complete", headers=HEADERS).status_code == 200

    carry = _carry(client, item)
    assert carry["meeting_id"] == m["id"] and carry["title"] == "Newest"
    assert carry["questions"] == ["Who owns it?"]
    assert [(t["title"], t["waiting_for"]) for t in carry["open_tasks"]] == [("send logs", "Budi"), ("Book room", None)]


def test_carry_over_ignores_tasks_not_made_from_that_meeting(client):
    item = _item(client)
    _meeting(client, item, body="nothing\n")
    client.post("/api/tasks", json={"title": "Unrelated", "item_id": item}, headers=HEADERS)
    assert _carry(client, item)["open_tasks"] == []


def test_carry_over_picks_the_meeting_by_held_at_not_creation_order(client):
    item = _item(client)
    _meeting(client, item, title="Later", held_at="2026-10-28T03:00:00Z", body="? later\n")
    _meeting(client, item, title="Earlier but entered last", held_at="2026-10-20T03:00:00Z", body="? earlier\n")
    assert _carry(client, item)["title"] == "Later"


# ── Weekly Review ────────────────────────────────────────────────────────────

def test_review_lists_meetings_of_the_past_week_with_actions_left(client):
    item = _item(client)
    _meeting(client, item, title="Today", held_at="2026-10-29T03:00:00Z", body="- [ ] a\n")
    _meeting(client, item, title="Six days ago", held_at="2026-10-23T03:00:00Z", body="@Sari: b\n")
    _meeting(client, item, title="Seven days ago", held_at="2026-10-22T03:00:00Z", body="- [ ] c\n")
    _meeting(client, item, title="Future", held_at="2026-10-30T03:00:00Z", body="- [ ] d\n")
    got = _review(client)
    assert [m["title"] for m in got] == ["Today", "Six days ago"]
    assert all(m["open_action_count"] > 0 for m in got)


def test_review_leaves_out_meetings_without_actions_or_fully_processed(client):
    item = _item(client)
    _meeting(client, item, title="Only notes", held_at="2026-10-28T03:00:00Z", body="? just a question\n")
    done = _meeting(client, item, title="Processed", held_at="2026-10-27T03:00:00Z", body="- [ ] a\n")
    _process(client, done["id"], {"line": 0, "text": "a"})
    todo = _meeting(client, item, title="Todo", held_at="2026-10-26T03:00:00Z", body="- [ ] a\n- [ ] b\n")
    _process(client, todo["id"], {"line": 0, "text": "a"})
    got = _review(client)
    assert [(m["title"], m["open_action_count"]) for m in got] == [("Todo", 1)]


def test_review_leaves_out_meetings_of_archived_items(client):
    item = _item(client)
    _meeting(client, item, held_at="2026-10-28T03:00:00Z", body="- [ ] a\n")
    assert client.post(f"/api/items/{item}/archive", headers=HEADERS).status_code == 200
    assert _review(client) == []


def test_review_window_follows_the_client_timezone(client):
    item = _item(client)
    # 2026-10-29 18:00 UTC is already 30 Oct in +07:00, so it is "in the future" for a client whose today is 29 Oct
    _meeting(client, item, title="Late", held_at="2026-10-29T18:00:00Z", body="- [ ] a\n")
    # 2026-10-22 18:00 UTC is 23 Oct 01:00 in +07:00: inside the window there, outside it in UTC? (22 Oct is day 7)
    _meeting(client, item, title="Edge", held_at="2026-10-22T18:00:00Z", body="- [ ] a\n")
    assert [m["title"] for m in _review(client)] == ["Late"]
    assert [m["title"] for m in _review(client, tz_offset="+07:00")] == ["Edge"]


def test_review_rejects_a_bad_date(client):
    assert client.get("/api/weekly-review/meetings", params={"today": "nope"}).status_code == 400
