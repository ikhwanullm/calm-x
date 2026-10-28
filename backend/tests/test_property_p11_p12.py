from __future__ import annotations
import pytest
from datetime import date, timedelta
from hypothesis import given, settings
from hypothesis import strategies as st
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.database import Base
from backend.models.item import Item, Tag, Task, TaskTag
from backend.models.utils import now_utc
from backend.services.filter_service import filter_tasks


def _engine():
    e = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(e)
    return e


def _item(s, t="project"):
    i = Item(type=t, title="P", description="", notes="",
             project_status="active" if t == "project" else None,
             created_at=now_utc(), updated_at=now_utc())
    s.add(i); s.flush(); return i


def _task(s, title="T", item_id=None, priority="medium", due=None):
    t = Task(item_id=item_id, title=title, description="", notes="",
             priority=priority, is_complete=0, sort_order=0,
             due_date=date.fromisoformat(due) if due else None,
             created_at=now_utc(), updated_at=now_utc())
    s.add(t); s.flush(); return t


def _tag(s, name):
    t = Tag(name=name, created_at=now_utc())
    s.add(t); s.flush(); return t


def _assign(s, task, tag):
    s.add(TaskTag(task_id=task.id, tag_id=tag.id)); s.flush()


# ---- P11: Tag filter uses OR within tags ----

@given(
    n_tag1=st.integers(min_value=0, max_value=3),
    n_tag2=st.integers(min_value=0, max_value=3),
    n_both=st.integers(min_value=0, max_value=3),
    n_neither=st.integers(min_value=0, max_value=3),
)
@settings(max_examples=30, deadline=None)
def test_p11_tag_filter_or_logic(n_tag1, n_tag2, n_both, n_neither):
    """P11: filtering by [T1, T2] returns tasks with T1 OR T2."""
    e = _engine()
    with Session(e) as s:
        tag1 = _tag(s, "t1"); tag2 = _tag(s, "t2")
        task1_ids = [_task(s, f"t1-{i}").id for i in range(n_tag1)]
        for tid in task1_ids:
            _assign(s, s.get(Task, tid), tag1)
        task2_ids = [_task(s, f"t2-{i}").id for i in range(n_tag2)]
        for tid in task2_ids:
            _assign(s, s.get(Task, tid), tag2)
        both_ids = [_task(s, f"b-{i}").id for i in range(n_both)]
        for tid in both_ids:
            _assign(s, s.get(Task, tid), tag1)
            _assign(s, s.get(Task, tid), tag2)
        [_task(s, f"n-{i}") for i in range(n_neither)]
        s.commit()
        results = filter_tasks(s, tags=[tag1.id, tag2.id])
        result_ids = {r.id for r in results}
        expected = set(task1_ids + task2_ids + both_ids)
        assert result_ids == expected


def test_p11_empty_tag_list_returns_all_unarchived():
    """P11: no tag filter means no tag restriction."""
    e = _engine()
    with Session(e) as s:
        t1 = _task(s, "A"); t2 = _task(s, "B"); s.commit()
        results = filter_tasks(s, tags=None)
        ids = {r.id for r in results}
        assert t1.id in ids and t2.id in ids


# ---- P12: Combined filters use AND logic ----

def test_p12_tag_and_priority_and_logic():
    """P12: tag AND priority filter uses AND across types."""
    e = _engine()
    with Session(e) as s:
        tag = _tag(s, "work")
        hi_tagged = _task(s, "Hi+Tagged", priority="high"); _assign(s, hi_tagged, tag)
        lo_tagged = _task(s, "Lo+Tagged", priority="low"); _assign(s, lo_tagged, tag)
        hi_untagged = _task(s, "Hi-Untagged", priority="high")
        s.commit()
        results = filter_tasks(s, tags=[tag.id], priorities=["high"])
        ids = {r.id for r in results}
        assert hi_tagged.id in ids
        assert lo_tagged.id not in ids
        assert hi_untagged.id not in ids


def test_p12_priority_and_due_date_and_logic():
    """P12: priority AND due_date uses AND logic."""
    today = str(date.today())
    e = _engine()
    with Session(e) as s:
        match = _task(s, "Match", priority="high", due=today)
        no_due = _task(s, "NoDue", priority="high")
        low_today = _task(s, "LowToday", priority="low", due=today)
        s.commit()
        results = filter_tasks(s, priorities=["high"], due_start=today, due_end=today)
        ids = {r.id for r in results}
        assert match.id in ids
        assert no_due.id not in ids
        assert low_today.id not in ids
