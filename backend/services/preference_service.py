"""User preference service — read-only access to user_preferences table."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.models.preference import UserPreference

DEFAULT_THRESHOLD = 3  # fallback if DB row is missing


def get_preferences(session: Session) -> dict[str, str]:
    """Return all preferences as a {key: value} dict."""
    rows = session.execute(select(UserPreference)).scalars().all()
    return {row.key: row.value for row in rows}


def get_threshold(session: Session) -> int:
    """Return approaching_deadline_threshold as an integer (default 3)."""
    pref = session.get(UserPreference, "approaching_deadline_threshold")
    if pref is None:
        return DEFAULT_THRESHOLD
    try:
        return int(pref.value)
    except (ValueError, TypeError):
        return DEFAULT_THRESHOLD
