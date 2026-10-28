"""Pydantic schemas for Weekly Review API."""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ---------------------------------------------------------------------------
# Review completion
# ---------------------------------------------------------------------------

class WeeklyReviewComplete(BaseModel):
    """Payload for POST /api/weekly-review/complete."""

    notes: str = Field(default="", max_length=500)

    @field_validator("notes", mode="before")
    @classmethod
    def strip_notes(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v


class WeeklyReviewResponse(BaseModel):
    """Response for a completed review record."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    completed_at: datetime
    notes: str


# ---------------------------------------------------------------------------
# Review status
# ---------------------------------------------------------------------------

class ReviewStatusResponse(BaseModel):
    """GET /api/weekly-review/status response."""

    last_review_date: Optional[str]        # YYYY-MM-DD local date, or None
    last_review_days_ago: Optional[int]    # days since last review, or None


# ---------------------------------------------------------------------------
# Inbox step
# ---------------------------------------------------------------------------

class ReviewTaskItem(BaseModel):
    """One inbox task shown during the review."""

    id: int
    title: str
    description: str
    priority: str
    created_at: datetime


# ---------------------------------------------------------------------------
# Projects step
# ---------------------------------------------------------------------------

class ReviewProjectItem(BaseModel):
    """One active project shown during review."""

    id: int
    title: str
    description: str
    task_count: int
    open_task_count: int
    completed_task_count: int
    progress_percentage: int
    project_deadline: Optional[str]        # YYYY-MM-DD or None
    project_status: str
    days_since_update: int
    is_stale: bool                          # True if days_since_update >= 30
    updated_at: datetime


# ---------------------------------------------------------------------------
# Areas step
# ---------------------------------------------------------------------------

class ReviewAreaItem(BaseModel):
    """One active area shown during review."""

    id: int
    title: str
    description: str
    open_task_count: int
    next_task_title: Optional[str]         # title of first open task, or None
    days_since_update: int
    is_stale: bool


# ---------------------------------------------------------------------------
# Resources step
# ---------------------------------------------------------------------------

class ReviewResourceItem(BaseModel):
    """One active resource shown during review."""

    id: int
    title: str
    description: str
    days_since_update: int
    is_stale: bool                          # True if days_since_update >= 30
    updated_at: datetime


# ---------------------------------------------------------------------------
# History
# ---------------------------------------------------------------------------

class WeeklyReviewHistoryResponse(BaseModel):
    """GET /api/weekly-review/history response — list of past reviews."""

    reviews: List[WeeklyReviewResponse]
    total: int
