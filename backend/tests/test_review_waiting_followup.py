"""Weekly Review: the Waiting for step (GET /weekly-review/waiting) and POST /tasks/{id}/follow-up."""
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import sessionmaker

from backend.models.item import Task
from backend.tests.test_api_meetings import HEADERS, _item, client  # noqa: F401

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


def _backdate(client, task_id, days):
    """Pretend the wait started `days` days before TODAY (the API cannot set waiting_since)."""
    factory = next(iter(client.app.dependency_overrides.values()))
    session = next(factory())
    try:
        t = session.get(Task, task_id)
        t.waiting_since = datetime(2026, 10, 29, 10, tzinfo=timezone.utc) - timedelta(days=days)
        session.commit()
    finally:
        session.close()


def _waiting(client, **params):
    r = client.get("/api/weekly-review/waiting", params={"today": TODAY, **params})
    assert r.status_code == 200, r.json()
    return r.json()


# ── follow-up ────────────────────────────────────────────────────────────────

def test_follow_up_restarts_the_wait(client):
    t = _task(client, "ask", waiting_for="Budi")
    _backdate(client, t["id"], 12)
    assert _waiting(client)[0]["waiting_days"] == 12
    r = client.post(f"/api/tasks/{t['id']}/follow-up", headers=HEADERS)
    assert r.status_code == 200 and r.json()["waiting_for"] == "Budi"
    assert r.json()["waiting_since"] > "2026-10-29"   # now, later than the faked date
    assert _waiting(client)[0]["waiting_days"] == 0


def test_follow_up_needs_a_waiting_task(client):
    t = _task(client, "plain")
    assert client.post(f"/api/tasks/{t['id']}/follow-up", headers=HEADERS).status_code == 400
    assert client.post("/api/tasks/9999/follow-up", headers=HEADERS).status_code == 404


def test_follow_up_is_refused_for_a_task_of_an_archived_item(client):
    item = _item(client)
    t = _task(client, "ask", item_id=item, waiting_for="Budi")
    client.post(f"/api/items/{item}/archive", headers=HEADERS)
    assert client.post(f"/api/tasks/{t['id']}/follow-up", headers=HEADERS).status_code == 403


# ── review list ──────────────────────────────────────────────────────────────

def test_the_review_lists_every_wait_not_only_long_ones_oldest_first(client):
    item = _item(client, title="Migrate")
    fresh = _task(client, "fresh", waiting_for="A")
    old = _task(client, "old", item_id=item, waiting_for="B", due_date="2026-10-31")
    _backdate(client, fresh["id"], 1)
    _backdate(client, old["id"], 10)
    got = _waiting(client)
    assert [(w["title"], w["waiting_for"], w["waiting_days"]) for w in got] == [("old", "B", 10), ("fresh", "A", 1)]
    assert got[0]["item_title"] == "Migrate" and got[0]["item_type"] == "project" and got[0]["due_date"] == "2026-10-31"
    assert got[1]["item_id"] is None and got[1]["due_date"] is None


def test_the_review_leaves_out_done_someday_and_archived(client):
    done = _task(client, "done", waiting_for="A")
    client.post(f"/api/tasks/{done['id']}/complete", headers=HEADERS)
    parked = _task(client, "parked", waiting_for="A", is_someday=True)
    item = _item(client)
    gone = _task(client, "gone", item_id=item, waiting_for="A")
    kept = _task(client, "kept", waiting_for="A")
    for t in (done, parked, gone, kept):
        _backdate(client, t["id"], 3)
    client.post(f"/api/items/{item}/archive", headers=HEADERS)
    assert [w["title"] for w in _waiting(client)] == ["kept"]


def test_the_review_waiting_list_rejects_a_bad_date(client):
    assert client.get("/api/weekly-review/waiting", params={"today": "x"}).status_code == 400
