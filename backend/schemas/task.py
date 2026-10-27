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

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, v: object) -> object:
        return _strip_title(v)


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


# ---------------------------------------------------------------------------
# Payload schemas (move / reorder)
# ---------------------------------------------------------------------------

class TaskMovePayload(BaseModel):
    """Payload for moving a task to an item or to the Inbox (item_id=None)."""

    item_id: Optional[int] = None


class TaskReorderPayload(BaseModel):
    """Payload for reordering tasks within a list."""

    task_ids: List[int]
