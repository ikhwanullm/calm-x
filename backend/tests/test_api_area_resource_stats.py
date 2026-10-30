"""GET /api/items?type=area|resource&today=... adds stats for the Areas and Resources lists."""
from backend.tests.test_api_meetings import HEADERS, _item, _meeting, client  # noqa: F401

TODAY = "2026-10-29"


def _list(client, kind, **params):
    r = client.get("/api/items", params={"type": kind, "today": TODAY, **params})
    assert r.status_code == 200, r.json()
    return r.json()


def _stats(client, kind, item_id):
    return next(i for i in _list(client, kind) if i["id"] == item_id)["stats"]


def _task(client, item_id, title, **fields):
    r = client.post("/api/tasks", json={"title": title, "item_id": item_id}, headers=HEADERS)
    assert r.status_code == 201, r.json()
    if fields:
        assert client.put(f"/api/tasks/{r.json()['id']}", json=fields, headers=HEADERS).status_code == 200
    return r.json()


def _new_project(client, area_id, title="P"):
    r = client.post("/api/items", json={"type": "project", "title": title, "area_id": area_id}, headers=HEADERS)
    assert r.status_code == 201, r.json()
    return r.json()["id"]


def test_stats_only_come_with_today(client):
    _item(client, kind="area")
    _item(client, kind="resource")
    assert client.get("/api/items", params={"type": "area"}).json()[0]["stats"] is None
    assert client.get("/api/items", params={"type": "resource"}).json()[0]["stats"] is None


def test_an_area_counts_its_own_tasks_and_its_active_projects(client):
    area = _item(client, kind="area")
    _task(client, area, "late", due_date="2026-10-20")
    _task(client, area, "waiting", waiting_for="Budi")
    p1 = _new_project(client, area, "P1")
    _new_project(client, area, "P2")
    _task(client, _new_project(client, area, "P3"), "not the area's own task", due_date="2026-10-01")
    client.post(f"/api/items/{p1}/archive", headers=HEADERS)
    s = _stats(client, "area", area)
    assert (s["open_task_count"], s["overdue_task_count"], s["waiting_task_count"], s["project_count"]) == (2, 1, 1, 2)
    assert s["next_task"]["title"] == "late"


def test_an_area_has_meetings_and_resources_like_a_project(client):
    area = _item(client, kind="area")
    _meeting(client, area, held_at="2020-01-01T00:00:00Z", body="x\n")
    res = _item(client, kind="resource", title="Doc")
    assert client.post(f"/api/resources/{res}/link", json={"linked_item_id": area}, headers=HEADERS).status_code == 201
    s = _stats(client, "area", area)
    assert s["last_meeting_at"].startswith("2020-01-01") and s["linked_resource_count"] == 1


def test_an_areas_last_activity_counts_its_projects(client):
    area = _item(client, kind="area")
    before = _stats(client, "area", area)["last_activity_at"]
    _new_project(client, area)
    assert _stats(client, "area", area)["last_activity_at"] >= before


def test_a_resource_counts_reference_links_and_active_linked_items(client):
    res = _item(client, kind="resource", title="Doc")
    for url in ("https://a.example", "https://b.example"):
        assert client.post(f"/api/items/{res}/links", json={"url": url}, headers=HEADERS).status_code == 201
    live, gone = _item(client, title="Live"), _item(client, kind="area", title="Gone")
    for target in (live, gone):
        assert client.post(f"/api/resources/{res}/link", json={"linked_item_id": target}, headers=HEADERS).status_code == 201
    client.post(f"/api/items/{gone}/archive", headers=HEADERS)
    assert _stats(client, "resource", res) == {"reference_link_count": 2, "linked_item_count": 1}


def test_an_unlinked_resource_has_zeroes(client):
    res = _item(client, kind="resource")
    assert _stats(client, "resource", res) == {"reference_link_count": 0, "linked_item_count": 0}


def test_query_count_stays_flat_for_areas_and_resources(client):
    from sqlalchemy import event
    from sqlalchemy.engine import Engine

    def count(kind):
        seen = []
        def hook(conn, cursor, statement, *a):
            seen.append(statement)
        event.listen(Engine, "before_cursor_execute", hook)
        try:
            _list(client, kind)
        finally:
            event.remove(Engine, "before_cursor_execute", hook)
        return len(seen)

    _item(client, kind="area", title="A0")
    _item(client, kind="resource", title="R0")
    few = (count("area"), count("resource"))
    for n in range(1, 7):
        a = _item(client, kind="area", title=f"A{n}")
        _task(client, a, "t")
        r = _item(client, kind="resource", title=f"R{n}")
        client.post(f"/api/items/{r}/links", json={"url": f"https://{n}.example"}, headers=HEADERS)
    assert count("area") <= few[0] + 1 and count("resource") <= few[1] + 1
