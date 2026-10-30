"""Dashboard: what needs attention (things to process, long waits, projects at risk) plus counts."""
from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from backend.api.deps import get_db_session
from backend.config import Config
from backend.database import Base
from backend.main import create_app
from backend.models.item import Item, Meeting, Task
from backend.models.utils import now_utc
from backend.models.weekly_review import WeeklyReview
from backend.services.dashboard_service import get_dashboard_data

HEADERS = {"X-Calm-X": "1"}
TODAY = date(2026, 10, 29)
TODAY_STR = TODAY.isoformat()


@pytest.fixture
def engine(tmp_path):
    e = create_engine(f"sqlite:///{tmp_path / 'd.db'}")
    Base.metadata.create_all(e)
    return e


@pytest.fixture
def client(tmp_path):
    app = create_app(Config(port=8080))
    e = create_engine(f"sqlite:///{tmp_path / 'api.db'}")
    Base.metadata.create_all(e)
    f = sessionmaker(bind=e)

    def override():
        s = f()
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


def _item(s, kind="project", title="P", deadline=None, status="active", archived=False, updated=None):
    now = now_utc()
    item = Item(
        type=kind, title=title, description="", notes="",
        project_status=status if kind == "project" else None,
        project_deadline=date.fromisoformat(deadline) if deadline else None,
        archived_at=now if archived else None,
        created_at=updated or now, updated_at=updated or now,
    )
    s.add(item)
    s.flush()
    return item


def _task(s, title, item_id=None, due=None, done=0, waiting_for=None, waiting_days=None, someday=0, updated=None):
    now = now_utc()
    t = Task(
        item_id=item_id, title=title, description="", notes="", priority="medium", is_complete=done,
        is_someday=someday, sort_order=0, due_date=date.fromisoformat(due) if due else None,
        waiting_for=waiting_for,
        waiting_since=(datetime.combine(TODAY, datetime.min.time(), tzinfo=timezone.utc) - timedelta(days=waiting_days))
        if waiting_days is not None else None,
        created_at=updated or now, updated_at=updated or now,
    )
    s.add(t)
    s.flush()
    return t


def _dash(engine, **kwargs):
    with Session(engine) as s:
        return get_dashboard_data(s, TODAY, **kwargs)


def _recent():
    return now_utc() - timedelta(days=1)


# ---------- API ----------

def test_dashboard_ok_and_has_the_new_sections(client):
    r = client.get(f"/api/dashboard?today={TODAY_STR}", headers=HEADERS)
    assert r.status_code == 200
    b = r.json()
    assert set(b) == {
        "inbox_count", "last_review_date", "days_since_review", "meetings_to_process", "stale_waiting",
        "stale_waiting_total", "attention_projects", "counts",
    }
    assert b["counts"] == {"active_projects": 0, "areas": 0, "resources": 0, "archived": 0, "someday": 0}


def test_dashboard_bad_date(client):
    assert client.get("/api/dashboard?today=bad", headers=HEADERS).status_code == 400
    r = client.get("/api/dashboard?today=bad", headers=HEADERS)
    assert "error" in r.json() and "type" in r.json()


def test_dashboard_missing_today(client):
    assert client.get("/api/dashboard", headers=HEADERS).status_code in (400, 422)


# ---------- Inbox, review, counts ----------

def test_inbox_count_only_open_tasks_without_an_item_and_not_someday(engine):
    with Session(engine) as s:
        _task(s, "open")
        _task(s, "done", done=1)
        _task(s, "parked", someday=1)
        p = _item(s)
        _task(s, "in project", item_id=p.id)
        s.commit()
    assert _dash(engine).inbox_count == 1


def test_days_since_review_and_none_before_the_first_review(engine):
    assert _dash(engine).days_since_review is None and _dash(engine).last_review_date is None
    with Session(engine) as s:
        s.add(WeeklyReview(completed_at=datetime(2026, 10, 22, 10, tzinfo=timezone.utc), notes=""))
        s.commit()
    d = _dash(engine)
    assert d.last_review_date == "2026-10-22" and d.days_since_review == 7


def test_counts_leave_out_archived_and_completed_and_count_someday(engine):
    with Session(engine) as s:
        _item(s, title="active")
        _item(s, title="done", status="completed")
        _item(s, title="old", archived=True)
        _item(s, kind="area")
        _item(s, kind="resource")
        _item(s, kind="resource", archived=True)
        p = _item(s, title="host")
        _task(s, "parked", item_id=p.id, someday=1)
        _task(s, "parked in inbox", someday=1)
        _task(s, "parked and done", someday=1, done=1)
        _item(s, title="gone", archived=True)
        s.flush()
        s.commit()
    c = _dash(engine).counts
    assert (c.active_projects, c.areas, c.resources, c.archived, c.someday) == (2, 1, 1, 3, 2)


# ---------- Meetings to process ----------

def test_meetings_to_process_are_this_weeks_with_actions_left(engine):
    with Session(engine) as s:
        p = _item(s, title="Migrate")
        for title, days_ago, body in (("Recent", 2, "- [ ] a\n@Budi: b\n"), ("Notes only", 1, "just notes\n"), ("Old", 9, "- [ ] c\n")):
            held = datetime.combine(TODAY, datetime.min.time(), tzinfo=timezone.utc) - timedelta(days=days_ago) + timedelta(hours=3)
            s.add(Meeting(item_id=p.id, title=title, held_at=held, attendees="", body=body, created_at=held, updated_at=held))
        s.commit()
    got = _dash(engine).meetings_to_process
    assert [(m.title, m.open_action_count, m.item_title, m.item_type) for m in got] == [("Recent", 2, "Migrate", "project")]


# ---------- Stale waiting ----------

def test_waiting_tasks_are_listed_from_seven_days_longest_first(engine):
    with Session(engine) as s:
        p = _item(s, kind="area", title="Work")
        _task(s, "six days", item_id=p.id, waiting_for="A", waiting_days=6)
        _task(s, "seven days", item_id=p.id, waiting_for="B", waiting_days=7)
        _task(s, "twenty days", waiting_for="C", waiting_days=20)
        s.commit()
    d = _dash(engine)
    assert [(w.title, w.waiting_for, w.waiting_days) for w in d.stale_waiting] == [("twenty days", "C", 20), ("seven days", "B", 7)]
    assert d.stale_waiting_total == 2
    inbox, area = d.stale_waiting
    assert inbox.item_id is None and inbox.item_type is None
    assert area.item_title == "Work" and area.item_type == "area"


def test_waiting_list_skips_done_someday_archived_completed_project_and_unknown_start(engine):
    with Session(engine) as s:
        _task(s, "done", waiting_for="A", waiting_days=30, done=1)
        _task(s, "parked", waiting_for="A", waiting_days=30, someday=1)
        _task(s, "no start date", waiting_for="A")
        archived = _item(s, title="archived", archived=True)
        _task(s, "in archived", item_id=archived.id, waiting_for="A", waiting_days=30)
        finished = _item(s, title="finished", status="completed")
        _task(s, "in finished", item_id=finished.id, waiting_for="A", waiting_days=30)
        s.commit()
    assert _dash(engine).stale_waiting == []


def test_waiting_list_is_capped_but_reports_the_total(engine):
    with Session(engine) as s:
        for n in range(14):
            _task(s, f"w{n}", waiting_for="A", waiting_days=8 + n)
        s.commit()
    d = _dash(engine)
    assert len(d.stale_waiting) == 10 and d.stale_waiting_total == 14
    assert d.stale_waiting[0].waiting_days == 21


def test_waiting_days_follow_the_client_timezone(engine):
    with Session(engine) as s:
        # 18:00 UTC on 22 Oct is already 23 Oct in +07:00: 6 days before 29 Oct there, 7 days in UTC
        _task(s, "edge", waiting_for="A")
        t = s.query(Task).one()
        t.waiting_since = datetime(2026, 10, 22, 18, 0, tzinfo=timezone.utc)
        s.commit()
    assert _dash(engine).stale_waiting[0].waiting_days == 7
    assert _dash(engine, local_tz=timezone(timedelta(hours=7))).stale_waiting == []


# ---------- Projects needing attention ----------

def _reasons(engine):
    return {p.title: p.reasons for p in _dash(engine).attention_projects}


def test_a_healthy_project_is_not_listed(engine):
    with Session(engine) as s:
        p = _item(s, title="fine", deadline="2027-03-01", updated=_recent())
        _task(s, "next", item_id=p.id, due="2026-11-20", updated=_recent())
        s.commit()
    assert _dash(engine).attention_projects == []


def test_overdue_tasks_deadline_passed_and_no_open_tasks(engine):
    with Session(engine) as s:
        late = _item(s, title="late", deadline="2026-10-01", updated=_recent())
        _task(s, "overdue", item_id=late.id, due="2026-10-20", updated=_recent())
        _item(s, title="empty", updated=_recent())
        s.commit()
    got = _reasons(engine)
    assert got["late"] == ["overdue_tasks", "deadline_passed"]
    assert got["empty"] == ["no_open_tasks"]


def test_deadline_soon_only_when_progress_is_low(engine):
    with Session(engine) as s:
        behind = _item(s, title="behind", deadline="2026-11-05", updated=_recent())
        _task(s, "t1", item_id=behind.id, updated=_recent())
        _task(s, "t2", item_id=behind.id, updated=_recent())
        ahead = _item(s, title="ahead", deadline="2026-11-05", updated=_recent())
        _task(s, "d1", item_id=ahead.id, done=1, updated=_recent())
        _task(s, "d2", item_id=ahead.id, done=1, updated=_recent())
        _task(s, "open", item_id=ahead.id, updated=_recent())
        far = _item(s, title="far", deadline="2026-12-31", updated=_recent())
        _task(s, "f1", item_id=far.id, updated=_recent())
        s.commit()
    got = _reasons(engine)
    assert got == {"behind": ["deadline_soon"]}


def test_stale_means_no_activity_for_thirty_days_including_tasks_and_meetings(engine):
    old = datetime(2026, 9, 1, tzinfo=timezone.utc)
    with Session(engine) as s:
        quiet = _item(s, title="quiet", updated=old)
        _task(s, "t", item_id=quiet.id, updated=old)
        touched = _item(s, title="touched", updated=old)
        _task(s, "recent task", item_id=touched.id, updated=_recent())
        s.commit()
    assert _reasons(engine) == {"quiet": ["stale"]}
    assert [p.days_inactive for p in _dash(engine).attention_projects] == [58]


def test_archived_and_completed_projects_are_ignored(engine):
    with Session(engine) as s:
        _item(s, title="archived", archived=True)
        _item(s, title="completed", status="completed")
        s.commit()
    assert _dash(engine).attention_projects == []


def test_most_problems_first_then_overdue_then_title(engine):
    with Session(engine) as s:
        two = _item(s, title="zzz two problems", deadline="2026-10-01", updated=_recent())
        _task(s, "late", item_id=two.id, due="2026-10-02", updated=_recent())
        _item(s, title="bbb empty", updated=_recent())
        _item(s, title="aaa empty", updated=_recent())
        s.commit()
    assert [p.title for p in _dash(engine).attention_projects] == ["zzz two problems", "aaa empty", "bbb empty"]


def test_an_attention_project_carries_numbers_for_the_row(engine):
    with Session(engine) as s:
        p = _item(s, title="row", deadline="2026-10-01", updated=_recent())
        _task(s, "late", item_id=p.id, due="2026-10-05", updated=_recent())
        _task(s, "done", item_id=p.id, done=1, updated=_recent())
        s.commit()
    row = _dash(engine).attention_projects[0]
    assert (row.overdue_task_count, row.open_task_count, row.progress_percentage, row.project_deadline) == (1, 1, 50, "2026-10-01")
