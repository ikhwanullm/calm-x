"""FastAPI router for Weekly Review."""
from __future__ import annotations

from datetime import date
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.api.deps import get_db_session
from backend.exceptions import ValidationError
from backend.schemas.weekly_review import (
    ReviewAreaItem,
    ReviewProjectItem,
    ReviewResourceItem,
    ReviewStatusResponse,
    ReviewTaskItem,
    WeeklyReviewComplete,
    WeeklyReviewHistoryResponse,
    WeeklyReviewResponse,
)
from backend.services import review_service

router = APIRouter(prefix="/weekly-review", tags=["weekly-review"])
SessionDep = Annotated[Session, Depends(get_db_session)]


def _parse_today(today: str) -> date:
    """Parse a YYYY-MM-DD date string or raise ValidationError."""
    try:
        return date.fromisoformat(today)
    except ValueError:
        raise ValidationError(f"Invalid date: {today!r}. Expected YYYY-MM-DD.")


@router.get("/status", response_model=ReviewStatusResponse)
def get_review_status(
    session: SessionDep,
    today: str = Query(..., description="Client local date YYYY-MM-DD"),
) -> ReviewStatusResponse:
    """Get the date of the last completed review and days since."""
    client_today = _parse_today(today)
    return ReviewStatusResponse(
        last_review_date=review_service.get_last_review_date(session),
        last_review_days_ago=review_service.get_last_review_days_ago(session, client_today),
    )


@router.get("/inbox", response_model=List[ReviewTaskItem])
def get_review_inbox(session: SessionDep) -> list[ReviewTaskItem]:
    """Return all open inbox tasks for the review."""
    return review_service.get_inbox_tasks(session)


@router.get("/projects", response_model=List[ReviewProjectItem])
def get_review_projects(
    session: SessionDep,
    today: str = Query(..., description="Client local date YYYY-MM-DD"),
    tz_offset: Optional[str] = Query(default=None, description="Client tz offset e.g. +07:00"),
) -> list[ReviewProjectItem]:
    """Return active projects for review with staleness info."""
    client_today = _parse_today(today)
    return review_service.get_projects_for_review(session, client_today, tz_offset)


@router.get("/areas", response_model=List[ReviewAreaItem])
def get_review_areas(
    session: SessionDep,
    today: str = Query(..., description="Client local date YYYY-MM-DD"),
    tz_offset: Optional[str] = Query(default=None, description="Client tz offset e.g. +07:00"),
) -> list[ReviewAreaItem]:
    """Return active areas for review."""
    client_today = _parse_today(today)
    return review_service.get_areas_for_review(session, client_today, tz_offset)


@router.get("/resources", response_model=List[ReviewResourceItem])
def get_review_resources(
    session: SessionDep,
    today: str = Query(..., description="Client local date YYYY-MM-DD"),
    tz_offset: Optional[str] = Query(default=None, description="Client tz offset e.g. +07:00"),
) -> list[ReviewResourceItem]:
    """Return active resources sorted by least recently updated."""
    client_today = _parse_today(today)
    return review_service.get_resources_for_review(session, client_today, tz_offset)


@router.post("/complete", response_model=WeeklyReviewResponse, status_code=201)
def complete_review(data: WeeklyReviewComplete, session: SessionDep) -> WeeklyReviewResponse:
    """Record a completed weekly review."""
    review = review_service.complete_review(session, data.notes)
    session.commit()
    session.refresh(review)
    return review


@router.get("/history", response_model=WeeklyReviewHistoryResponse)
def get_review_history(session: SessionDep) -> WeeklyReviewHistoryResponse:
    """Return the 10 most recent completed reviews."""
    reviews = review_service.list_reviews(session, limit=10)
    return WeeklyReviewHistoryResponse(reviews=reviews, total=len(reviews))
