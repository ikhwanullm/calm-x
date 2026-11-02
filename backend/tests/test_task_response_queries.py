"""Task lists are built in a fixed number of SQL statements, however many tasks there are."""
from datetime import date

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models.item import Item, Meeting, Subtask, Tag, Task, TaskTag
from backend.models.utils import now_utc
from backend.services import task_service


@pytest.fixture
def db_session(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


def _fill(session, count: int) -> None:
    """`count` open tasks on one item, each with two subtasks, a tag and a meeting; all due today."""
    now = now_utc()
    item = Item(
        type="project", title="P", description="", notes="", project_status="active",
        created_at=now, updated_at=now,
    )
    session.add(item)
    session.flush()
    meeting = Meeting(item_id=item.id, title="M", held_at=now, created_at=now, updated_at=now)
    tag = Tag(name=f"t{count}", created_at=now)
    session.add_all([meeting, tag])
    session.flush()
    for n in range(count):
        task = Task(
            item_id=item.id, title=f"T{n}", description="", notes="", priority="medium",
            is_complete=0, sort_order=n, created_at=now, updated_at=now,
            meeting_id=meeting.id, due_date=date(2026, 1, 1),
        )
        session.add(task)
        session.flush()
        session.add_all([
            Subtask(task_id=task.id, title="a", is_complete=1, sort_order=0, created_at=now, updated_at=now),
            Subtask(task_id=task.id, title="b", is_complete=0, sort_order=1, created_at=now, updated_at=now),
            TaskTag(task_id=task.id, tag_id=tag.id),
        ])
    session.commit()
    session.expire_all()


def _count_statements(session, call) -> int:
    statements: list[str] = []

    def record(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    engine = session.get_bind()
    event.listen(engine, "before_cursor_execute", record)
    try:
        call()
    finally:
        event.remove(engine, "before_cursor_execute", record)
    return len(statements)


def test_list_tasks_statements_do_not_grow_with_task_count(db_session):
    _fill(db_session, 3)
    small_item = db_session.query(Item).order_by(Item.id).first().id
    small = _count_statements(db_session, lambda: task_service.list_tasks(db_session, small_item))

    _fill(db_session, 20)  # a second item with 20 tasks
    big_item = db_session.query(Item).order_by(Item.id.desc()).first().id
    big = _count_statements(db_session, lambda: task_service.list_tasks(db_session, big_item))

    assert big == small
    assert big <= 6


def test_get_today_statements_do_not_grow_with_task_count(db_session):
    today = date(2026, 1, 1)
    _fill(db_session, 3)
    small = _count_statements(db_session, lambda: task_service.get_today(db_session, today))

    _fill(db_session, 20)
    db_session.expire_all()
    big = _count_statements(db_session, lambda: task_service.get_today(db_session, today))

    assert big == small
    assert big <= 6


def test_batch_response_has_counts_tags_meeting_and_item(db_session):
    _fill(db_session, 2)
    result = task_service.list_tasks(db_session, db_session.query(Item).first().id)

    assert [t.title for t in result] == ["T0", "T1"]
    for t in result:
        assert (t.subtask_count, t.completed_subtask_count) == (2, 1)
        assert t.tags == ["t2"]
        assert t.meeting_title == "M"
        assert (t.item_title, t.item_type) == ("P", "project")


def test_no_tasks_means_no_extra_statements(db_session):
    assert _count_statements(db_session, lambda: task_service._tasks_to_responses(db_session, [])) == 0
