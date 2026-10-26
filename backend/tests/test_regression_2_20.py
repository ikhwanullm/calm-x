"""Regression 2.20: Deleting a Project deletes its tasks; Inbox count unchanged.

Requirements: R1.4
"""
import pytest
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models.item import Item, Task
from backend.models.utils import now_utc
from backend.services import item_service


@pytest.fixture(scope="module")
def engine(tmp_path_factory):
    db = tmp_path_factory.mktemp("r220") / "r220.db"
    engine = create_engine(f"sqlite:///{db}")
    Base.metadata.create_all(engine)
    return engine


@pytest.fixture
def session(engine):
    factory = sessionmaker(bind=engine)
    s = factory()
    # SQLite requires FK enforcement per connection for ON DELETE CASCADE
    s.execute(text("PRAGMA foreign_keys=ON"))
    yield s
    s.rollback()
    s.close()


def _inbox_count(session) -> int:
    return session.execute(
        select(Task).where(Task.item_id.is_(None))
    ).scalars().all().__len__()


def test_delete_project_cascades_to_tasks(session):
    """Deleting a Project must cascade-delete all of its tasks."""
    project = Item(
        type="project", title="My Project",
        description="", notes="",
        created_at=now_utc(), updated_at=now_utc(),
        project_status="active",
    )
    session.add(project)
    session.flush()

    # Add tasks to the project
    for i in range(3):
        session.add(Task(
            item_id=project.id, title=f"Task {i}",
            description="", notes="",
            priority="medium", is_complete=0, sort_order=i,
            created_at=now_utc(), updated_at=now_utc(),
        ))
    session.flush()

    # Create an Inbox task (item_id=None)
    session.add(Task(
        item_id=None, title="Inbox task",
        description="", notes="",
        priority="medium", is_complete=0, sort_order=0,
        created_at=now_utc(), updated_at=now_utc(),
    ))
    session.flush()
    inbox_before = _inbox_count(session)

    # Delete the project
    item_service.delete_item(session, project.id)
    session.flush()

    # Project tasks must be gone
    project_tasks = session.execute(
        select(Task).where(Task.item_id == project.id)
    ).scalars().all()
    assert len(project_tasks) == 0, "Project tasks were not deleted"

    # Inbox task count must be unchanged
    inbox_after = _inbox_count(session)
    assert inbox_after == inbox_before, (
        f"Inbox changed: before={inbox_before}, after={inbox_after}. "
        "Tasks must NOT be moved to Inbox when a project is deleted."
    )


def test_delete_project_does_not_affect_other_projects_tasks(session):
    """Deleting project A must not delete tasks belonging to project B."""
    project_a = Item(
        type="project", title="Project A",
        description="", notes="",
        created_at=now_utc(), updated_at=now_utc(),
        project_status="active",
    )
    project_b = Item(
        type="project", title="Project B",
        description="", notes="",
        created_at=now_utc(), updated_at=now_utc(),
        project_status="active",
    )
    session.add_all([project_a, project_b])
    session.flush()

    task_b = Task(
        item_id=project_b.id, title="B's task",
        description="", notes="",
        priority="medium", is_complete=0, sort_order=0,
        created_at=now_utc(), updated_at=now_utc(),
    )
    session.add(task_b)
    session.flush()

    item_service.delete_item(session, project_a.id)
    session.flush()

    # Project B's task must still exist
    assert session.get(Task, task_b.id) is not None
