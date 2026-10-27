"""Tests for UserPreferenceService."""
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.services.preference_service import get_preferences, get_threshold


@pytest.fixture
def db_session(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'prefs.db'}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    s = factory()
    # Insert a preference
    s.execute(text("INSERT INTO user_preferences (key, value, updated_at) VALUES ('approaching_deadline_threshold', '5', '2024-01-01')"))
    s.commit()
    yield s
    s.close()


def test_get_threshold(db_session):
    assert get_threshold(db_session) == 5


def test_get_preferences_dict(db_session):
    prefs = get_preferences(db_session)
    assert "approaching_deadline_threshold" in prefs
    assert prefs["approaching_deadline_threshold"] == "5"


def test_get_threshold_default_when_missing(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'empty.db'}")
    Base.metadata.create_all(engine)
    from sqlalchemy.orm import Session
    with Session(engine) as s:
        # No preference row inserted
        assert get_threshold(s) == 3  # DEFAULT_THRESHOLD
