"""`[x]` lines: handled without a task. Parser, `mark_closed` and `POST /api/meetings/{id}/close-lines`."""
from backend.services.meeting_parser import mark_closed, parse_meeting
from backend.tests.test_api_meetings import HEADERS, _item, _meeting, _process, client  # noqa: F401


# ── parser ───────────────────────────────────────────────────────────────────

def test_x_lines_are_closed_not_actions():
    body = "[x] lower\n[X] upper\n- [x] in a list\n  * [X] indented\n[ ] still open\n"
    parsed = parse_meeting(body)
    assert parsed.closed == 4
    assert [(a.line, a.text) for a in parsed.actions] == [(4, "still open")]


def test_x_wins_over_the_waiting_rule():
    parsed = parse_meeting("[x] @Budi: send the logs\n- [X] @Budi: again\n")
    assert parsed.closed == 2 and parsed.actions == []


def test_x_lines_inside_a_fence_or_without_text_are_ignored():
    parsed = parse_meeting("```\n[x] in code\n```\n[x]\n- [X] \n")
    assert parsed.closed == 0 and parsed.actions == []


def test_converted_and_closed_are_counted_apart():
    parsed = parse_meeting("[→] made a task\n@→Budi: made a task\n[x] handled\n")
    assert (parsed.converted, parsed.closed) == (2, 1)


def test_mark_closed_rewrites_only_the_chosen_lines_and_keeps_prefixes_and_line_endings():
    body = "[ ] one\r\n- [ ] two\n@Budi: three\n- @Ani : four\n[ ] five\n"
    parsed = parse_meeting(body)
    out = mark_closed(body, parsed.actions[:4])
    assert out == "[x] one\r\n- [x] two\n[x] @Budi: three\n- [x] @Ani: four\n[ ] five\n"
    again = parse_meeting(out)
    assert again.closed == 4 and [a.text for a in again.actions] == ["five"]


# ── API ──────────────────────────────────────────────────────────────────────

def _close(client, meeting_id, *lines):
    return client.post(f"/api/meetings/{meeting_id}/close-lines", json={"lines": list(lines)}, headers=HEADERS)


def test_close_lines_marks_them_x_and_they_stop_being_open_actions(client):
    item = _item(client)
    m = _meeting(client, item, body="[ ] Write runbook\n@Budi: send the logs\n[ ] Keep open\n")
    actions = client.get(f"/api/meetings/{m['id']}/actions").json()
    assert m["open_action_count"] == 3 and actions["closed"] == 0

    r = _close(client, m["id"], {"line": 0, "text": "Write runbook"}, {"line": 1, "text": "send the logs"})
    assert r.status_code == 200, r.json()
    assert r.json()["body"] == "[x] Write runbook\n[x] @Budi: send the logs\n[ ] Keep open\n"
    assert r.json()["open_action_count"] == 1

    after = client.get(f"/api/meetings/{m['id']}/actions").json()
    assert after["closed"] == 2 and [a["text"] for a in after["actions"]] == ["Keep open"]
    assert client.get("/api/tasks?scope=all").json() == []  # no task was made


def test_a_closed_line_cannot_be_processed_into_a_task(client):
    item = _item(client)
    m = _meeting(client, item, body="[ ] Write runbook\n")
    assert _close(client, m["id"], {"line": 0, "text": "Write runbook"}).status_code == 200
    assert _process(client, m["id"], {"line": 0, "text": "Write runbook"}).status_code == 409
    assert client.get("/api/tasks?scope=all").json() == []


def test_close_lines_is_refused_with_409_and_changes_nothing_when_a_line_moved(client):
    item = _item(client)
    m = _meeting(client, item, body="[ ] One\n[ ] Two\n")
    client.put(f"/api/meetings/{m['id']}", json={"body": "Intro\n[ ] One\n[ ] Two\n"}, headers=HEADERS)
    r = _close(client, m["id"], {"line": 1, "text": "Two"}, {"line": 0, "text": "One"})
    assert r.status_code == 409
    assert client.get(f"/api/meetings/{m['id']}").json()["body"] == "Intro\n[ ] One\n[ ] Two\n"


def test_close_lines_refuses_a_line_chosen_twice_and_an_archived_item(client):
    item = _item(client)
    m = _meeting(client, item, body="[ ] One\n")
    assert _close(client, m["id"], {"line": 0, "text": "One"}, {"line": 0, "text": "One"}).status_code == 400
    client.post(f"/api/items/{item}/archive", headers=HEADERS)
    assert _close(client, m["id"], {"line": 0, "text": "One"}).status_code == 403
