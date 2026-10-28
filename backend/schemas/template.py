"""Pydantic schemas for Templates and TemplateTasks."""
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
# TemplateTask schemas
# ---------------------------------------------------------------------------

class TemplateTaskBase(BaseModel):
    title: str = Field(..., max_length=200)
    description: str = Field(default="", max_length=5000)
    priority: Literal["high", "medium", "low"] = "medium"
    relative_days: int = Field(default=0, ge=0, le=365)

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, v: object) -> object:
        return _strip_title(v)


class TemplateTaskCreate(TemplateTaskBase):
    """Schema for creating a new template task."""
    pass


class TemplateTaskUpdate(BaseModel):
    """Schema for updating an existing template task."""

    model_config = ConfigDict(extra="ignore")

    title: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=5000)
    priority: Optional[Literal["high", "medium", "low"]] = None
    relative_days: Optional[int] = Field(default=None, ge=0, le=365)

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, v: object) -> object:
        if v is None:
            return v
        return _strip_title(v)


class TemplateTaskResponse(BaseModel):
    """Schema for template task response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    template_id: int
    title: str
    description: str
    priority: str
    relative_days: int
    sort_order: int


# ---------------------------------------------------------------------------
# Template schemas
# ---------------------------------------------------------------------------

class TemplateBase(BaseModel):
    title: str = Field(..., max_length=100)
    description: str = Field(default="", max_length=500)

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, v: object) -> object:
        return _strip_title(v)


class TemplateCreate(TemplateBase):
    """Schema for creating a new template."""

    tasks: List[TemplateTaskCreate] = Field(default_factory=list)

    @field_validator("tasks", mode="before")
    @classmethod
    def validate_task_limit(cls, v: object) -> object:
        if isinstance(v, list) and len(v) > 50:
            raise ValueError("A template can have at most 50 tasks")
        return v


class TemplateUpdate(BaseModel):
    """Schema for updating an existing template."""

    model_config = ConfigDict(extra="ignore")

    title: Optional[str] = Field(default=None, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, v: object) -> object:
        if v is None:
            return v
        return _strip_title(v)


class TemplateResponse(BaseModel):
    """Schema for template response (without tasks)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    task_count: int
    created_at: datetime
    updated_at: datetime


class TemplateDetailResponse(TemplateResponse):
    """Schema for template detail response (with tasks)."""

    tasks: List[TemplateTaskResponse] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# CreateProjectFromTemplate schema
# ---------------------------------------------------------------------------

class CreateProjectFromTemplatePayload(BaseModel):
    """Payload for creating a project from a template."""

    title: str = Field(..., max_length=200)
    start_date: Optional[date] = None
    project_goal: Optional[str] = Field(default=None, max_length=500)
    project_deadline: Optional[date] = None
    area_id: Optional[int] = None

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, v: object) -> object:
        return _strip_title(v)


# ---------------------------------------------------------------------------
# TemplateTask reorder schema
# ---------------------------------------------------------------------------

class TemplateTaskReorderPayload(BaseModel):
    """Payload for reordering template tasks."""

    task_ids: List[int]
