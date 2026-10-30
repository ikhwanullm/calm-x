"""Pydantic schemas for Dashboard API responses.

The Dashboard shows what needs attention (things to process, long waits, projects at risk);
what to do today lives on the Today page.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class MeetingToProcess(BaseModel):
    id: int
    title: str
    held_at: datetime
    item_id: int
    item_title: str
    item_type: str
    open_action_count: int


class StaleWaiting(BaseModel):
    id: int
    title: str
    waiting_for: str
    waiting_days: int
    due_date: Optional[str] = None
    item_id: Optional[int] = None
    item_title: Optional[str] = None
    item_type: Optional[str] = None     # "project" | "area" | None for the Inbox


class AttentionProject(BaseModel):
    id: int
    title: str
    # overdue_tasks | deadline_passed | deadline_soon | stale | no_open_tasks
    reasons: List[str]
    overdue_task_count: int
    open_task_count: int
    progress_percentage: int
    project_deadline: Optional[str] = None
    days_inactive: int


class DashboardCounts(BaseModel):
    active_projects: int
    areas: int
    resources: int
    archived: int
    someday: int


class DashboardSchema(BaseModel):
    inbox_count: int
    last_review_date: Optional[str]          # YYYY-MM-DD or None
    days_since_review: Optional[int]
    meetings_to_process: List[MeetingToProcess]
    stale_waiting: List[StaleWaiting]        # longest waits first, capped
    stale_waiting_total: int
    attention_projects: List[AttentionProject]
    counts: DashboardCounts
