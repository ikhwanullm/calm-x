"""GET /api/items?type=project&today=... adds per-project stats for the Projects list."""
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import event
from sqlalchemy.engine import Engine

from backend.tests.test_api_meetings import HEADERS, _item, _meeting, client  # noqa: F401

TODAY = "2026-10-29"


def _projects(client, **params):
    r = client.get("/api/items", params={"type": "project", "today": TODAY, **params})
    assert r.status_code == 200, r.json()
    return r.json()


def _stats(client, item_id):
    return next(p for p in _projects(client) if p["id"] == item_id)["stats"]


def _task(client, item_id, title, **fields):
    r = client.post("/api/tasks", json={"title": title, "item_id": item_id}, headers=HEADERS)
    assert r.status_code == 201, r.json()
    task = r.json()
    if fields:
        r = client.put(f"/api/tasks/{task['id']}", json=fields, headers=HEADERS)
        assert r.status_code == 200, r.json()
        task = r.json()
    return task


def test_stats_are_only_sent_when_today_is_given(client):
    _item(client)
    assert client.get("/api/items", params={"type": "project"}).json()[0]["stats"] is None
    assert _projects(client)[0]["stats"] is not None


def test_a_bad_today_is_rejected(client):
    assert client.get("/api/items", params={"type": "project", "today": "x"}).status_code == 400


def test_areas_get_no_stats_even_with_today(client):
    _item(client, kind="area")
    r = client.get("/api/items", params={"type": "area", "today": TODAY}).json()
    assert "stats" not in r[0] or r[0]["stats"] is None


def test_an_empty_project_has_zeroes_and_no_next_task(client):
    s = _stats(client, _item(client))
    assert (s["open_task_count"], s["overdue_task_count"], s["waiting_task_count"], s["linked_resource_count"]) == (0, 0, 0, 0)
    assert s["next_task"] is None and s["next_meeting_at"] is None and s["last_meeting_at"] is None
    assert s["last_activity_at"]


def test_counts_open_overdue_and_waiting_relative_to_today(client):
    p = _item(client)
    _task(client, p, "late", due_date="2026-10-28")
    _task(client, p, "due today", due_date=TODAY)
    _task(client, p, "waiting late", due_date="2026-10-01", waiting_for="Budi")
    done = _task(client, p, "done late", due_date="2026-10-01")
    client.post(f"/api/tasks/{done['id']}/complete", headers=HEADERS)
    _task(client, p, "parked", due_date="2026-10-01", is_someday=True)
    s = _stats(client, p)
    assert (s["open_task_count"], s["overdue_task_count"], s["waiting_task_count"]) == (3, 2, 1)


def test_next_task_is_the_earliest_due_else_first_by_order(client):
    p = _item(client)
    _task(client, p, "no date first")
    _task(client, p, "later", due_date="2026-11-05")
    _task(client, p, "soonest", due_date="2026-10-30")
    assert _stats(client, p)["next_task"]["title"] == "soonest"
    assert _stats(client, p)["next_task"]["due_date"] == "2026-10-30"
    q = _item(client, title="Undated")
    _task(client, q, "first")
    _task(client, q, "second")
    assert _stats(client, q)["next_task"]["title"] == "first"


def test_next_task_skips_done_someday_and_not_yet_started_tasks(client):
    p = _item(client)
    done = _task(client, p, "done", due_date="2026-10-01")
    client.post(f"/api/tasks/{done['id']}/complete", headers=HEADERS)
    _task(client, p, "parked", due_date="2026-10-02", is_someday=True)
    _task(client, p, "starts later", defer_until="2026-11-10")
    _task(client, p, "real", due_date="2026-12-01")
    assert _stats(client, p)["next_task"]["title"] == "real"


def test_meetings_give_next_and_last(client):
    p = _item(client)
    now = datetime.now(timezone.utc)
    _meeting(client, p, title="old", held_at=(now - timedelta(days=9)).isoformat(), body="x\n")
    _meeting(client, p, title="recent", held_at=(now - timedelta(days=2)).isoformat(), body="x\n")
    _meeting(client, p, title="soon", held_at=(now + timedelta(days=1)).isoformat(), body="x\n")
    _meeting(client, p, title="later", held_at=(now + timedelta(days=8)).isoformat(), body="x\n")
    s = _stats(client, p)
    got_last = datetime.fromisoformat(s["last_meeting_at"].replace("Z", "+00:00"))
    got_next = datetime.fromisoformat(s["next_meeting_at"].replace("Z", "+00:00"))
    assert abs((got_last - (now - timedelta(days=2))).total_seconds()) < 5
    assert abs((got_next - (now + timedelta(days=1))).total_seconds()) < 5


def test_linked_resources_count_only_active_ones(client):
    p = _item(client)
    live = _item(client, kind="resource", title="Doc")
    gone = _item(client, kind="resource", title="Old doc")
    for rid in (live, gone):
        assert client.post(f"/api/resources/{rid}/link", json={"linked_item_id": p}, headers=HEADERS).status_code == 201
    client.post(f"/api/items/{gone}/archive", headers=HEADERS)
    assert _stats(client, p)["linked_resource_count"] == 1


def test_last_activity_is_the_latest_of_project_tasks_and_meetings(client):
    p = _item(client)
    before = _stats(client, p)["last_activity_at"]
    _task(client, p, "new work")
    after = _stats(client, p)["last_activity_at"]
    assert after >= before
    _meeting(client, p, held_at="2020-01-01T00:00:00Z", body="x\n")
    assert _stats(client, p)["last_activity_at"] >= after


def test_stats_use_a_flat_number_of_queries_however_many_projects(client):
    def count_queries():
        seen = []
        def hook(conn, cursor, statement, *a):
            seen.append(statement)
        event.listen(Engine, "before_cursor_execute", hook)
        try:
            _projects(client)
        finally:
            event.remove(Engine, "before_cursor_execute", hook)
        return len(seen)

    first = _item(client, title="P0")
    _task(client, first, "t")
    few = count_queries()
    for n in range(1, 8):
        p = _item(client, title=f"P{n}")
        _task(client, p, "t", due_date="2026-10-01")
        _meeting(client, p, body="x\n")
    assert count_queries() <= few + 1  # item lookups for area titles may differ by one; never per project
