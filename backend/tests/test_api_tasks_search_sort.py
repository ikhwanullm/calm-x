"""GET /api/tasks?scope=all: text search, status, state filters and sorting for the All tasks page."""
from backend.tests.test_api_meetings import HEADERS, _item, _meeting, client, _process  # noqa: F401

TODAY = "2026-10-29"


def _task(client, title, item_id=None, **fields):
    payload = {"title": title, **({"item_id": item_id} if item_id else {})}
    r = client.post("/api/tasks", json=payload, headers=HEADERS)
    assert r.status_code == 201, r.json()
    task = r.json()
    if fields:
        r = client.put(f"/api/tasks/{task['id']}", json=fields, headers=HEADERS)
        assert r.status_code == 200, r.json()
        task = r.json()
    return task


def _list(client, **params):
    r = client.get("/api/tasks", params={"scope": "all", **params})
    assert r.status_code == 200, r.json()
    return [t["title"] for t in r.json()]


def test_text_search_covers_title_description_and_notes_ignoring_case(client):
    _task(client, "Quarterly Report")
    _task(client, "other", description="mentions the REPORT here")
    _task(client, "third", notes="a report in the notes")
    _task(client, "unrelated")
    assert sorted(_list(client, q="report")) == ["Quarterly Report", "other", "third"]


def test_search_treats_percent_and_underscore_literally(client):
    _task(client, "100% done")
    _task(client, "a_b")
    _task(client, "axb")
    assert _list(client, q="100%") == ["100% done"]
    assert _list(client, q="a_b") == ["a_b"]


def test_status_open_completed_all(client):
    _task(client, "open one")
    done = _task(client, "done one")
    client.post(f"/api/tasks/{done['id']}/complete", headers=HEADERS)
    assert _list(client, status="open") == ["open one"]
    assert _list(client, status="completed") == ["done one"]
    assert sorted(_list(client, status="all")) == ["done one", "open one"]


def test_status_wins_over_include_complete(client):
    done = _task(client, "done one")
    client.post(f"/api/tasks/{done['id']}/complete", headers=HEADERS)
    assert _list(client, status="all", include_complete="false") == ["done one"]


def test_waiting_filter(client):
    _task(client, "plain")
    _task(client, "waits", waiting_for="Budi")
    assert _list(client, waiting="true") == ["waits"]
    assert _list(client, waiting="false") == ["plain"]


def test_someday_and_deferred_filters(client):
    _task(client, "normal")
    _task(client, "parked", is_someday=True)
    _task(client, "later", defer_until="2026-11-10")
    _task(client, "started", defer_until="2026-10-01")
    assert sorted(_list(client, someday="false", deferred="false", today=TODAY)) == ["normal", "started"]
    assert _list(client, someday="true") == ["parked"]
    assert _list(client, deferred="true", today=TODAY) == ["later"]


def test_deferred_needs_today(client):
    assert client.get("/api/tasks", params={"scope": "all", "deferred": "true"}).status_code == 400


def test_from_meeting_filter(client):
    item = _item(client)
    m = _meeting(client, item, body="- [ ] from notes\n")
    _process(client, m["id"], {"line": 0, "text": "from notes"})
    _task(client, "by hand", item_id=item)
    assert _list(client, from_meeting="true") == ["from notes"]
    assert _list(client, from_meeting="false") == ["by hand"]


def test_filters_combine_with_the_existing_ones(client):
    _task(client, "report high", priority="high", waiting_for="Budi")
    _task(client, "report low", priority="low", waiting_for="Budi")
    _task(client, "report plain", priority="high")
    assert _list(client, q="report", priorities="high", waiting="true") == ["report high"]


def test_sort_by_due_puts_tasks_without_a_date_last_in_both_directions(client):
    _task(client, "b", due_date="2026-11-02")
    _task(client, "none")
    _task(client, "a", due_date="2026-10-30")
    assert _list(client, sort="due") == ["a", "b", "none"]
    assert _list(client, sort="due", order="desc") == ["b", "a", "none"]


def test_sort_by_priority_with_ties_by_id(client):
    _task(client, "low", priority="low")
    _task(client, "high1", priority="high")
    _task(client, "mid")
    _task(client, "high2", priority="high")
    assert _list(client, sort="priority") == ["high1", "high2", "mid", "low"]
    assert _list(client, sort="priority", order="desc") == ["low", "mid", "high1", "high2"]


def test_sort_by_project_name_with_inbox_first(client):
    zed = _item(client, title="Zed")
    abc = _item(client, title="abc")
    _task(client, "in zed", item_id=zed)
    _task(client, "in abc", item_id=abc)
    _task(client, "inbox")
    assert _list(client, sort="project") == ["inbox", "in abc", "in zed"]
    assert _list(client, sort="project", order="desc") == ["in zed", "in abc", "inbox"]


def test_sort_by_created_and_updated(client):
    first = _task(client, "first")
    _task(client, "second")
    client.put(f"/api/tasks/{first['id']}", json={"title": "first edited"}, headers=HEADERS)
    assert _list(client, sort="created") == ["first edited", "second"]
    assert _list(client, sort="created", order="desc") == ["second", "first edited"]
    assert _list(client, sort="updated", order="desc")[0] == "first edited"


def test_unknown_sort_status_or_order_is_rejected(client):
    for params in ({"sort": "mood"}, {"status": "maybe"}, {"order": "sideways"}):
        assert client.get("/api/tasks", params={"scope": "all", **params}).status_code == 400


def test_without_the_new_params_the_old_order_and_content_stay(client):
    _task(client, "parked", is_someday=True)
    _task(client, "plain")
    assert sorted(_list(client)) == ["parked", "plain"]
