"""FastAPI router for Settings (user preferences)."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.api.deps import get_db_session
from backend.services.preference_service import (
    get_preferences,
    get_threshold,
    update_preferences,
)

router = APIRouter(prefix="/settings", tags=["settings"])
SessionDep = Annotated[Session, Depends(get_db_session)]


@router.get("")
def get_settings(session: SessionDep) -> dict:
    """Return all user preferences."""
    prefs = get_preferences(session)
    # Ensure threshold is always included
    prefs.setdefault("approaching_deadline_threshold", str(get_threshold(session)))
    return prefs


class SettingsUpdate(BaseModel):
    """Payload for PUT /api/settings.

    Only the provided fields are updated; all fields are optional.
    """

    approaching_deadline_threshold: str | None = Field(
        default=None,
        description="Integer 1–30 as string",
    )
    theme: str | None = Field(
        default=None,
        description="system | light | dark",
    )


@router.put("")
def update_settings(data: SettingsUpdate, session: SessionDep) -> dict:
    """Update one or more user preferences."""
    updates: dict[str, str] = {}
    if data.approaching_deadline_threshold is not None:
        updates["approaching_deadline_threshold"] = data.approaching_deadline_threshold
    if data.theme is not None:
        updates["theme"] = data.theme

    prefs = update_preferences(session, updates)
    session.commit()
    return prefs
