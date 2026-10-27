"""FastAPI router for Settings (user preferences)."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.api.deps import get_db_session
from backend.services.preference_service import get_preferences, get_threshold

router = APIRouter(prefix="/settings", tags=["settings"])
SessionDep = Annotated[Session, Depends(get_db_session)]


@router.get("")
def get_settings(session: SessionDep) -> dict:
    """Return all user preferences."""
    prefs = get_preferences(session)
    # Add computed fields for convenience
    prefs["approaching_deadline_threshold"] = str(get_threshold(session))
    return prefs
