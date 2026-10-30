"""FastAPI router for the Dashboard endpoint."""
from __future__ import annotations

from datetime import date
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.api.deps import get_db_session
from backend.exceptions import ValidationError
from backend.schemas.dashboard import DashboardSchema
from backend.services import review_service
from backend.services.dashboard_service import get_dashboard_data

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
SessionDep = Annotated[Session, Depends(get_db_session)]


@router.get("", response_model=DashboardSchema)
def get_dashboard(
    session: SessionDep,
    today: str = Query(..., description="Client local date YYYY-MM-DD"),
    tz_offset: Optional[str] = Query(default=None, description="Client tz offset e.g. +07:00"),
) -> DashboardSchema:
    """What needs attention: things to process, long waits and projects at risk.

    Pass the client's local date (and offset) so dates match the user's timezone.
    """
    try:
        client_today = date.fromisoformat(today)
    except ValueError:
        raise ValidationError(f"Invalid date: {today!r}. Expected YYYY-MM-DD.")
    return get_dashboard_data(session, client_today, review_service._parse_tz_offset(tz_offset))
