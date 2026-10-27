"""Pydantic schemas for Dashboard API responses."""
from __future__ import annotations
from typing import List, Optional
from pydantic import BaseModel


class DeadlineItemSchema(BaseModel):
    id: int
    type: str          # "project" | "task"
    title: str
    deadline: str      # YYYY-MM-DD
    is_overdue: bool
    item_id: Optional[int] = None   # set for tasks


class ProjectSummarySchema(BaseModel):
    id: int
    title: str
    task_count: int
    completed_task_count: int
    progress_percentage: int    # integer, (200m+n)//(2n) formula
    project_deadline: Optional[str] = None


class DashboardSchema(BaseModel):
    inbox_count: int
    active_projects_count: int
    active_task_count: int
    areas_count: int
    area_task_count: int
    resources_count: int
    reference_link_count: int       # Phase 5: always 0 until ReferenceLink model exists
    archives_count: int
    overall_progress: Optional[int]     # None when no eligible projects
    nearest_deadline_project: Optional[str]  # YYYY-MM-DD or None
    upcoming_deadlines: List[DeadlineItemSchema]
    active_projects: List[ProjectSummarySchema]
    last_review_date: Optional[str]     # Phase 10
