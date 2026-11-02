"""Pydantic schemas for the week view."""
from __future__ import annotations

from datetime import date
from typing import List


from backend.schemas.base import ApiModel

from backend.schemas.meeting import MeetingSummary
from backend.schemas.task import TaskResponse


class DeadlineEntry(ApiModel):
    id: int
    title: str


class CalendarDay(ApiModel):
    date: date
    meetings: List[MeetingSummary]
    due: List[TaskResponse]
    planned: List[TaskResponse]
    deadlines: List[DeadlineEntry]
    starts: List[TaskResponse]


class CalendarWeekResponse(ApiModel):
    """Seven consecutive days starting on the requested Monday."""

    days: List[CalendarDay]
