"""Week view: GET /api/calendar/week."""
from backend.tests.test_api_meetings import HEADERS, _item, _meeting, client  # noqa: F401

MON = "2026-10-26"  # Monday; 2026-10-29 is a Thursday
TODAY = "2026-10-29"


def _week(client, start=MON, today=TODAY, **params):
    r = client.get("/api/calendar/week", params={"start": start, "today": today, **params})
    assert r.status_code == 200, r.json()
    return r.json()


def _day(week, date):
    return next(d for d in week["days"] if d["date"] == date)


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


def test_returns_seven_days_starting_on_the_given_monday(client):
    week = _week(client)
    assert [d["date"] for d in week["days"]] == [f"2026-10-{n}" for n in range(26, 32)] + ["2026-11-01"]
    assert all(d["meetings"] == d["due"] == d["planned"] == d["deadlines"] == d["starts"] == [] for d in week["days"])


def test_start_must_be_a_monday_and_dates_valid(client):
    for params in ({"start": "2026-10-27", "today": TODAY}, {"start": "nope", "today": TODAY}, {"start": MON, "today": "x"}):
        assert client.get("/api/calendar/week", params=params).status_code == 400
    assert client.get("/api/calendar/week", params={"start": MON}).status_code == 400


def test_open_tasks_land_on_their_due_date_sorted_by_priority(client):
    _task(client, "low", due_date="2026-10-28", priority="low")
    _task(client, "high", due_date="2026-10-28", priority="high")
    _task(client, "next week", due_date="2026-11-02")
    assert [t["title"] for t in _day(_week(client), "2026-10-28")["due"]] == ["high", "low"]
    assert _day(_week(client, start="2026-11-02"), "2026-11-02")["due"][0]["title"] == "next week"


def test_completed_someday_and_archived_items_are_left_out(client):
    done = _task(client, "done", due_date="2026-10-28")
    client.post(f"/api/tasks/{done['id']}/complete", headers=HEADERS)
    _task(client, "parked", due_date="2026-10-28", is_someday=True)
    item = _item(client)
    _task(client, "in archived", item_id=item, due_date="2026-10-28")
    _task(client, "kept", due_date="2026-10-28")
    assert client.post(f"/api/items/{item}/archive", headers=HEADERS).status_code == 200
    assert [t["title"] for t in _day(_week(client), "2026-10-28")["due"]] == ["kept"]


def test_waiting_tasks_with_a_due_date_show_with_who(client):
    _task(client, "reply", due_date="2026-10-30", waiting_for="Budi")
    due = _day(_week(client), "2026-10-30")["due"]
    assert due[0]["waiting_for"] == "Budi"


def test_planned_tasks_show_in_todays_column_only_and_only_for_the_current_week(client):
    _task(client, "plan", focus_date=TODAY)
    _task(client, "plan and due", focus_date=TODAY, due_date="2026-10-31")
    week = _week(client)
    assert [t["title"] for t in _day(week, TODAY)["planned"]] == ["plan"]   # also-due task is only in due
    assert [t["title"] for t in _day(week, "2026-10-31")["due"]] == ["plan and due"]
    assert all(d["planned"] == [] for d in week["days"] if d["date"] != TODAY)
    assert all(d["planned"] == [] for d in _week(client, start="2026-11-02")["days"])


def test_a_planned_task_deferred_past_today_is_hidden_like_on_today(client):
    _task(client, "later", focus_date=TODAY, defer_until="2026-10-31")
    assert _day(_week(client), TODAY)["planned"] == []


def test_starts_lists_tasks_by_defer_until(client):
    _task(client, "begins", defer_until="2026-10-27")
    assert [t["title"] for t in _day(_week(client), "2026-10-27")["starts"]] == ["begins"]


def test_project_deadlines_only_for_active_unarchived_projects(client):
    r = client.post("/api/items", json={"type": "project", "title": "Ship", "project_deadline": "2026-10-30"}, headers=HEADERS)
    assert r.status_code == 201, r.json()
    pid = r.json()["id"]
    client.post("/api/items", json={"type": "project", "title": "Archived", "project_deadline": "2026-10-30"}, headers=HEADERS)
    client.post("/api/items", json={"type": "area", "title": "Area"}, headers=HEADERS)
    archived = client.get("/api/items?type=project").json()
    archived_id = next(i["id"] for i in archived if i["title"] == "Archived")
    client.post(f"/api/items/{archived_id}/archive", headers=HEADERS)
    assert _day(_week(client), "2026-10-30")["deadlines"] == [{"id": pid, "title": "Ship"}]


def test_meetings_are_bucketed_by_the_clients_local_date(client):
    item = _item(client)
    # 23:30 UTC on Wed 28 Oct is already Thu 29 Oct 06:30 in +07:00
    _meeting(client, item, title="Early", held_at="2026-10-28T23:30:00Z", body="x\n")
    _meeting(client, item, title="Same day", held_at="2026-10-28T03:00:00Z", body="x\n")
    utc = _week(client)
    assert [m["title"] for m in _day(utc, "2026-10-28")["meetings"]] == ["Same day", "Early"]
    wib = _week(client, tz_offset="+07:00")
    assert [m["title"] for m in _day(wib, "2026-10-28")["meetings"]] == ["Same day"]
    assert [m["title"] for m in _day(wib, "2026-10-29")["meetings"]] == ["Early"]


def test_meetings_outside_the_week_or_of_archived_items_are_left_out(client):
    item = _item(client)
    _meeting(client, item, title="Last week", held_at="2026-10-25T10:00:00Z", body="x\n")
    _meeting(client, item, title="Next week", held_at="2026-11-02T10:00:00Z", body="x\n")
    gone = _item(client, title="Gone")
    _meeting(client, gone, title="Archived item", held_at="2026-10-28T03:00:00Z", body="x\n")
    client.post(f"/api/items/{gone}/archive", headers=HEADERS)
    assert all(d["meetings"] == [] for d in _week(client)["days"])
