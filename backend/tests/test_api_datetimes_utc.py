"""Every datetime in an API response carries a timezone (the browser reads a bare ISO string as local time).

Values just written are naive UTC in memory (`now_utc()`); the shared response base class makes them aware.
"""
import re

from backend.tests.test_api_meetings import HEADERS, _item, _meeting, client  # noqa: F401

DATETIME = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}")
ZONE = re.compile(r"(Z|[+-]\d{2}:\d{2})$")


def _walk(value, path, bad):
    if isinstance(value, dict):
        for k, v in value.items():
            _walk(v, f"{path}.{k}", bad)
    elif isinstance(value, list):
        for i, v in enumerate(value):
            _walk(v, f"{path}[{i}]", bad)
    elif isinstance(value, str) and DATETIME.match(value) and not ZONE.search(value):
        bad.append(f"{path} = {value}")


def _check(resp, label):
    assert resp.status_code < 400, (label, resp.status_code, resp.text[:200])
    bad: list[str] = []
    _walk(resp.json() if resp.content else None, label, bad)
    assert not bad, bad
    return resp


def test_the_checker_catches_a_bare_datetime():
    bad: list[str] = []
    _walk({"a": [{"created_at": "2026-11-02T10:00:00"}, {"ok": "2026-11-02T10:00:00Z", "d": "2026-11-02"}]}, "x", bad)
    assert bad == ["x.a[0].created_at = 2026-11-02T10:00:00"]


def test_items_right_after_a_write(client):
    post = lambda body: _check(client.post("/api/items", json=body, headers=HEADERS), "create item")
    project = post({"type": "project", "title": "P"}).json()["id"]
    post({"type": "area", "title": "A"})
    resource = post({"type": "resource", "title": "R"}).json()["id"]
    _check(client.put(f"/api/items/{project}", json={"title": "P2"}, headers=HEADERS), "update item")
    _check(client.get(f"/api/items/{project}"), "get item")
    _check(client.get(f"/api/items/{project}", params={"today": "2026-11-02"}), "get item with stats")
    _check(client.get("/api/items", params={"today": "2026-11-02"}), "list items with stats")
    _check(client.post(f"/api/items/{project}/complete", headers=HEADERS), "complete project")
    _check(client.post(f"/api/items/{project}/reopen", headers=HEADERS), "reopen project")
    _check(client.post(f"/api/items/{project}/archive", headers=HEADERS), "archive item")
    _check(client.get("/api/items", params={"archived": "only"}), "list archived")
    _check(client.post(f"/api/items/{project}/restore", headers=HEADERS), "restore item")
    _check(client.post(f"/api/items/{resource}/links", json={"url": "https://a.example"}, headers=HEADERS), "reference link")
    _check(client.get(f"/api/items/{resource}/links"), "list reference links")


def test_tasks_subtasks_and_tags_right_after_a_write(client):
    item = _item(client)
    task = _check(client.post("/api/tasks", json={"title": "T", "item_id": item, "tag_names": ["x"]}, headers=HEADERS), "create task").json()
    tid = task["id"]
    _check(client.put(f"/api/tasks/{tid}", json={"waiting_for": "Budi"}, headers=HEADERS), "update task")
    _check(client.post(f"/api/tasks/{tid}/follow-up", headers=HEADERS), "follow up")
    _check(client.post(f"/api/tasks/{tid}/complete", headers=HEADERS), "complete")
    _check(client.post(f"/api/tasks/{tid}/incomplete", headers=HEADERS), "incomplete")
    _check(client.get(f"/api/tasks/{tid}"), "get task")
    _check(client.get("/api/tasks", params={"scope": "all"}), "list tasks")
    _check(client.get("/api/tasks/today", params={"today": "2026-11-02"}), "today")
    _check(client.get("/api/tasks/inbox"), "inbox")
    _check(client.post("/api/tasks/quick-capture", json={"title": "Q"}, headers=HEADERS), "quick capture")
    sub = _check(client.post(f"/api/tasks/{tid}/subtasks", json={"title": "s"}, headers=HEADERS), "create subtask").json()
    _check(client.post(f"/api/subtasks/{sub['id']}/complete", headers=HEADERS), "complete subtask")
    _check(client.get(f"/api/tasks/{tid}/subtasks"), "list subtasks")
    _check(client.post("/api/tags", json={"name": "newtag"}, headers=HEADERS), "create tag")
    _check(client.get("/api/tags"), "list tags")
    _check(client.get("/api/calendar/week", params={"start": "2026-11-02", "today": "2026-11-02"}), "calendar")


def test_meetings_right_after_a_write(client):
    item = _item(client)
    m = _meeting(client, item, body="- [ ] a\n")
    _check(client.get(f"/api/meetings/{m['id']}"), "get meeting")
    _check(client.put(f"/api/meetings/{m['id']}", json={"title": "New"}, headers=HEADERS), "update meeting")
    process = client.post(
        f"/api/meetings/{m['id']}/process", json={"actions": [{"line": 0, "text": "a"}]}, headers=HEADERS
    )
    _check(process, "process meeting")
    _check(client.get("/api/meetings"), "list meetings")
    _check(client.get(f"/api/items/{item}/meetings/carry-over"), "carry-over")
    _check(client.get("/api/weekly-review/meetings", params={"today": "2026-11-02"}), "review meetings")


def test_templates_reviews_dashboard_and_backups(client):
    tpl = _check(client.post("/api/templates", json={"title": "Tpl", "description": ""}, headers=HEADERS), "create template").json()
    _check(client.post(f"/api/templates/{tpl['id']}/tasks", json={"title": "Step"}, headers=HEADERS), "template task")
    _check(client.get(f"/api/templates/{tpl['id']}"), "get template")
    _check(client.get("/api/templates"), "list templates")
    _check(client.post(f"/api/templates/{tpl['id']}/create-project", json={"title": "FromTpl", "start_date": "2026-11-02"}, headers=HEADERS), "from template")
    _check(client.post("/api/weekly-review/complete", json={"notes": ""}, headers=HEADERS), "complete review")
    _check(client.get("/api/weekly-review/history"), "review history")
    _check(client.get("/api/weekly-review/waiting", params={"today": "2026-11-02"}), "review waiting")
    _check(client.get("/api/dashboard", params={"today": "2026-11-02"}), "dashboard")
    _check(client.get("/api/search", params={"q": "T"}), "search")
