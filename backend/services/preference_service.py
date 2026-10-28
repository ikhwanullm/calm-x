"""User preference service — read and update user_preferences table."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.exceptions import ValidationError
from backend.models.preference import UserPreference

DEFAULT_THRESHOLD = 3  # fallback if DB row is missing

VALID_THEMES: frozenset[str] = frozenset({"system", "light", "dark"})


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


def update_preferences(session: Session, updates: dict[str, str]) -> dict[str, str]:
    """Validate and persist preference updates.

    Validated keys:
    - approaching_deadline_threshold: integer 1–30
    - theme: "system" | "light" | "dark"

    Unknown keys are accepted as opaque string values (for forward compatibility).
    """
    now = datetime.now(timezone.utc)

    for key, value in updates.items():
        if key == "approaching_deadline_threshold":
            try:
                val = int(value)
            except (ValueError, TypeError):
                raise ValidationError(
                    f"approaching_deadline_threshold must be an integer, got {value!r}"
                )
            if not (1 <= val <= 30):
                raise ValidationError(
                    "approaching_deadline_threshold must be between 1 and 30"
                )
        elif key == "theme":
            if value not in VALID_THEMES:
                raise ValidationError(
                    f"theme must be one of {sorted(VALID_THEMES)}, got {value!r}"
                )

        # Upsert the preference row
        pref = session.get(UserPreference, key)
        if pref is not None:
            pref.value = value
            pref.updated_at = now
        else:
            session.add(UserPreference(key=key, value=value, updated_at=now))

    session.flush()
    return get_preferences(session)
