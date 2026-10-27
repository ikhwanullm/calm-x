"""Property test P13: Dashboard Progress Excludes Ineligible Projects."""
import pytest
from datetime import date
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from hypothesis import given, settings
from hypothesis import strategies as st

from backend.database import Base
from backend.models.item import Item, Task
from backend.models.utils import now_utc
from backend.services.dashboard_service import get_dashboard_data


@pytest.fixture
def engine(tmp_path):
    e = create_engine(f"sqlite:///{tmp_path / 'p13.db'}")
    Base.metadata.create_all(e)
    return e


def _add_project(session, title, status="active", archived=False, task_count=1, completed=0):
    now = now_utc()
    item = Item(
        type="project", title=title, description="", notes="",
        project_status=status, archived_at=now if archived else None,
        created_at=now, updated_at=now,
    )
    session.add(item)
    session.flush()
    for i in range(task_count):
        t = Task(
            item_id=item.id, title=f"T{i}", description="", notes="",
            priority="medium", is_complete=1 if i < completed else 0,
            sort_order=i, created_at=now, updated_at=now,
        )
        session.add(t)
    session.flush()
    return item


def test_p13_archived_project_excluded_from_overall_progress(engine):
    """Archived project must not affect overall_progress."""
    today = date.today()
    with Session(engine) as s:
        _add_project(s, "Active", task_count=2, completed=1)   # 50 %
        _add_project(s, "Archived", archived=True, task_count=2, completed=2)  # would be 100 %
        s.commit()

    with Session(engine) as s:
        data = get_dashboard_data(s, today)
    # Only active project (50%) is included
    assert data.overall_progress == 50.0


def test_p13_completed_project_excluded_from_overall_progress(engine):
    """Completed project must not be in overall_progress."""
    today = date.today()
    with Session(engine) as s:
        _add_project(s, "Active", task_count=4, completed=1)    # 25 %
        _add_project(s, "Done", status="completed", task_count=4, completed=4)  # would be 100 %
        s.commit()

    with Session(engine) as s:
        data = get_dashboard_data(s, today)
    assert data.overall_progress == 25.0


def test_p13_zero_task_project_excluded_from_overall_progress(engine):
    """Project with no tasks must not be in overall_progress denominator."""
    today = date.today()
    with Session(engine) as s:
        _add_project(s, "WithTasks", task_count=2, completed=2)  # 100 %
        _add_project(s, "NoTasks", task_count=0)                  # excluded
        s.commit()

    with Session(engine) as s:
        data = get_dashboard_data(s, today)
    # Only WithTasks counts -> 100 %
    assert data.overall_progress == 100.0


def test_p13_no_eligible_projects_returns_none(engine):
    """overall_progress is None when all projects are ineligible."""
    today = date.today()
    with Session(engine) as s:
        _add_project(s, "Archived", archived=True, task_count=1)
        _add_project(s, "Completed", status="completed", task_count=1)
        _add_project(s, "NoTasks", task_count=0)
        s.commit()

    with Session(engine) as s:
        data = get_dashboard_data(s, today)
    assert data.overall_progress is None


@given(
    n_active=st.integers(min_value=1, max_value=5),
    tasks_each=st.integers(min_value=1, max_value=10),
    completed_each=st.integers(min_value=0, max_value=10),
)
@settings(max_examples=30, deadline=None)
def test_p13_overall_progress_always_0_to_100(n_active, tasks_each, completed_each):
    """P13: overall_progress is always between 0 and 100 for any valid input."""
    e = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(e)
    today = date.today()
    completed = min(completed_each, tasks_each)
    with Session(e) as s:
        for i in range(n_active):
            _add_project(s, f"P{i}", task_count=tasks_each, completed=completed)
        s.commit()
    with Session(e) as s:
        data = get_dashboard_data(s, today)
    if data.overall_progress is not None:
        assert 0.0 <= data.overall_progress <= 100.0
