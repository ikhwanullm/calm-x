"""FastAPI router for the week view."""
from __future__ import annotations

from datetime import date
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.api.deps import get_db_session
from backend.exceptions import ValidationError
from backend.schemas.calendar import CalendarWeekResponse
from backend.services import calendar_service, review_service

router = APIRouter(prefix="/calendar", tags=["calendar"])
SessionDep = Annotated[Session, Depends(get_db_session)]


def _parse_date(name: str, value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValidationError(f"Invalid {name}: {value!r}. Expected YYYY-MM-DD.")


@router.get("/week", response_model=CalendarWeekResponse)
def get_week(
    session: SessionDep,
    start: str = Query(..., description="Monday of the week, YYYY-MM-DD"),
    today: str = Query(..., description="Client local date YYYY-MM-DD"),
    tz_offset: Optional[str] = Query(default=None, description="Client tz offset e.g. +07:00"),
) -> CalendarWeekResponse:
    """Seven days: meetings, tasks due, planned (today only), project deadlines and tasks that start."""
    return calendar_service.get_week(
        session, _parse_date("start", start), _parse_date("today", today),
        review_service._parse_tz_offset(tz_offset),
    )
