"""Pydantic schemas for Item (Project, Area, Resource) API."""
from __future__ import annotations

import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


class ItemBase(BaseModel):
    """Common fields for all Item types."""
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=5000)
    notes: str = Field(default="", max_length=10000)

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, v: str) -> str:
        v = str(v).strip()
        if not v:
            raise ValueError("Title must not be empty or whitespace only")
        return v


# ---------------------------------------------------------------------------
# Create schemas
# ---------------------------------------------------------------------------

class ProjectCreate(ItemBase):
    type: Literal["project"] = "project"
    project_goal: Optional[str] = Field(default=None, max_length=500)
    project_deadline: Optional[datetime.date] = None


class AreaCreate(ItemBase):
    type: Literal["area"] = "area"
    area_maintenance_notes: Optional[str] = Field(default=None, max_length=1000)


class ResourceCreate(ItemBase):
    type: Literal["resource"] = "resource"


# Discriminated union for creation
ItemCreate = ProjectCreate | AreaCreate | ResourceCreate


# ---------------------------------------------------------------------------
# Update schema (partial — all fields optional)
# ---------------------------------------------------------------------------

class ItemUpdate(BaseModel):
    """Partial update — only provided fields are changed."""
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=5000)
    notes: Optional[str] = Field(default=None, max_length=10000)
    # Project fields
    project_goal: Optional[str] = Field(default=None, max_length=500)
    project_deadline: Optional[datetime.date] = None
    project_status: Optional[str] = Field(default=None)
    # Area fields
    area_maintenance_notes: Optional[str] = Field(default=None, max_length=1000)

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, v: object) -> object:
        if v is None:
            return v
        v = str(v).strip()
        if not v:
            raise ValueError("Title must not be empty or whitespace only")
        return v

    @field_validator("project_status", mode="before")
    @classmethod
    def validate_project_status(cls, v: object) -> object:
        if v is None:
            return v
        if v not in ("active", "completed"):
            raise ValueError("project_status must be 'active' or 'completed'")
        return v


# ---------------------------------------------------------------------------
# Response schemas (type-specific — no leaking of irrelevant fields)
# ---------------------------------------------------------------------------

class _ItemResponseBase(BaseModel):
    """Shared response fields for all item types."""
    id: int
    type: str
    title: str
    description: str
    notes: str
    archived_at: Optional[datetime.datetime] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime
    # Computed task counts (populated by service layer)
    task_count: int = 0
    completed_task_count: int = 0
    progress_percentage: int = 0

    model_config = {"from_attributes": True}


class ProjectResponse(_ItemResponseBase):
    """Response schema for Project items — includes project-specific fields."""
    type: Literal["project"]
    project_goal: Optional[str] = None
    project_deadline: Optional[datetime.date] = None
    project_status: Optional[str] = None
    project_completed_at: Optional[datetime.datetime] = None


class AreaResponse(_ItemResponseBase):
    """Response schema for Area items — includes area-specific fields."""
    type: Literal["area"]
    area_maintenance_notes: Optional[str] = None


class ResourceResponse(_ItemResponseBase):
    """Response schema for Resource items — no extra type-specific fields."""
    type: Literal["resource"]


# Discriminated union for responses
ItemResponse = ProjectResponse | AreaResponse | ResourceResponse


def item_to_response(item: object, task_count: int = 0, completed_task_count: int = 0) -> ItemResponse:
    """Convert an ORM Item to the appropriate type-specific response schema."""
    from backend.models.item import Item

    assert isinstance(item, Item)
    progress = 0
    if task_count > 0:
        # round-half-up: floor((200 * completed + total) / (2 * total))
        progress = (200 * completed_task_count + task_count) // (2 * task_count)

    base = {
        "id": item.id,
        "type": item.type,
        "title": item.title,
        "description": item.description or "",
        "notes": item.notes or "",
        "archived_at": item.archived_at,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
        "task_count": task_count,
        "completed_task_count": completed_task_count,
        "progress_percentage": progress,
    }

    if item.type == "project":
        return ProjectResponse(
            **base,
            project_goal=item.project_goal,
            project_deadline=item.project_deadline,
            project_status=item.project_status,
            project_completed_at=item.project_completed_at,
        )
    elif item.type == "area":
        return AreaResponse(
            **base,
            area_maintenance_notes=item.area_maintenance_notes,
        )
    else:
        return ResourceResponse(**base)
