"""Pydantic schemas for Tasks and Subtasks."""
from __future__ import annotations

from datetime import date, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _strip_title(v: object) -> object:
    if not isinstance(v, str):
        return v
    stripped = v.strip()
    if not stripped:
        raise ValueError("title must not be empty or whitespace")
    return stripped


# ---------------------------------------------------------------------------
# Subtask schemas
# ---------------------------------------------------------------------------

class SubtaskCreate(BaseModel):
    title: str = Field(..., max_length=200)

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, v: object) -> object:
        return _strip_title(v)


class SubtaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, v: object) -> object:
        if v is None:
            return v
        return _strip_title(v)


class SubtaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    title: str
    is_complete: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Task schemas
# ---------------------------------------------------------------------------

class TaskCreate(BaseModel):
    title: str = Field(..., max_length=200)
    item_id: Optional[int] = None
    description: str = Field(default="", max_length=5000)
    notes: str = Field(default="", max_length=10000)
    due_date: Optional[date] = None
    priority: Literal["high", "medium", "low"] = "medium"
    tag_names: List[str] = Field(default_factory=list, max_length=20,
                                  description="Tag names to assign (max 20)")

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, v: object) -> object:
        return _strip_title(v)

    @field_validator("tag_names", mode="before")
    @classmethod
    def validate_tags(cls, v: object) -> object:
        if isinstance(v, list):
            if len(v) > 20:
                raise ValueError("A task can have at most 20 tags")
            return [str(t).strip().lower() for t in v if str(t).strip()]
        return v or []


class TaskUpdate(BaseModel):
    """Partial update schema — only provided fields are applied."""

    model_config = ConfigDict(extra="ignore")

    title: Optional[str] = Field(default=None, max_length=200)
    item_id: Optional[int] = None
    description: Optional[str] = Field(default=None, max_length=5000)
    notes: Optional[str] = Field(default=None, max_length=10000)
    due_date: Optional[date] = None
    priority: Optional[Literal["high", "medium", "low"]] = None
    is_complete: Optional[bool] = None
    tag_names: Optional[List[str]] = Field(default=None, description="Tag names to assign (replaces existing, max 20)")
    focus_date: Optional[date] = Field(default=None, description="Local date the task is put on Today; null removes it")
    waiting_for: Optional[str] = Field(default=None, max_length=200, description="Who or what the task waits on; null or blank clears it")
    defer_until: Optional[date] = Field(default=None, description="Local date the task starts; null clears it")
    is_someday: Optional[bool] = Field(default=None, description="Park the task as a Someday idea")

    @field_validator("waiting_for", mode="before")
    @classmethod
    def blank_waiting_is_none(cls, v: object) -> object:
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v

    @field_validator('tag_names', mode='before')
    @classmethod
    def validate_tags(cls, v: object) -> object:
        if v is None:
            return v
        if isinstance(v, list):
            if len(v) > 20:
                raise ValueError('A task can have at most 20 tags')
            return [str(t).strip().lower() for t in v if str(t).strip()]
        return v

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, v: object) -> object:
        if v is None:
            return v
        return _strip_title(v)


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    item_id: Optional[int] = None
    title: str
    description: str
    notes: str
    due_date: Optional[date] = None
    priority: str
    is_complete: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime
    subtask_count: int = 0
    completed_subtask_count: int = 0
    tags: List[str] = Field(default_factory=list)
    focus_date: Optional[date] = None
    waiting_for: Optional[str] = None
    waiting_since: Optional[datetime] = None
    defer_until: Optional[date] = None
    is_someday: bool = False
    item_title: Optional[str] = None
    item_type: Optional[str] = None
    meeting_id: Optional[int] = None
    meeting_title: Optional[str] = None
    meeting_held_at: Optional[datetime] = None


class TodayResponse(BaseModel):
    """Open tasks for the Today view, each task in at most one list."""

    overdue: List[TaskResponse]
    due_today: List[TaskResponse]
    focused: List[TaskResponse]
    waiting: List[TaskResponse]


# ---------------------------------------------------------------------------
# Payload schemas (move / reorder)
# ---------------------------------------------------------------------------

class TaskMovePayload(BaseModel):
    """Payload for moving a task to an item or to the Inbox (item_id=None)."""

    item_id: Optional[int] = None


class TaskReorderPayload(BaseModel):
    """Payload for reordering tasks within a list."""

    task_ids: List[int]
