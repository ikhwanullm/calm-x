"""Tests for TagService."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.exceptions import ConflictError, NotFoundError
from backend.schemas.tag import TagCreate, TagRename
from backend.services.tag_service import create_tag, delete_tag, list_tags, rename_tag


@pytest.fixture
def db_session(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'tags.db'}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    s = factory()
    yield s
    s.close()


def test_create_tag(db_session):
    tag = create_tag(db_session, TagCreate(name="design"))
    assert tag.name == "design"
    assert tag.id > 0


def test_create_duplicate_raises_conflict(db_session):
    create_tag(db_session, TagCreate(name="work"))
    with pytest.raises(ConflictError) as exc:
        create_tag(db_session, TagCreate(name="WORK"))  # case-insensitive
    assert "already exists" in exc.value.message.lower() or "work" in exc.value.message.lower()


def test_create_tag_duplicate_error_message_is_clear(db_session):
    create_tag(db_session, TagCreate(name="Python"))
    try:
        create_tag(db_session, TagCreate(name="python"))
    except ConflictError as e:
        assert "python" in e.message.lower() or "Python" in e.message


def test_list_tags(db_session):
    create_tag(db_session, TagCreate(name="beta"))
    create_tag(db_session, TagCreate(name="alpha"))
    tags = list_tags(db_session)
    names = [t.name for t in tags]
    assert "alpha" in names and "beta" in names


def test_rename_tag(db_session):
    tag = create_tag(db_session, TagCreate(name="old"))
    renamed = rename_tag(db_session, tag.id, TagRename(name="new"))
    assert renamed.name == "new"


def test_rename_tag_conflict_raises(db_session):
    t1 = create_tag(db_session, TagCreate(name="A"))
    create_tag(db_session, TagCreate(name="B"))
    with pytest.raises(ConflictError):
        rename_tag(db_session, t1.id, TagRename(name="b"))  # case-insensitive


def test_rename_same_name_ok(db_session):
    """Renaming to the same name (or same case) should not raise."""
    t = create_tag(db_session, TagCreate(name="Foo"))
    result = rename_tag(db_session, t.id, TagRename(name="Foo"))
    assert result.name == "Foo"


def test_delete_tag(db_session):
    tag = create_tag(db_session, TagCreate(name="temp"))
    delete_tag(db_session, tag.id)
    tags = list_tags(db_session)
    assert all(t.id != tag.id for t in tags)


def test_delete_nonexistent_raises(db_session):
    with pytest.raises(NotFoundError):
        delete_tag(db_session, 9999)
