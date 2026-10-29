"""Pydantic schemas for the week view."""
from __future__ import annotations

from datetime import date
from typing import List

from pydantic import BaseModel

from backend.schemas.meeting import MeetingSummary
from backend.schemas.task import TaskResponse


class DeadlineEntry(BaseModel):
    id: int
    title: str


class CalendarDay(BaseModel):
    date: date
    meetings: List[MeetingSummary]
    due: List[TaskResponse]
    planned: List[TaskResponse]
    deadlines: List[DeadlineEntry]
    starts: List[TaskResponse]


class CalendarWeekResponse(BaseModel):
    """Seven consecutive days starting on the requested Monday."""

    days: List[CalendarDay]
